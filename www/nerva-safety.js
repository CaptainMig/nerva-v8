// nerva-safety.js — client-side safety gate for NERVA mobile.
// Two-stage: (1) instant keyword pre-screen, (2) AI verification via /api/safety.
//
// CONTRACT:
//   checkSafety(text) → Promise<'crisis'|'professional'|'safe'>
//   - Returns 'crisis' or 'professional' if flagged (keyword OR AI).
//   - Returns 'safe' if the AI clears it.
//   - THROWS on any endpoint error, timeout, or malformed/unknown response.
//     The caller MUST catch and show the stop screen — this is the fail-closed
//     guarantee. A network error should never silently let flagged content through.
//
// SERVER NOTE — /api/safety  (POST)
//   Request:  { "scenario": "<user text>" }
//   Response: { "category": "crisis"|"medical"|"legal"|"financial"|"safe" }
//   Any non-200, network failure, timeout, or unknown category value → throw.
//
// PROMPT (server-side — reproduced here for auditability and offline reference):
//
//   You are NERVA's safety classifier. Classify the scenario into exactly one
//   category and reply with ONLY valid JSON, no markdown, no explanation.
//
//   Scenario: "<text>"
//
//   Categories:
//   - "crisis"    — explicit suicidal ideation, self-harm intent, or active
//                   personal safety emergency
//   - "medical"   — seeking personal medical diagnosis or treatment advice
//   - "legal"     — seeking legal counsel for the user's own case
//   - "financial" — seeking personal investment, tax, or financial advice
//   - "safe"      — an operational or personal decision; NERVA is the right tool
//
//   Operational decisions involving risk, stakes, or uncertainty — including
//   decisions a professional makes in their own domain — are "safe". Only flag
//   content where this tool would cause harm by engaging.
//
//   Reply format: {"category":"<value>"}

(function () {
  'use strict';

  // ── Keyword pre-screen ────────────────────────────────────────────────────
  // Instant, no network. Matches on the most unambiguous signals only — the AI
  // layer handles the borderline cases.
  var CRISIS_RE = [
    /\bsuicid|\bkill myself\b|\bend my life\b|\bself[\s-]?harm|\bhurt myself\b/i,
    /\bdon[''']?t want to (?:live|be here|exist)\b|\bwant to die\b|\bno reason to live\b/i,
  ];
  var MEDICAL_RE  = /\b(?:medical advice|my (?:doctor|physician)|diagnos\w+|chemotherapy|prescription|dosage|cancer|tumor|surgery)\b/i;
  var LEGAL_RE    = /\b(?:legal advice|lawsuit|sue me|my attorney|my lawyer|court order|liable|contract dispute)\b/i;
  var FINANCIAL_RE = /\b(?:financial advice|investment advice|stock tip|tax advice|my (?:ira|401k|portfolio)|securities fraud)\b/i;

  function keywordClassify(text) {
    var i;
    for (i = 0; i < CRISIS_RE.length; i++) if (CRISIS_RE[i].test(text)) return 'crisis';
    if (MEDICAL_RE.test(text))   return 'professional';
    if (LEGAL_RE.test(text))     return 'professional';
    if (FINANCIAL_RE.test(text)) return 'professional';
    return 'ok';
  }

  // ── AI safety endpoint ────────────────────────────────────────────────────
  var VALID = ['crisis', 'medical', 'legal', 'financial', 'safe'];
  var TIMEOUT_MS = 5000;

  async function callSafetyEndpoint(text) {
    var ac = new AbortController();
    var timer = setTimeout(function () { ac.abort(); }, TIMEOUT_MS);
    try {
      var resp = await fetch('/api/safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: text }),
        signal: ac.signal,
      });
      if (!resp.ok) throw new Error('/api/safety HTTP ' + resp.status);
      var data = await resp.json();
      if (!VALID.includes(data.category)) throw new Error('unknown category: ' + data.category);
      return data.category;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────
  async function checkSafety(text) {
    // Stage 1: instant keyword pre-screen
    var kw = keywordClassify(text);
    if (kw !== 'ok') return kw; // 'crisis' or 'professional'

    // Stage 2: AI verification — THROWS on any failure (fail-closed)
    var cat = await callSafetyEndpoint(text);
    if (cat === 'safe') return 'safe';
    if (cat === 'crisis') return 'crisis';
    return 'professional'; // medical | legal | financial → same stop screen
  }

  window.NervaSafety = {
    checkSafety: checkSafety,
    callSafetyEndpoint: callSafetyEndpoint,
    keywordClassify: keywordClassify,
  };
})();
