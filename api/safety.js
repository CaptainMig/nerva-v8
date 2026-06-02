// api/safety.js — NERVA safety classifier endpoint.
// POST { scenario } → { category: "crisis"|"medical"|"legal"|"financial"|"safe" }
// Uses claude-opus-4-8 (same model as /api/parse).
// Fast: focused prompt, max_tokens 32 — only needs a tiny JSON object.
// Returns 500 on any AI/parse failure; the client treats that as fail-closed.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { scenario } = req.body || {};
  if (!scenario || !scenario.trim()) return res.status(400).json({ error: 'No scenario provided' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 32,
        messages: [{
          role: 'user',
          content: `You are NERVA's safety classifier. Classify the scenario into exactly one category and reply with ONLY valid JSON, no markdown, no explanation.

Scenario: "${scenario.replace(/"/g, '\\"')}"

Categories:
- "crisis"    — explicit suicidal ideation, self-harm intent, or active personal safety emergency
- "medical"   — seeking personal medical diagnosis or treatment advice for oneself
- "legal"     — seeking legal counsel for the user's own specific case
- "financial" — seeking personal investment, tax, or financial advice for oneself
- "safe"      — an operational or personal decision; NERVA is the right tool

Operational decisions involving risk, stakes, or uncertainty — including decisions a professional makes in their own domain — are "safe". Only flag content where this tool would actively cause harm by engaging.

Reply format: {"category":"<value>"}`,
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', response.status, err);
      return res.status(500).json({ error: 'Upstream error', status: response.status });
    }

    const data = await response.json();
    const raw = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);

    const VALID = ['crisis', 'medical', 'legal', 'financial', 'safe'];
    if (!VALID.includes(parsed.category)) {
      console.error('Unexpected category:', parsed.category);
      return res.status(500).json({ error: 'Unexpected category', raw });
    }

    return res.status(200).json({ category: parsed.category });
  } catch (err) {
    console.error('Safety check error:', err);
    return res.status(500).json({ error: 'Safety check failed', detail: err.message });
  }
}
