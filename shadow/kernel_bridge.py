"""Python side of the frozen-kernel bridge.

Spawns node on shadow/kernel_bridge.mjs, which executes nerva-v11-core.jsx
from the v11.1-stable tag blob (never the working tree) and returns, per
record, the frozen evaluate() result and — when c_empirical is supplied —
the same frozen evaluate() re-run with aggregate C forced to C_empirical.
No kernel math or verdict logic exists on the Python side.
"""

import json
import subprocess
from pathlib import Path

BRIDGE_MJS = Path(__file__).resolve().parent / "kernel_bridge.mjs"


class KernelBridgeError(RuntimeError):
    pass


def evaluate_batch(records, kernel_ref=None):
    """records: [{values, confidences, opts?, c_empirical?}] -> bridge output dict.

    Returns {kernel_ref, kernel_blob_sha, conf_weights, results:[{record, shadow}]}.
    """
    env = None
    if kernel_ref is not None:
        import os
        env = dict(os.environ, NERVA_KERNEL_REF=kernel_ref)
    proc = subprocess.run(
        ["node", str(BRIDGE_MJS)],
        input=json.dumps({"records": records}),
        capture_output=True,
        text=True,
        env=env,
    )
    if proc.returncode != 0:
        raise KernelBridgeError(
            "kernel bridge failed (exit %d): %s" % (proc.returncode, proc.stderr.strip())
        )
    return json.loads(proc.stdout)
