"""Full-pipeline integration test with the Grok API mocked: canned JSON
scores flow through trigger -> normalization -> C_empirical -> frozen-kernel
shadow verdict -> written JSONL record."""

import json
import random
import shutil

import pytest

from shadow import config, harness, shadow_logger
from shadow.grok_client import GrokError

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="node not available")

# Clean-commit preset: |r_mixed - tau| ~ 0.032 < SHADOW_BAND, so the trigger
# is deterministically 'band' regardless of the sampling RNG.
BAND_INPUT = {
    "input_id": "IT-001",
    "scenario": "Reversible rollout, telemetry-instrumented, low risk.",
    "E": 0.35, "S": 0.86, "R": 0.22, "Sp": 0.82, "St": 0.78,
    "cE": 0.95, "cS": 0.95, "cR": 0.93, "cSp": 0.97, "cSt": 0.96,
}


class FakeGrok:
    """Canned-response stand-in for GrokClient."""

    def __init__(self, model="grok-4-0709", values=None, fail=False):
        self.model_string = model
        self.values = values or {"E": 0.30, "S": 0.80, "R": 0.30, "Sp": 0.75, "St": 0.70}
        self.fail = fail
        self.calls = 0

    def score(self, scenario):
        self.calls += 1
        if self.fail:
            raise GrokError("grok scoring failed after 3 attempts — canned outage")
        from shadow.grok_client import GrokScore
        return GrokScore(
            values=dict(self.values),
            confidences={a: 0.8 for a in config.AXES},
            rationales={a: "canned rationale for %s" % a for a in config.AXES},
            model=self.model_string,
        )


def run_harness(tmp_path, grok, inputs=None, seed=7):
    inputs_file = tmp_path / "inputs.jsonl"
    inputs_file.write_text(
        "\n".join(json.dumps(r) for r in (inputs or [BAND_INPUT])) + "\n")
    log_dir, state_dir = tmp_path / "logs", tmp_path / "state"
    written = harness.run(harness.load_inputs(str(inputs_file)), grok,
                          log_dir=log_dir, state_dir=state_dir,
                          rng=random.Random(seed))
    records = []
    for f in sorted(log_dir.glob("*.jsonl")):
        records += [json.loads(line) for line in f.read_text().splitlines()]
    return written, records, state_dir


def test_full_pipeline_writes_complete_record(tmp_path):
    grok = FakeGrok()
    written, records, _ = run_harness(tmp_path, grok)
    assert written == 1 and len(records) == 1 and grok.calls == 1
    rec = records[0]

    for field in shadow_logger.REQUIRED_FIELDS:
        assert field in rec, field
    assert rec["trigger"] == "band"
    assert rec["input_id"] == "IT-001"
    assert rec["input_hash"] == shadow_logger.input_hash(BAND_INPUT["scenario"])
    assert rec["claude_model"] == config.CLAUDE_MODEL_DEFAULT
    assert rec["grok_model"] == "grok-4-0709"          # exact string, pinned
    assert rec["verdict_of_record"] == "COMMIT"
    assert rec["verdict_shadow"] in ("COMMIT", "HOLD", "WAIT", "ESCALATE", "TOXIC")
    assert rec["verdict_changed"] == (rec["verdict_shadow"] != rec["verdict_of_record"])
    assert rec["calibrated"] is False                  # far below warm-up N
    assert rec["k"] == config.K
    assert abs(rec["r_shadow"] - rec["c_empirical"] * rec["r_pure"]) < 1e-9
    assert rec["kernel_ref"] == "v11.1-stable"
    assert rec["grok_error"] is None
    assert set(rec["grok_rationales"]) == set(config.AXES)
    assert set(rec["grok_scores_raw"]) == {k for a in config.AXES for k in (a, "c" + a)}
    # Nothing secret in the record.
    assert "XAI_API_KEY" not in json.dumps(rec)


def test_grok_outage_logs_error_and_continues(tmp_path):
    written, records, _ = run_harness(tmp_path, FakeGrok(fail=True))
    assert written == 1
    rec = records[0]
    assert "canned outage" in rec["grok_error"]
    assert rec["grok_model"] is None
    assert rec["verdict_shadow"] is None
    assert rec["verdict_changed"] is False
    # The primary path was unaffected: verdict of record is present and final.
    assert rec["verdict_of_record"] == "COMMIT"


def test_model_version_change_rolls_epoch(tmp_path):
    _, records_a, state_dir = run_harness(tmp_path, FakeGrok(model="grok-4-0709"))
    inputs_file = tmp_path / "inputs.jsonl"
    written = harness.run(harness.load_inputs(str(inputs_file)),
                          FakeGrok(model="grok-4-0710"),
                          log_dir=tmp_path / "logs", state_dir=state_dir,
                          rng=random.Random(7))
    assert written == 1
    all_records = [json.loads(line)
                   for f in sorted((tmp_path / "logs").glob("*.jsonl"))
                   for line in f.read_text().splitlines()]
    run_ids = [r["run_id"] for r in all_records]
    assert len(all_records) == 2
    assert run_ids[0] != run_ids[1], "model string change must open a new epoch"


def test_normalization_state_persists_across_runs(tmp_path):
    _, _, state_dir = run_harness(tmp_path, FakeGrok())
    stats = json.loads((state_dir / "running_stats.json").read_text())
    assert stats[config.CLAUDE_MODEL_DEFAULT]["E"]["n"] == 1
    inputs_file = tmp_path / "inputs.jsonl"
    harness.run(harness.load_inputs(str(inputs_file)), FakeGrok(),
                log_dir=tmp_path / "logs", state_dir=state_dir,
                rng=random.Random(7))
    stats = json.loads((state_dir / "running_stats.json").read_text())
    assert stats[config.CLAUDE_MODEL_DEFAULT]["E"]["n"] == 2
    assert stats["grok-4-0709"]["E"]["n"] == 2
