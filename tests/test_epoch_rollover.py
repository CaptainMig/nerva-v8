from shadow.shadow_logger import EpochTracker


def test_stable_pair_keeps_run_id(tmp_path):
    t = EpochTracker(tmp_path / "epoch.json")
    a = t.run_id_for("claude-haiku-4-5", "grok-4-0709")
    b = t.run_id_for("claude-haiku-4-5", "grok-4-0709")
    assert a == b
    assert a.startswith("epoch-001-")


def test_model_string_change_rolls_epoch(tmp_path):
    t = EpochTracker(tmp_path / "epoch.json")
    a = t.run_id_for("claude-haiku-4-5", "grok-4-0709")
    b = t.run_id_for("claude-haiku-4-5", "grok-4-0710")   # grok version bump
    c = t.run_id_for("claude-haiku-4-6", "grok-4-0710")   # claude version bump
    assert a != b != c
    assert b.startswith("epoch-002-")
    assert c.startswith("epoch-003-")


def test_epoch_persists_across_instances(tmp_path):
    path = tmp_path / "epoch.json"
    a = EpochTracker(path).run_id_for("m1", "g1")
    # New process, same models: same epoch, same run_id.
    assert EpochTracker(path).run_id_for("m1", "g1") == a
    # New process, new grok version: rolls forward, never reuses.
    b = EpochTracker(path).run_id_for("m1", "g2")
    assert b != a and b.startswith("epoch-002-")
