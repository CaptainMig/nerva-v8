"""Grok second-opinion scorer via the xAI OpenAI-compatible endpoint.

SDK choice (documented in README): the OpenAI-compatible endpoint through the
`openai` package (already a repo dependency), pointed at https://api.x.ai/v1,
using structured outputs (json_schema) — the most stable structured-JSON path
in the xai-cookbook examples and identical plumbing to what this repo already
uses for its other scorers.

Rules enforced here:
- API key from XAI_API_KEY only; never hardcoded, never logged.
- The rubric mirrors api/parse.js VERBATIM (same five axes, same 0-1 scale,
  same field names E,S,R,Sp,St,cE,cS,cR,cSp,cSt). Grok additionally returns a
  per-axis `rationales` object — an addition, not a deviation; keep the shared
  portion in sync with api/parse.js if that file ever changes.
- Model pinning: the exact model string RETURNED by the API is captured on
  every call; the logger uses it for run_id epoch rollover.
- 3 attempts with exponential backoff, then raise GrokError — the caller logs
  the failure and continues. A Grok outage never blocks the primary path.
- Error text is truncated and never includes headers or raw responses.
"""

import json
import os

from openai import OpenAI

from shadow import config

# Keep the shared rubric text in sync with api/parse.js. Only the rationales
# requirement and the reply-format line differ (structured outputs carry the
# schema, but the inline format line is kept so the prompts stay comparable).
RUBRIC_PROMPT = """You are NERVA's scenario parser. Extract 10 numeric parameters (0.0–1.0) from this scenario. Reply with ONLY valid JSON, no markdown, no explanation.

Scenario: "{scenario}"

VALUE parameters (what the numbers are):
- E (urgency): how time-critical? 0=none, 1=maximum
- S (strategy quality): how well-planned? 0=no plan, 1=excellent
- R (risk exposure): how severe is downside? 0=none, 1=catastrophic/irreversible
- Sp (support/evidence): how strong is the evidence base? 0=none, 1=certain
- St (stability): how stable is environment? 0=chaotic, 1=very stable

CONFIDENCE parameters (how well-sourced is each value — infer from language):
- cE: confidence in E — confirmed alert/emergency=0.90, estimated priority=0.60, vague urgency=0.35
- cS: confidence in S — reviewed/tested plan=0.90, working draft=0.65, ad-hoc/unclear=0.35
- cR: confidence in R — measured/instrumented=0.92, assessed/modeled=0.65, assumed/unknown=0.30
- cSp: confidence in Sp — API/sensor/telemetry data=0.93, structured reports/logs=0.70, gut feel/defaults=0.28
- cSt: confidence in St — live monitoring dashboards=0.92, recent manual check=0.65, assumed stable=0.32

Confidence calibration:
- Instrumented/telemetry/sensor/API/live-data source → 0.85–0.95
- Self-reported/estimated/structured-plan → 0.50–0.72
- Vague/missing/assumed/default/unknown → 0.25–0.45
- Degraded comms or partial data → reduce affected confidence by 0.15–0.25
- "Confidence X%" language in scenario → map directly

Value calibration:
- Medical emergencies/life-threat: E=0.90-0.95, R=0.85-0.95, St=0.15-0.35
- Lethal/weapons/surgery: R >= 0.70 minimum
- HFT/trading: E=0.75-0.90, S=0.80-0.95
- AV normal ops: R=0.20-0.45, St=0.65-0.85
- Comms degraded/personnel unavailable: St=0.15-0.40
- AI-owned/automated process: Sp=0.45-0.65
- 24h commitment window: R >= 0.55

Also include "rationales": one short sentence per VALUE axis (keys E, S, R, Sp, St) explaining the assigned value.

Reply format (JSON only): {{"E":0.00,"S":0.00,"R":0.00,"Sp":0.00,"St":0.00,"cE":0.00,"cS":0.00,"cR":0.00,"cSp":0.00,"cSt":0.00,"rationales":{{"E":"...","S":"...","R":"...","Sp":"...","St":"..."}}}}"""

_NUM = {"type": "number", "minimum": 0, "maximum": 1}
RESPONSE_SCHEMA = {
    "name": "nerva_axis_scores",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "E": _NUM, "S": _NUM, "R": _NUM, "Sp": _NUM, "St": _NUM,
            "cE": _NUM, "cS": _NUM, "cR": _NUM, "cSp": _NUM, "cSt": _NUM,
            "rationales": {
                "type": "object",
                "properties": {a: {"type": "string"} for a in config.AXES},
                "required": list(config.AXES),
                "additionalProperties": False,
            },
        },
        "required": ["E", "S", "R", "Sp", "St", "cE", "cS", "cR", "cSp", "cSt", "rationales"],
        "additionalProperties": False,
    },
}


class GrokError(Exception):
    """Grok scoring failed after all attempts. Message is sanitized."""


class GrokScore:
    def __init__(self, values, confidences, rationales, model):
        self.values = values            # {E,S,R,Sp,St} clamped to [0,1]
        self.confidences = confidences  # {E,S,R,Sp,St} clamped to [0,1]
        self.rationales = rationales    # {axis: str}
        self.model = model              # EXACT model string returned by the API


def _clamp(x):
    try:
        return max(0.0, min(1.0, float(x)))
    except (TypeError, ValueError):
        return 0.0


class GrokClient:
    def __init__(self, api_key=None, model=config.GROK_MODEL,
                 base_url=config.XAI_BASE_URL, timeout=config.GROK_TIMEOUT_S,
                 max_attempts=config.GROK_MAX_ATTEMPTS,
                 backoff_base_s=config.GROK_BACKOFF_BASE_S, sleep=None):
        key = api_key or os.environ.get("XAI_API_KEY")
        if not key:
            raise GrokError("XAI_API_KEY is not set")
        self.model = model
        self.max_attempts = max_attempts
        self.backoff_base_s = backoff_base_s
        if sleep is None:
            import time
            sleep = time.sleep
        self._sleep = sleep
        self._client = OpenAI(api_key=key, base_url=base_url,
                              timeout=timeout, max_retries=0)

    def score(self, scenario):
        """Score one scenario. Returns GrokScore or raises GrokError."""
        last_err = None
        for attempt in range(self.max_attempts):
            if attempt:
                self._sleep(self.backoff_base_s * (2 ** (attempt - 1)))
            try:
                resp = self._client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user",
                               "content": RUBRIC_PROMPT.format(scenario=scenario)}],
                    response_format={"type": "json_schema",
                                     "json_schema": RESPONSE_SCHEMA},
                )
                parsed = json.loads(resp.choices[0].message.content)
                return GrokScore(
                    values={a: _clamp(parsed.get(a)) for a in config.AXES},
                    confidences={a: _clamp(parsed.get("c" + a)) for a in config.AXES},
                    rationales={a: str(parsed.get("rationales", {}).get(a, ""))
                                for a in config.AXES},
                    model=resp.model,
                )
            except Exception as e:  # noqa: BLE001 — sanitized and re-raised below
                last_err = "%s: %s" % (type(e).__name__, str(e)[:300])
        raise GrokError("grok scoring failed after %d attempts — %s"
                        % (self.max_attempts, last_err))
