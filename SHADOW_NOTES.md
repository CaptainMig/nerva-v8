# SHADOW_NOTES — provisional constants and protocol decisions

Every number here is provisional. This file records what was chosen, why, and
what would replace it. Nothing in this document is a claim of lift.

## Provisional constants

| Constant | Value | Where | Why provisional |
|---|---|---|---|
| `SHADOW_BAND` | 0.10 | `shadow/config.py` | Full-parallel band around τ (`\|r_mixed − τ\| ≤ 0.10`). Picked so borderline verdicts — where a second opinion matters most — always get dual-scored. No data yet on whether ±0.10 captures the actual verdict-flip zone; revisit once the shadow log shows where flips concentrate. |
| `SHADOW_SAMPLE_RATE` | 0.10 | `shadow/config.py` | Baseline sampling of clear cases so agreement statistics aren't conditioned on borderline inputs only. 10% is a budget guess, not a power calculation. |
| `K` | 0.5 | `shadow/config.py`, used in `shadow/confidence.py` | `C_empirical = max(0, 1 − k·\|Δ_composite\|)` is a placeholder with a linear ramp. `k = 0.5` means a composite disagreement of 2σ-weighted units zeroes confidence. TODO(fit-k): fit `k` — and re-examine the functional form — against ≥50 calibrated shadow records. |
| `WARMUP_N` | 30 | `shadow/config.py` | Minimum observations per model per axis before z-scores are trusted (`calibrated: true`). 30 is the usual rule-of-thumb floor for a running σ, nothing more. Pre-warm-up records are logged but flagged `calibrated: false` and excluded from analysis. |
| `DISAGREE_Z` | 1.0 | `shadow/analyze_shadow.py` | An axis "disagreement" is a calibrated \|z-delta\| > 1.0. Pure reporting threshold; tune when the delta distribution is visible. |

## Protocol decisions (and their caveats)

### Composite Δ weights come from the kernel's CONF_WEIGHTS
The prompt suggested 0.30/0.25/0.20/0.15/0.10 legacy weights; per decision,
we instead use how the frozen kernel itself weights the axes. Finding: the
kernel combines the five axes into `r_pure` **nonlinearly**
(`r_x=(E+S)/2√3`, `r_y=R/√3`, `r_z=(Sp·St)/√3`), so no linear axis weights
exist for `r_pure`. The only explicit per-axis weights the kernel declares
are `CONF_WEIGHTS = {E:0.15, S:0.15, R:0.15, Sp:0.275, St:0.275}` — its own
confidence-aggregation weights. Δ_composite uses those. They are probed at
runtime from the `v11.1-stable` blob by the bridge (unit-vector probes of the
frozen `aggConfidence`), never hardcoded in shadow code.

### Δ_composite is a signed weighted sum
Opposite-direction disagreements on different axes partially cancel. That is
deliberate for the placeholder (it inherits the spec's `\|Δ_composite\|`
shape) but a weighted **mean absolute** delta is the obvious alternative to
test during the k-fitting pass. A unit test pins the cancellation behavior
so it stays a documented choice, not an accident.

### Normalization updates before scoring
Each observation updates the per-model running mean/σ (Welford) first, then
is z-scored against the updated distribution. Including the current
observation slightly shrinks early z-scores, but every affected record is
pre-warm-up and flagged `calibrated: false`, so analysis never sees the bias.

### Normalization state only updates when both scorers succeed
On a Grok failure the record is logged with `grok_error` set and **neither**
model's running distribution is updated, so both distributions accumulate
observations at the same rate over the same inputs.

### Trigger band uses the verdict-of-record geometry
Band membership is `|r_mixed − τ| ≤ SHADOW_BAND` computed from the frozen
kernel's record run (mixed r, record τ) — i.e. distance from the actual
decision boundary of the verdict of record.

### Shadow verdict: frozen kernel with C forced to C_empirical
The shadow verdict is not derived by hand. The bridge re-runs the frozen
`evaluate()` with `aggConfidence` overridden to return `C_empirical`, so
`r_shadow = C_empirical · r_pure`, the τ entropy term, and the HOLD/WAIT
confidence gate all move together, computed by v11.1-stable bytes. Note the
per-axis confidences of record (`c_Sp`, `c_St`) still drive the brake checks;
only the aggregate C is replaced. The One-Way Brake / toxic-veto / emergency
pre-pipeline does not depend on C, so those overrides are identical in both
worlds by construction.

### Epoch rollover
`run_id` is derived from the **exact** model strings returned by both APIs.
Any change to either string opens a new epoch (`epoch-NNN-<hash8>`), and
`analyze_shadow.py` warns when a log set spans epochs. Pooled statistics
across an epoch boundary are invalid.
