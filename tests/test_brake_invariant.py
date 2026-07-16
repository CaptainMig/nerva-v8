"""One-Way Brake invariant stub: agreement NEVER releases a tripped brake."""

import pytest

from shadow.brake import can_release_brake

STATES = [
    {"verdict": "ESCALATE", "one_way_brake": True},
    {"verdict": "HOLD", "low_confidence_brake": True},
    {"verdict": "WAIT"},
    {"verdict": "TOXIC", "toxic_veto": True},
    None,
]
AGREEMENTS = [
    {"delta_composite": 0.0, "c_empirical": 1.0},   # perfect agreement
    {"delta_composite": 0.001, "c_empirical": 0.9995},
    {"agree_streak": 1_000_000},
    True,
    None,
]


@pytest.mark.parametrize("prior_state", STATES)
@pytest.mark.parametrize("new_agreement", AGREEMENTS)
def test_agreement_never_releases_brake(prior_state, new_agreement):
    assert can_release_brake(prior_state, new_agreement) is False
