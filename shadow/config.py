"""Shadow-track configuration. Every constant here is PROVISIONAL — see
SHADOW_NOTES.md for why each value was chosen and what would change it."""

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# The five kernel axes, in the order api/parse.js emits them.
AXES = ["E", "S", "R", "Sp", "St"]

# Frozen kernel reference. The bridge executes this tag's blob of
# nerva-v11-core.jsx, never the working-tree file.
KERNEL_REF = os.environ.get("NERVA_KERNEL_REF", "v11.1-stable")

# --- Trigger (provisional) ---------------------------------------------------
# Full-parallel band: run Grok whenever |r_mixed - tau| <= SHADOW_BAND.
SHADOW_BAND = 0.10
# Outside the band, sample this fraction so clear cases still accumulate
# baseline agreement data.
SHADOW_SAMPLE_RATE = 0.10

# --- Normalization (provisional) ---------------------------------------------
# Minimum observations per model per axis before deltas are calibrated.
WARMUP_N = 30

# --- Derived confidence (placeholder — to be fit against shadow data) --------
# C_empirical = max(0, 1 - K * |delta_composite|). Lives in confidence.py.
K = 0.5

# --- Models -------------------------------------------------------------------
# Aliases used for the REQUEST only. The exact versioned model string returned
# by each API is what gets logged and what drives run_id epoch rollover.
GROK_MODEL = os.environ.get("SHADOW_GROK_MODEL", "grok-4")
XAI_BASE_URL = os.environ.get("XAI_BASE_URL", "https://api.x.ai/v1")
# Matches the model deployed in api/parse.js.
CLAUDE_MODEL_DEFAULT = "claude-haiku-4-5"

GROK_MAX_ATTEMPTS = 3          # then log the failure and continue
GROK_BACKOFF_BASE_S = 1.0      # 1s, 2s, 4s
GROK_TIMEOUT_S = 60.0

# --- Paths ---------------------------------------------------------------------
SHADOW_LOGS_DIR = REPO_ROOT / "shadow_logs"
STATE_DIR = REPO_ROOT / "shadow" / "state"
