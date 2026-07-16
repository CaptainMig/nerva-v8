"""One-Way Brake invariant for any FUTURE promotion of the dual scorer.

Nothing consumes shadow output in this phase. This module exists so the
invariant is encoded in code and pinned by a unit test from day one:

    In any future promotion, Grok dissent may REDUCE C or ESCALATE a verdict
    toward HOLD / WAIT / CONSULT (the frozen kernel emits the string
    'ESCALATE' for that verdict — see README).  Subsequent agreement must
    NEVER release a tripped brake or upgrade a verdict.

Dissent is a one-way ratchet within a decision's lifetime: once the shadow
scorer has tightened a verdict, later agreement between the scorers is not
evidence that the tightening was wrong — it is only the absence of further
dissent. Releasing the brake on agreement would let an oscillating scorer
pump a verdict back up, which is exactly the failure mode the brake exists
to prevent.
"""


def can_release_brake(prior_state, new_agreement):
    """Whether new inter-scorer agreement may release a previously tripped
    brake or upgrade a previously escalated verdict.

    By invariant: never. This function is the enforcement point for any
    future promotion wiring; it takes its arguments only so call sites are
    forced to articulate what they wanted to release, and it ignores them.
    """
    return False
