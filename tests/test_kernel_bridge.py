"""Bridge tests — require node and the v11.1-stable tag (both exist on this
branch by construction)."""

import math
import shutil
import subprocess

import pytest

from shadow import config, kernel_bridge

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="node not available")

# Presets lifted from the frozen kernel's own V11_SCENARIOS.
CLEAN_COMMIT = {
    "values": {"E": 0.35, "S": 0.86, "R": 0.22, "Sp": 0.82, "St": 0.78},
    "confidences": {"E": 0.95, "S": 0.95, "R": 0.93, "Sp": 0.97, "St": 0.96},
}
TOXIC = {
    "values": {"E": 0.82, "S": 0.74, "R": 0.78, "Sp": 0.18, "St": 0.22},
    "confidences": {"E": 0.86, "S": 0.84, "R": 0.92, "Sp": 0.74, "St": 0.72},
}


def test_record_verdicts_match_kernel_presets():
    out = kernel_bridge.evaluate_batch([CLEAN_COMMIT, TOXIC])
    assert out["results"][0]["record"]["decision"] == "COMMIT"
    assert out["results"][1]["record"]["decision"] == "TOXIC"
    assert out["results"][1]["record"]["flags"]["toxic_veto"] is True


def test_conf_weights_probed_from_frozen_kernel():
    out = kernel_bridge.evaluate_batch([])
    w = out["conf_weights"]
    assert set(w) == set(config.AXES)
    assert math.isclose(sum(w.values()), 1.0, rel_tol=1e-9)
    # Kernel weights integrity axes (Sp, St) heavier than E/S/R.
    assert w["Sp"] == w["St"] > w["E"] == w["S"] == w["R"]


def test_shadow_run_forces_c_empirical():
    c_emp = 0.3
    req = dict(CLEAN_COMMIT, c_empirical=c_emp)
    res = kernel_bridge.evaluate_batch([req])["results"][0]
    record, shadow = res["record"], res["shadow"]
    # r_shadow = C_empirical * r_pure, computed by the frozen kernel itself.
    assert math.isclose(shadow["bloch"]["magnitude"],
                        c_emp * record["bloch_pure"]["magnitude"], rel_tol=1e-9)
    assert math.isclose(shadow["aggregate_C"], c_emp, rel_tol=1e-9)
    # Collapsed confidence downgrades this COMMIT in the shadow world.
    assert record["decision"] == "COMMIT"
    assert shadow["decision"] in ("HOLD", "WAIT")


def test_no_shadow_eval_without_c_empirical():
    res = kernel_bridge.evaluate_batch([CLEAN_COMMIT])["results"][0]
    assert res["shadow"] is None


def test_bridge_executes_tagged_blob_not_working_tree():
    out = kernel_bridge.evaluate_batch([])
    assert out["kernel_ref"] == "v11.1-stable"
    tagged_blob = subprocess.run(
        ["git", "rev-parse", "v11.1-stable:nerva-v11-core.jsx"],
        cwd=config.REPO_ROOT, capture_output=True, text=True, check=True,
    ).stdout.strip()
    assert out["kernel_blob_sha"] == tagged_blob
