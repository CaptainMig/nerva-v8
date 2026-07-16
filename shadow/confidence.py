"""Derived empirical confidence — ALL the shadow-confidence math lives here.

PLACEHOLDER FORMULA, falsifiable, not final:

    C_empirical = max(0, 1 - k * |delta_composite|)

with k a provisional constant (config.K, default 0.5).

TODO(fit-k): once >= 50 calibrated shadow records exist, fit k (and possibly
the functional form — the current linear ramp is the simplest thing that
could work) against the shadow data. Candidate alternative also worth
testing at that point: composite as weighted MEAN ABSOLUTE per-axis delta
instead of the signed weighted sum below (the signed sum lets opposite-sign
axis disagreements partially cancel).
"""

from shadow import config


def composite_delta(delta_per_axis, weights):
    """Weighted sum of signed per-axis normalized deltas.

    `weights` are the frozen kernel's own per-axis aggregation weights
    (CONF_WEIGHTS), probed from the v11.1-stable blob by the kernel bridge —
    the kernel combines the five axes into r_pure nonlinearly, so these are
    the only explicit axis weights it declares. See SHADOW_NOTES.md.
    """
    return sum(weights[a] * delta_per_axis[a] for a in config.AXES)


def c_empirical(delta_composite, k=config.K):
    """max(0, 1 - k * |delta_composite|) — placeholder, see module docstring."""
    return max(0.0, 1.0 - k * abs(delta_composite))


def r_shadow(c_emp, r_pure):
    """What r_mixed would have been under the empirical confidence.

    The authoritative shadow verdict is NOT derived from this number by
    hand — the harness re-runs the frozen kernel's evaluate() with C forced
    to C_empirical (see kernel_bridge.mjs), and that run's r_mixed equals
    this product by construction. This helper exists for logging and tests.
    """
    return c_emp * r_pure
