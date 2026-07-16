"""Append-only JSONL shadow log + run_id epoch tracking.

One record per shadow-scored input, appended to shadow_logs/YYYY-MM-DD.jsonl
(UTC date). Records are never rewritten. API keys and raw API responses
(anything carrying headers) must never reach this module — callers pass only
parsed scores, rationales, and sanitized error strings.

Epoch rule: pooled statistics are only valid within a fixed
(claude_model, grok_model) pair of EXACT versioned model strings. If either
string changes between runs, run_id rolls to a new epoch and analysis must
not pool across the boundary.
"""

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

# The schema promised by the implementation prompt — every record must carry
# all of these keys (extras like kernel provenance are allowed on top).
REQUIRED_FIELDS = [
    "run_id", "timestamp_utc", "input_id", "input_hash",
    "claude_model", "grok_model",
    "claude_scores_raw", "grok_scores_raw",
    "claude_scores_norm", "grok_scores_norm",
    "delta_per_axis", "delta_composite", "calibrated",
    "c_empirical", "k", "r_pure", "r_shadow",
    "verdict_of_record", "verdict_shadow", "verdict_changed",
    "trigger", "grok_rationales", "grok_error",
]


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat()


def input_hash(scenario_text):
    return hashlib.sha256(scenario_text.encode("utf-8")).hexdigest()


def append_record(record, log_dir):
    missing = [f for f in REQUIRED_FIELDS if f not in record]
    if missing:
        raise ValueError("shadow record missing fields: %s" % ", ".join(missing))
    day = record["timestamp_utc"][:10]  # YYYY-MM-DD from the ISO timestamp
    log_dir = Path(log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)
    path = log_dir / ("%s.jsonl" % day)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, sort_keys=True) + "\n")
    return path


class EpochTracker:
    """Persists the current (claude_model, grok_model) pair and rolls the
    run_id epoch whenever either exact model string changes."""

    def __init__(self, state_path):
        self.path = Path(state_path)
        if self.path.exists():
            self.state = json.loads(self.path.read_text())
        else:
            self.state = {"epoch": 0, "claude_model": None, "grok_model": None}

    def run_id_for(self, claude_model, grok_model):
        if (claude_model != self.state["claude_model"]
                or grok_model != self.state["grok_model"]):
            self.state = {
                "epoch": self.state["epoch"] + 1,
                "claude_model": claude_model,
                "grok_model": grok_model,
            }
            self._save()
        pair_hash = hashlib.sha256(
            ("%s|%s" % (claude_model, grok_model)).encode("utf-8")
        ).hexdigest()[:8]
        return "epoch-%03d-%s" % (self.state["epoch"], pair_hash)

    def _save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.state, indent=2))
