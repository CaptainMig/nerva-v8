"""Read shadow_logs/*.jsonl and print the shadow-track health report:
totals, calibrated counts, per-axis disagreement, verdict-change rate and
direction, C_empirical distribution, and the oscillation report.

Usage: python -m shadow.analyze_shadow [--log-dir DIR | files...]
"""

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path

from shadow import config

# Provisional: a calibrated per-axis |z-delta| above this counts as a
# disagreement on that axis. See SHADOW_NOTES.md.
DISAGREE_Z = 1.0

# Severity ladder for change direction. The frozen kernel emits 'ESCALATE';
# 'CONSULT' is the current copy's name for the same verdict (see README).
SEVERITY = {"COMMIT": 0, "HOLD": 1, "WAIT": 2, "ESCALATE": 3, "CONSULT": 3, "TOXIC": 4}


def load_records(paths):
    records = []
    for path in paths:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    records.append(json.loads(line))
    return records


def report(records, out_print=print):
    p = out_print
    total = len(records)
    errors = [r for r in records if r.get("grok_error")]
    ok = [r for r in records if not r.get("grok_error")]
    calib = [r for r in ok if r.get("calibrated")]
    p("== Shadow-track report ==")
    p("total records:        %d" % total)
    p("grok errors:          %d" % len(errors))
    p("scored (grok ok):     %d" % len(ok))
    p("calibrated records:   %d  (analysis below uses calibrated only)" % len(calib))
    epochs = sorted({r["run_id"] for r in records})
    p("run_id epochs:        %d  (%s)" % (len(epochs), ", ".join(epochs)))
    if len(epochs) > 1:
        p("  WARNING: multiple epochs — do not pool statistics across them.")

    if calib:
        p("\n-- Disagreement by axis (calibrated, |z-delta| > %.1f) --" % DISAGREE_Z)
        for axis in config.AXES:
            deltas = [abs(r["delta_per_axis"][axis]) for r in calib]
            rate = sum(1 for d in deltas if d > DISAGREE_Z) / len(deltas)
            p("  %-3s rate=%5.1f%%  mean|dz|=%.3f  max|dz|=%.3f"
              % (axis, 100 * rate, sum(deltas) / len(deltas), max(deltas)))

        p("\n-- Verdict changes (calibrated) --")
        changed = [r for r in calib if r["verdict_changed"]]
        p("  change rate: %.1f%%  (%d / %d)"
          % (100 * len(changed) / len(calib), len(changed), len(calib)))
        directions = Counter((r["verdict_of_record"], r["verdict_shadow"]) for r in changed)
        away = toward = 0
        for (rec_v, sh_v), n in sorted(directions.items()):
            tighter = SEVERITY.get(sh_v, 0) > SEVERITY.get(rec_v, 0)
            away += n if tighter else 0
            toward += 0 if tighter else n
            p("  %s -> %s: %d  (%s)" % (rec_v, sh_v, n,
                                        "away from COMMIT" if tighter else "TOWARD COMMIT"))
        p("  away from COMMIT: %d, toward COMMIT: %d  (expectation: shifts away)"
          % (away, toward))
        if toward > 0:
            p("  NOTE: toward-COMMIT shifts present — review before trusting C_empirical.")

        p("\n-- C_empirical distribution (calibrated) --")
        buckets = Counter(min(9, int(r["c_empirical"] * 10)) for r in calib)
        for b in range(10):
            n = buckets.get(b, 0)
            p("  [%.1f, %.1f%s: %-4d %s"
              % (b / 10, (b + 1) / 10, ")" if b < 9 else "]", n, "#" * n))
        low_c = sum(1 for r in calib if r["c_empirical"] < 0.7)
        p("  low-C (< 0.7): %d  (promotion gate needs >= 10 human-reviewed)" % low_c)

    p("\n-- Oscillation report (inputs scored more than once; grok-ok records) --")
    by_hash = defaultdict(list)
    for r in ok:
        by_hash[r["input_hash"]].append(r)
    repeats = {h: sorted(rs, key=lambda r: r["timestamp_utc"])
               for h, rs in by_hash.items() if len(rs) > 1}
    if not repeats:
        p("  no input_hash scored more than once yet.")
    else:
        total_flips = 0
        for h, rs in sorted(repeats.items()):
            verdicts = [r["verdict_shadow"] for r in rs]
            flips = sum(1 for a, b in zip(verdicts, verdicts[1:]) if a != b)
            total_flips += flips
            if flips:
                p("  %s… scorings=%d flips=%d  [%s]"
                  % (h[:12], len(rs), flips, " -> ".join(verdicts)))
        p("  inputs with repeats: %d, total shadow-verdict flips: %d"
          % (len(repeats), total_flips))

    p("\n-- Promotion gate --")
    p("  %d / 50 calibrated records; gate also requires >= 10 human-reviewed low-C cases."
      % len(calib))
    p("  No lift claims until the gate is met. Provenance, not prediction.")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="*", help="explicit JSONL files (else --log-dir/*.jsonl)")
    ap.add_argument("--log-dir", default=str(config.SHADOW_LOGS_DIR))
    args = ap.parse_args(argv)
    paths = args.files or sorted(Path(args.log_dir).glob("*.jsonl"))
    if not paths:
        print("no shadow logs found in %s" % args.log_dir)
        return
    report(load_records(paths))


if __name__ == "__main__":
    main()
