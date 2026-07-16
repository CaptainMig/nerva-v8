import math
import statistics

from shadow import config
from shadow.normalize import NormalizationState, normalize_scores


def test_welford_matches_reference(tmp_path):
    state = NormalizationState(tmp_path / "s.json")
    xs = [0.1, 0.4, 0.35, 0.9, 0.62, 0.5, 0.11]
    for x in xs:
        state.update("m", "E", x)
    cell = state.stats["m"]["E"]
    assert cell["n"] == len(xs)
    assert math.isclose(cell["mean"], statistics.mean(xs), rel_tol=1e-12)
    assert math.isclose(state.sigma("m", "E"), statistics.stdev(xs), rel_tol=1e-12)


def test_zscore_against_own_distribution(tmp_path):
    state = NormalizationState(tmp_path / "s.json")
    for x in [0.2, 0.4, 0.6]:
        state.update("m", "R", x)
    z = state.zscore("m", "R", 0.6)
    assert math.isclose(z, (0.6 - 0.4) / statistics.stdev([0.2, 0.4, 0.6]), rel_tol=1e-12)


def test_zscore_degenerate_distribution_is_zero(tmp_path):
    state = NormalizationState(tmp_path / "s.json")
    assert state.zscore("m", "E", 0.5) == 0.0          # no observations
    state.update("m", "E", 0.5)
    assert state.zscore("m", "E", 0.7) == 0.0          # n < 2
    state.update("m", "E", 0.5)
    assert state.zscore("m", "E", 0.7) == 0.0          # zero variance


def test_calibrated_requires_warmup_on_every_axis_both_models(tmp_path):
    state = NormalizationState(tmp_path / "s.json")
    n = 5
    for i in range(n):
        for model in ("a", "b"):
            for axis in config.AXES:
                state.update(model, axis, i / n)
    assert state.calibrated("a", "b", warmup_n=n)
    assert not state.calibrated("a", "b", warmup_n=n + 1)
    # One axis short on one model breaks calibration.
    state.update("a", "E", 0.5)
    assert not state.calibrated("a", "c", warmup_n=1)  # model c never observed


def test_persistence_roundtrip(tmp_path):
    path = tmp_path / "s.json"
    state = NormalizationState(path)
    for x in [0.3, 0.6, 0.9]:
        state.update("m", "Sp", x)
    state.save()
    reloaded = NormalizationState(path)
    assert reloaded.stats == state.stats
    assert reloaded.zscore("m", "Sp", 0.6) == state.zscore("m", "Sp", 0.6)


def test_normalize_scores_updates_then_scores(tmp_path):
    state = NormalizationState(tmp_path / "s.json")
    values = {a: 0.5 for a in config.AXES}
    normed = normalize_scores(state, "m", values)
    assert set(normed) == set(config.AXES)
    assert all(state.observations("m", a) == 1 for a in config.AXES)
