// api/parse.js — NERVA AI scenario parser
// Takes { scenario: string } and returns the five v11 input values
// plus five confidence scores, inferred from the scenario text.
// Model: claude-opus-4-8

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { scenario } = req.body || {};
  if (!scenario || typeof scenario !== 'string') {
    return res.status(400).json({ error: 'scenario required' });
  }

  const PROMPT = `You are an expert decision analyst for NERVA, a decision-gate system.
Given the scenario below, infer values for all ten fields (five point estimates + five confidence scores).

FIELDS — return all ten, values between 0 and 1:
  E   = Urgency: how time-pressured is this? (0=none, 1=extreme)
  S   = Strategy: how well-planned is the approach? (0=none, 1=excellent)
  R   = Risk: how bad could the downside be? (0=none, 1=catastrophic)
  Sp  = Support: how solid is the evidence / backing? (0=none, 1=rock-solid)
  St  = Stability: how stable is the surrounding situation? (0=volatile, 1=very stable)
  cE  = confidence in your E estimate (0=guessing, 1=certain)
  cS  = confidence in your S estimate
  cR  = confidence in your R estimate
  cSp = confidence in your Sp estimate
  cSt = confidence in your St estimate

CONFIDENCE GUIDE: if you had to infer the value from vague text, set confidence low (0.2–0.4).
If the scenario gives clear evidence for a field, set confidence high (0.75–0.95).
If a field is genuinely ambiguous, set it near 0.5 with low confidence.

Respond with MINIFIED JSON ONLY — no prose, no markdown:
{"E":0.0,"S":0.0,"R":0.0,"Sp":0.0,"St":0.0,"cE":0.0,"cS":0.0,"cR":0.0,"cSp":0.0,"cSt":0.0}

SCENARIO:
"""
${scenario.slice(0, 3000)}
"""`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 128,
        messages: [{ role: 'user', content: PROMPT }],
      }),
    });

    if (!r.ok) throw new Error(`Anthropic HTTP ${r.status}`);

    const data = await r.json();
    const text = data?.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error('No JSON in response');

    const parsed = JSON.parse(match[0]);

    // Clamp all values to [0, 1]
    const clamp = (x) => Math.max(0, Math.min(1, parseFloat(x) || 0));
    return res.status(200).json({
      E:   clamp(parsed.E),
      S:   clamp(parsed.S),
      R:   clamp(parsed.R),
      Sp:  clamp(parsed.Sp),
      St:  clamp(parsed.St),
      cE:  clamp(parsed.cE),
      cS:  clamp(parsed.cS),
      cR:  clamp(parsed.cR),
      cSp: clamp(parsed.cSp),
      cSt: clamp(parsed.cSt),
    });
  } catch (e) {
    console.error('[nerva/parse] error:', e.message);
    return res.status(500).json({ error: 'parse failed' });
  }
}
