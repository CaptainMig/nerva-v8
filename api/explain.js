module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method !== "POST")
      return res.status(405).json({ error: "POST only" });

    const { scenario } = req.body || {};
    if (!scenario || !scenario.trim())
      return res.status(400).json({ error: "Missing scenario" });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const systemPrompt = `You are the NERVA 6D Extractor. Your job is to read a natural-language scenario and extract six numerical parameters (each 0.00 to 1.00).

The six parameters:
- urgency: How time-sensitive or emotionally charged is this? 0 = no rush, 1 = act now or lives lost
- strategy: How clear and well-formed is the plan? 0 = no plan/improvising, 1 = detailed protocol in place
- risk: How much exposure to negative outcomes? 0 = no downside, 1 = catastrophic/lethal consequences
- support: How strong is the evidence/data? 0 = guessing/no data, 1 = confirmed by multiple reliable sources
- stability: How stable are conditions? 0 = everything falling apart, 1 = calm and predictable

Also infer these secondary signals (each 0.00 to 1.00):
- irreversibility: Can this be undone? 0 = fully reversible, 1 = permanent/lethal
- stakes: How much is on the line? 0 = trivial, 1 = existential
- time_pressure: How much does delay cost? 0 = can wait forever, 1 = seconds matter

Rules:
- Be conservative. If the scenario is ambiguous, default toward 0.50.
- Never hallucinate details not in the scenario.
- Include a brief "reasoning" string (1-2 sentences) explaining your extraction logic.

Respond with ONLY valid JSON. No markdown, no backticks, no explanation outside the JSON.

Example output:
{"urgency":0.80,"strategy":0.40,"risk":0.85,"support":0.35,"stability":0.60,"irreversibility":0.90,"stakes":0.85,"time_pressure":0.70,"reasoning":"High urgency military scenario with weak intelligence and significant lethal risk."}`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: scenario.trim() },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(502).json({ error: "openai_error", status: resp.status, details: errText });
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    const clean = text.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: "extract_failed", details: String(e) });
  }
};
