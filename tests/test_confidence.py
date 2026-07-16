import math

from shadow import config
from shadow.confidence import c_empirical, composite_delta, r_shadow

KERNEL_WEIGHTS = {"E": 0.15, "S": 0.15, "R": 0.15, "Sp": 0.275, "St": 0.275}


def test_c_empirical_perfect_agreement():
    assert c_empirical(0.0) == 1.0


def test_c_empirical_linear_ramp_and_floor():
    assert math.isclose(c_empirical(1.0, k=0.5), 0.5)
    assert math.isclose(c_empirical(-1.0, k=0.5), 0.5)      # symmetric in |delta|
    assert c_empirical(10.0, k=0.5) == 0.0                  # floored at 0
    assert math.isclose(c_empirical(1.0, k=0.25), 0.75)     # k scales the ramp


def test_composite_delta_weighted_sum():
    delta = {"E": 1.0, "S": 0.0, "R": 0.0, "Sp": 0.0, "St": 0.0}
    assert math.isclose(composite_delta(delta, KERNEL_WEIGHTS), 0.15)
    delta = {a: 1.0 for a in config.AXES}
    assert math.isclose(composite_delta(delta, KERNEL_WEIGHTS), 1.0)


def test_composite_delta_signed_cancellation_documented_behavior():
    # Opposite-sign disagreements partially cancel — deliberate placeholder
    # behavior, flagged for the k-fitting pass (see confidence.py docstring).
    delta = {"E": 1.0, "S": -1.0, "R": 0.0, "Sp": 0.0, "St": 0.0}
    assert math.isclose(composite_delta(delta, KERNEL_WEIGHTS), 0.0)


def test_r_shadow_is_shrunk_r_pure():
    assert math.isclose(r_shadow(0.3, 0.5239316622105088), 0.15717949866315264)
    assert r_shadow(0.0, 0.9) == 0.0
