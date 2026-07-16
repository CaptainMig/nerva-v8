# NERVA v10 · Decision Integrity Platform

**A runtime decision-gating layer for AI agentic systems and human operators.**

NERVA sits between reasoning and high-stakes action. Returns one of five structured verdicts — **COMMIT · HOLD · WAIT · CONSULT · TOXIC** — against five published axes, with full provenance. Every gated decision is written to an auditable ledger.

This repo is the live cockpit platform. The current primary surface is **NERVA v11 · Mixed-State Decision Integrity Cockpit** — the instrument that exposes the full audit cluster and serves as the operational deployment for high-stakes governance.

→ Live platform: [nerva-v10.vercel.app](https://nerva-v10.vercel.app)
→ Primary instrument: [nerva-v10.vercel.app/v11.html](https://nerva-v10.vercel.app/v11.html)

---

## What it is

The NERVA platform is the operator-facing surface for the decision-gating kernel. Built for two distinct buyers:

- **AI infrastructure teams** deploying agentic systems where decisions need to be gated before action — the cockpit sits one layer above operational observability and writes a separate decision-integrity trace
- **Human operators** running high-stakes decisions (capital allocation, vendor selection, hiring, strategy commitments) who want a structured brake with provenance

The cockpit is the visualization. The kernel is the math. The ledger is the memory. The discipline is the product.

---

## NERVA v11 · The primary cockpit

**v11 is the production instrument.** The earlier view modes (A through D) shipped during the development of the kernel's visual vocabulary; v11 is what the platform was building toward and is the surface that should be evaluated when assessing NERVA as a governance instrument.

### What v11 adds

v11 is the **mixed-state cockpit** — the full implementation of the Bloch-vector representation, the von Neumann entropy calculation, and the adaptive threshold logic, surfaced through an operator-facing instrument cluster.

The cluster exposes five sub-panels in Audit mode:

| Panel | What it surfaces |
|---|---|
| `<QLT>` Quality Metrics | Purity, entropy, margin, brake gap, reversibility, homogeneity — six kernel diagnostics, all computable from the values the kernel already produces |
| `<MAP>` Phase Map | The (C, clarity) coordinate plotted against the four non-TOXIC verdict regions — instant visual read of where the decision sits in state space |
| `<FAC>` Factors | Signed bars showing cᵢ − 0.5 for each axis — makes the structural shape of the verdict legible at a glance |
| `<SEN>` Sensitivity | Perturbation analysis: how much a +0.1 change to each axis moves aggregate confidence, and whether the verdict flips — names the binding constraint and the operational lever |
| `<LOG>` Agent Log | Execution trace of the kernel's eight-step pipeline — parse, extract, brake check, Bloch projection, compute, verdict, audit, route |

### What v11 supports

- **Summary / Audit mode toggle** — daily-use view collapses to the verdict, metrics, and reasoning; audit view exposes the full instrument cluster for high-stakes deliberation
- **The One-Way Brake** — high-stakes irreversible decisions with insufficient margin are routed to WAIT regardless of other conditions, with the brake state surfaced on the masthead
- **TOXIC refusal** — five published refuse categories (non-consenting third-party harm, undisclosed MNPI, decisions made for others who should be making them themselves, active-crisis signals, deceptive theses) — NERVA returns no verdict for these
- **Receipt provenance** — every scored decision produces a signed receipt with a unique hash for ledger ingestion

### Why v11 over the other modes

The four earlier modes share the same kernel but expose different visual surfaces. They remain available on the platform for design reference and for users who prefer the stripped or alternative readouts. **v11 is the surface the kernel was designed to fully express, and is the surface a pilot deployment would run.**

---

## The full platform surface

| Mode | Status | What it shows |
|---|---|---|
| **v11 · Mixed-State Cockpit** | Production | Full instrument cluster, Summary/Audit toggle, primary deployment surface |
| **A · Cockpit** | Reference | Original verdict card layout — masthead, verdict word, metrics, Bloch projection, reasoning, provenance |
| **B · Terminal** | Reference | Monospace operator view for keyboard-driven decision intake |
| **C · Phase Space** | Reference | Phase-map visualization isolated from full card chrome |
| **D · Brutalist** | Reference | Stripped instrument-readout for high-density display environments |

All modes run the same NERVA kernel. The math does not change between views.

---

## Applications running on the platform

- **[Plumb](https://nerva-v10.vercel.app/plumb.html)** — three-layer buyside audit for media investment. Scores Optimization, Authenticity, and Pricing independently. Designed to catch the ad buy that looks great on distribution metrics and fails on cultural authenticity. Runs the NERVA kernel against media-domain-specific axis weights.

- **[Data Field](https://nerva-v10.vercel.app/data-field.html)** — operator data view for live decision feeds. Demonstrates how the platform handles streaming decision intake at scale.

---

## The kernel

The NERVA kernel maps decisions onto a Bloch vector representation and computes confidence as a mixed-state purity measure. Five axes with default weights:

```
c_evidence        × 0.30
c_differentiation × 0.25
c_falsifiability  × 0.20
c_timing          × 0.15
c_alignment       × 0.10
```

Aggregate confidence `C = Σ wᵢcᵢ`. Density matrix `ρ = ½(I + r_eff · σ)`. Von Neumann entropy `S(ρ)` measures the spread between directional conviction and evidence structure. Adaptive threshold `τ = τ₀ + α·S + β·σ_stakes + γ·irreversibility` scales with stakes and reversibility.

A decision clears the threshold when `C ≥ τ`. Verdict state is then determined by entropy (COMMIT vs HOLD), brake conditions (the One-Way Brake on high-stakes irreversible commits), and TOXIC refusal categories.

The math is published in full. The reference implementation lives at [CaptainMig/Nerva_Prompt_Universal](https://github.com/CaptainMig/Nerva_Prompt_Universal) and runs deterministically in Python for verification when the verdict matters.

---

## Two deployment paths

**Cockpit platform (this repo)** — operator-facing visualization for human decision workflows. Static HTML, no server, browser-local state. Suitable for personal use, pilot deployments, and demonstration of the methodology.

**Agentic runtime layer (in pilot scoping)** — SDK and API for AI agentic systems where decisions need to be gated programmatically before action commits. NERVA sits between agent reasoning and the action layer, scores the agent's stated reasoning structure against the same five axes, and routes by verdict state. COMMIT decisions flow normally; HOLD, CONSULT, and TOXIC are routed to operator review or refused. Every gated decision is written to a decision-integrity audit ledger separate from operational telemetry.

The cockpit is what you can see today. v11 is the surface that demonstrates what the runtime layer enforces programmatically. The runtime layer is what enterprises buy.

---

## What this is not

NERVA does not predict outcomes. NERVA evaluates the structural integrity of stated reasoning before commitment. The kernel scores *claims*, not *credentials*; *structure*, not *narrative*.

The lift score — the empirical hit-rate of decisions that followed NERVA versus decisions that overrode it — is computed only from resolved outcomes in the ledger. It is never extrapolated forward. The willingness to be falsified is the product.

---

## Status

- **v11 cockpit:** Production, deployed, primary surface
- **Reference modes A–D:** Stable, available for design reference
- **Plumb application:** Deployed, pilot proposal v1.0 published
- **Reference kernel (Python):** Deterministic implementation available in companion repo
- **Agentic runtime layer:** In pilot scoping, not yet generally available
- **Pilot inquiries:** Welcome — see Starpoint LLC contact below

---

## Built by

[Starpoint LLC](https://www.linkedin.com/in/amigliazzo/) · Solo technical founder building a decision-integrity layer for AI agentic systems and human operators.

**Related repos:**
- [Nerva_Prompt_Universal](https://github.com/CaptainMig/Nerva_Prompt_Universal) — portable methodology kit, reference kernel, audit ledger
- [NERVA_Agentic_Shopping_Assistant](https://github.com/CaptainMig/NERVA_Agentic_Shopping_Assistant) — NERVA layered into agentic commerce
- [plumb](https://github.com/CaptainMig/plumb) — three-layer buyside audit pilot proposal

---

*NERVA v10 platform · v11 primary instrument · Starpoint LLC · patent pending*

---

## Dual-Scorer Shadow Track (branch `shadow/dual-scorer`)

Shadow-mode evaluation only: Grok (xAI) runs as a second-opinion scorer in
parallel with the primary path on the same inputs, logging everything and
changing nothing. **Verdicts of record come from the frozen `v11.1-stable`
kernel only** — the shadow track never touches kernel math, τ, verdict logic,
Examen, or any deployed Vercel surface, and nothing downstream consumes its
output in this phase. Instrumentation, not integration.

### How the kernel stays frozen
`shadow/kernel_bridge.mjs` executes `nerva-v11-core.jsx` **from the
`v11.1-stable` tag blob** (`git show v11.1-stable:nerva-v11-core.jsx`), never
from the working tree. Editing the JSX on this branch cannot change shadow
results; every record carries `kernel_ref` and `kernel_blob_sha`.

### SDK choice
Grok is called through the **xAI OpenAI-compatible endpoint**
(`https://api.x.ai/v1`) via the `openai` package with structured outputs
(`json_schema`) — the most stable structured-JSON path shown in the
xai-cookbook examples, and the same plumbing this repo already uses. The
rubric mirrors `api/parse.js` verbatim (axes E/S/R/Sp/St + per-axis
confidences); Grok additionally returns per-axis rationales.

### Setup
```bash
cp .env.example .env        # set XAI_API_KEY (never committed)
pip install openai pytest
python3 -m pytest tests/ -q
python3 -m shadow.harness inputs.jsonl        # parse.js-shaped JSONL + scenario text
python3 -m shadow.analyze_shadow              # report over shadow_logs/
```
Logs are append-only JSONL in `shadow_logs/YYYY-MM-DD.jsonl` (gitignored).
API keys and raw API responses are never logged. Exact model version strings
are logged on every call; if either model string changes, the `run_id` epoch
rolls and statistics must not be pooled across the boundary.

### Verdict vocabulary
The frozen kernel emits `ESCALATE`; current product copy calls the same
verdict `CONSULT`. Shadow logs record what the kernel says — read
`ESCALATE` in logs as `CONSULT` in copy.

### Promotion gate (documented, not implemented)
No promotion decision before **50 calibrated shadow-scored inputs**, of which
at least **10 low-C cases (`C_empirical < 0.7`) have been human-reviewed**.
Until then the dual scorer makes no claims of lift — it adds provenance, not
prediction. Provisional constants and protocol caveats: see
[SHADOW_NOTES.md](SHADOW_NOTES.md).

### One-Way Brake invariant
In any future promotion, Grok dissent may reduce C or escalate a verdict
toward HOLD/WAIT/CONSULT; **subsequent agreement must never release a tripped
brake or upgrade a verdict**. Encoded in `shadow/brake.py`
(`can_release_brake(...)` always returns `False`) and pinned by
`tests/test_brake_invariant.py`.
