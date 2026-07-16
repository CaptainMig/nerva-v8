"""Per-model, per-axis z-score normalization against each model's OWN running
distribution. Raw scores are never compared across models.

Protocol (documented in SHADOW_NOTES.md):
- Welford running mean/variance per (model, axis), persisted to JSON.
- Each new observation UPDATES the running stats first, then is z-scored
  against the updated distribution (avoids divide-by-zero on the first
  observations; pre-warm-up records are flagged uncalibrated and excluded
  from analysis anyway, so the include-current-observation bias only touches
  records that analysis already ignores).
- Deltas are marked calibrated only once BOTH models have >= WARMUP_N
  observations on EVERY axis.
"""

import json
import math
from pathlib import Path

from shadow import config


class NormalizationState:
    def __init__(self, path):
        self.path = Path(path)
        # stats[model][axis] = {"n": int, "mean": float, "m2": float}
        self.stats = {}
        if self.path.exists():
            self.stats = json.loads(self.path.read_text())

    def _cell(self, model, axis):
        return self.stats.setdefault(model, {}).setdefault(
            axis, {"n": 0, "mean": 0.0, "m2": 0.0}
        )

    def update(self, model, axis, x):
        """Welford single-observation update."""
        cell = self._cell(model, axis)
        cell["n"] += 1
        delta = x - cell["mean"]
        cell["mean"] += delta / cell["n"]
        cell["m2"] += delta * (x - cell["mean"])

    def sigma(self, model, axis):
        cell = self._cell(model, axis)
        if cell["n"] < 2:
            return 0.0
        return math.sqrt(cell["m2"] / (cell["n"] - 1))

    def zscore(self, model, axis, x):
        """z against the model's own running distribution; 0.0 while the
        distribution is degenerate (n < 2 or zero variance)."""
        sigma = self.sigma(model, axis)
        if sigma == 0.0:
            return 0.0
        return (x - self._cell(model, axis)["mean"]) / sigma

    def observations(self, model, axis):
        return self._cell(model, axis)["n"]

    def calibrated(self, model_a, model_b, warmup_n=config.WARMUP_N):
        """True once both models have >= warmup_n observations on every axis."""
        return all(
            self.observations(m, axis) >= warmup_n
            for m in (model_a, model_b)
            for axis in config.AXES
        )

    def save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.stats, indent=2, sort_keys=True))


def normalize_scores(state, model, values):
    """Update running stats with this observation, then z-score each axis."""
    normed = {}
    for axis in config.AXES:
        x = float(values[axis])
        state.update(model, axis, x)
        normed[axis] = state.zscore(model, axis, x)
    return normed
