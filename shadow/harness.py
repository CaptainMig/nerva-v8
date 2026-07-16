"""Parallel-execution harness: python -m shadow.harness <inputs.jsonl>

Input format — one JSON object per line, the api/parse.js payload shape plus
identity and the scenario text (Grok scores the same text the primary scorer
scored):

    {"input_id": "DRN-04412", "scenario": "...",
     "E":0.42,"S":0.74,"R":0.30,"Sp":0.82,"St":0.78,
     "cE":0.95,"cS":0.92,"cR":0.88,"cSp":0.94,"cSt":0.92,
     "claude_model": "claude-haiku-4-5"}        # optional, defaults to config

Flow per input:
1. Verdict of record — frozen v11.1-stable kernel via the bridge. Computed
   first, never delayed by anything Grok does.
2. Trigger — full parallel when |r_mixed − τ| <= SHADOW_BAND, else sampled at
   SHADOW_SAMPLE_RATE.
3. Grok scoring on a thread pool (non-blocking relative to the primary path);
   a Grok failure is logged into the record and the run continues.
4. Normalization (per-model per-axis z), Δ per axis, composite Δ using the
   frozen kernel's own CONF_WEIGHTS (probed from the tag blob by the bridge).
5. C_empirical (placeholder formula, confidence.py), then the shadow verdict:
   the frozen kernel's evaluate() re-run with C forced to C_empirical.
6. Append-only JSONL record.

Nothing here writes to the kernel, τ, or any deployed surface.
"""

import argparse
import json
import random
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from shadow import config, confidence, kernel_bridge, shadow_logger
from shadow.grok_client import GrokClient, GrokError
from shadow.normalize import NormalizationState, normalize_scores


def load_inputs(path):
    inputs = []
    with open(path, encoding="utf-8") as f:
        for i, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            if "scenario" not in rec:
                raise ValueError("input line %d has no 'scenario' text" % (i + 1))
            missing = [k for a in config.AXES for k in (a, "c" + a) if k not in rec]
            if missing:
                raise ValueError("input line %d missing keys: %s" % (i + 1, missing))
            inputs.append({
                "input_id": str(rec.get("input_id", "line-%d" % (i + 1))),
                "scenario": rec["scenario"],
                "values": {a: float(rec[a]) for a in config.AXES},
                "confidences": {a: float(rec["c" + a]) for a in config.AXES},
                "claude_model": rec.get("claude_model", config.CLAUDE_MODEL_DEFAULT),
            })
    return inputs


def decide_trigger(r_mixed, tau, rng,
                   band=config.SHADOW_BAND, sample_rate=config.SHADOW_SAMPLE_RATE):
    """Returns 'band', 'sample', or None (skip)."""
    if abs(r_mixed - tau) <= band:
        return "band"
    if rng.random() < sample_rate:
        return "sample"
    return None


def run(inputs, grok_client, log_dir, state_dir, rng, max_workers=4, out=sys.stdout):
    log_dir = Path(log_dir)
    state_dir = Path(state_dir)

    # 1. Verdicts of record for every input — one bridge call, frozen kernel.
    bridge_out = kernel_bridge.evaluate_batch([
        {"values": inp["values"], "confidences": inp["confidences"]}
        for inp in inputs
    ])
    conf_weights = bridge_out["conf_weights"]
    kernel_meta = {"kernel_ref": bridge_out["kernel_ref"],
                   "kernel_blob_sha": bridge_out["kernel_blob_sha"]}

    # 2. Trigger decisions. The primary results above are already final —
    #    everything below is shadow-only and cannot delay or alter them.
    triggered = []
    for inp, res in zip(inputs, bridge_out["results"]):
        rec = res["record"]
        trig = decide_trigger(rec["bloch"]["magnitude"], rec["tau"], rng)
        if trig:
            triggered.append({"input": inp, "record": rec, "trigger": trig})

    # 3. Grok in parallel; a failure becomes a logged record, never an abort.
    def grok_or_error(item):
        try:
            return grok_client.score(item["input"]["scenario"])
        except GrokError as e:
            return e

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        grok_results = list(pool.map(grok_or_error, triggered))

    # 4-6. Normalize, derive confidence, shadow-evaluate, log — in input order
    # so the running normalization state is reproducible for a given input file.
    norm_state = NormalizationState(state_dir / "running_stats.json")
    epochs = shadow_logger.EpochTracker(state_dir / "epoch.json")
    written = 0

    scored = [(item, g) for item, g in zip(triggered, grok_results)
              if not isinstance(g, GrokError)]
    shadow_reqs = []
    enriched = []
    for item, grok in scored:
        claude_model = item["input"]["claude_model"]
        claude_norm = normalize_scores(norm_state, claude_model, item["input"]["values"])
        grok_norm = normalize_scores(norm_state, grok.model, grok.values)
        delta = {a: grok_norm[a] - claude_norm[a] for a in config.AXES}
        delta_comp = confidence.composite_delta(delta, conf_weights)
        c_emp = confidence.c_empirical(delta_comp)
        enriched.append({
            "claude_norm": claude_norm, "grok_norm": grok_norm,
            "delta": delta, "delta_comp": delta_comp, "c_emp": c_emp,
            "calibrated": norm_state.calibrated(claude_model, grok.model),
        })
        shadow_reqs.append({
            "values": item["input"]["values"],
            "confidences": item["input"]["confidences"],
            "c_empirical": c_emp,
        })
    shadow_results = (kernel_bridge.evaluate_batch(shadow_reqs)["results"]
                      if shadow_reqs else [])

    scored_iter = iter(zip(scored, enriched, shadow_results))
    for item, grok in zip(triggered, grok_results):
        inp, rec = item["input"], item["record"]
        base = dict(kernel_meta)
        base.update({
            "timestamp_utc": shadow_logger.utc_now_iso(),
            "input_id": inp["input_id"],
            "input_hash": shadow_logger.input_hash(inp["scenario"]),
            "claude_model": inp["claude_model"],
            "claude_scores_raw": _flat(inp["values"], inp["confidences"]),
            "k": config.K,
            "r_pure": rec["bloch_pure"]["magnitude"],
            "r_mixed_record": rec["bloch"]["magnitude"],
            "tau_record": rec["tau"],
            "verdict_of_record": rec["decision"],
            "trigger": item["trigger"],
        })
        if isinstance(grok, GrokError):
            base.update({
                "run_id": epochs.run_id_for(inp["claude_model"], "unavailable"),
                "grok_model": None, "grok_scores_raw": None,
                "claude_scores_norm": None, "grok_scores_norm": None,
                "delta_per_axis": None, "delta_composite": None,
                "calibrated": False, "c_empirical": None, "r_shadow": None,
                "verdict_shadow": None, "verdict_changed": False,
                "grok_rationales": None, "grok_error": str(grok),
            })
        else:
            (_, _), extra, shadow_res = next(scored_iter)
            shadow = shadow_res["shadow"]
            base.update({
                "run_id": epochs.run_id_for(inp["claude_model"], grok.model),
                "grok_model": grok.model,
                "grok_scores_raw": _flat(grok.values, grok.confidences),
                "claude_scores_norm": extra["claude_norm"],
                "grok_scores_norm": extra["grok_norm"],
                "delta_per_axis": extra["delta"],
                "delta_composite": extra["delta_comp"],
                "calibrated": extra["calibrated"],
                "c_empirical": extra["c_emp"],
                "r_shadow": shadow["bloch"]["magnitude"],
                "verdict_shadow": shadow["decision"],
                "verdict_changed": shadow["decision"] != rec["decision"],
                "grok_rationales": grok.rationales,
                "grok_error": None,
            })
        shadow_logger.append_record(base, log_dir)
        written += 1

    norm_state.save()
    print("inputs=%d triggered=%d (band=%d sample=%d) grok_errors=%d records=%d -> %s"
          % (len(inputs), len(triggered),
             sum(1 for t in triggered if t["trigger"] == "band"),
             sum(1 for t in triggered if t["trigger"] == "sample"),
             sum(1 for g in grok_results if isinstance(g, GrokError)),
             written, log_dir), file=out)
    return written


def _flat(values, confidences):
    """api/parse.js payload shape: {E..St, cE..cSt}."""
    flat = {a: values[a] for a in config.AXES}
    flat.update({"c" + a: confidences[a] for a in config.AXES})
    return flat


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="NERVA dual-scorer shadow harness (logs only; changes nothing).")
    ap.add_argument("inputs", help="JSONL file of parse.js-shaped inputs + scenario text")
    ap.add_argument("--log-dir", default=str(config.SHADOW_LOGS_DIR))
    ap.add_argument("--state-dir", default=str(config.STATE_DIR))
    ap.add_argument("--seed", type=int, default=None,
                    help="seed for the sampling RNG (reproducible triggers)")
    ap.add_argument("--max-workers", type=int, default=4)
    args = ap.parse_args(argv)

    run(load_inputs(args.inputs), GrokClient(),
        log_dir=args.log_dir, state_dir=args.state_dir,
        rng=random.Random(args.seed), max_workers=args.max_workers)


if __name__ == "__main__":
    main()
