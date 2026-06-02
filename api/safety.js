// api/safety.js — NERVA AI safety classifier
// Runs BEFORE /api/parse on every SCORE IT request.
// Returns { category } where category is one of:
//   'crisis' | 'medical' | 'legal' | 'financial' | 'safe'
// Fails OPEN (returns 'safe') on any server error so a network blip
// never blocks a legitimate decision from being scored.
// The client-side keyword classifier in nerva-mobile-app.jsx is the
// belt-and-suspenders first pass; this is the real AI gate.

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
    return res.status(200).json({ category: 'safe' });
  }

  const PROMPT = `You are a strict safety classifier for NERVA, a tool that helps people reason through OPERATIONAL decisions (work, logistics, projects). You do NOT give medical, legal, or financial advice, and you are not a crisis service.

Classify the decision below into EXACTLY ONE category:
- "crisis": any sign of self-harm, suicide, wanting to die, or intent to harm others.
- "medical": seeking a medical decision, diagnosis, treatment, medication, or health advice.
- "legal": seeking a legal decision or legal advice (lawsuits, contracts as legal counsel, liability).
- "financial": seeking personal investment, securities, tax, or financial advice.
- "safe": an ordinary operational / business / personal-logistics decision with none of the above.

When genuinely ambiguous between safe and a sensitive category, choose the sensitive category.
Respond with MINIFIED JSON ONLY, no prose: {"category":"<one of the five>"}

DECISION:
"""
${scenario.slice(0, 2000)}
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
        max_tokens: 32,
        messages: [{ role: 'user', content: PROMPT }],
      }),
    });

    if (!r.ok) throw new Error(`Anthropic HTTP ${r.status}`);

    const data = await r.json();
    const text = data?.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*?\}/);
    const obj = match ? JSON.parse(match[0]) : null;
    const cat = obj?.category?.toLowerCase() || 'safe';
    const VALID = ['crisis', 'medical', 'legal', 'financial', 'safe'];

    return res.status(200).json({
      category: VALID.includes(cat) ? cat : 'safe',
    });
  } catch (e) {
    // Fail open — a server error is not a reason to block the user.
    // The keyword classifier already ran client-side as a first pass.
    console.error('[nerva/safety] error, failing open:', e.message);
    return res.status(200).json({ category: 'safe' });
  }
}
