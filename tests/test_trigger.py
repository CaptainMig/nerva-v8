import random

from shadow.harness import decide_trigger


class NeverSample:
    def random(self):
        return 1.0


class AlwaysSample:
    def random(self):
        return 0.0


def test_band_trigger_inside_and_at_edge():
    rng = NeverSample()
    assert decide_trigger(0.50, 0.45, rng, band=0.10) == "band"
    assert decide_trigger(0.45, 0.50, rng, band=0.10) == "band"   # symmetric
    # Exactly at the edge, with binary-representable values (0.55 - 0.45
    # lands a float ulp above 0.10, which would test float noise, not logic).
    assert decide_trigger(0.5, 0.375, rng, band=0.125) == "band"
    assert decide_trigger(0.5501, 0.45, rng, band=0.10) is None   # just outside


def test_sample_trigger_outside_band():
    assert decide_trigger(0.9, 0.3, AlwaysSample(), band=0.10) == "sample"
    assert decide_trigger(0.9, 0.3, NeverSample(), band=0.10) is None


def test_band_takes_precedence_over_sampling():
    assert decide_trigger(0.5, 0.5, AlwaysSample(), band=0.10) == "band"


def test_sample_rate_statistics():
    rng = random.Random(42)
    n = 20_000
    hits = sum(1 for _ in range(n)
               if decide_trigger(0.9, 0.3, rng, band=0.10, sample_rate=0.10) == "sample")
    assert 0.09 < hits / n < 0.11
