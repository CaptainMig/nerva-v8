// nerva-ui-shared.js — shared design tokens, constants, and pure helpers.
// Plain JS (no Babel). Loaded before the React UI files. Exposes window.NERVA.

(function () {
  'use strict';

  // ── Design tokens (the app's own visual language) ────────────────────────
  var T = {
    bg:        '#0a0e15',
    bgDeep:    '#070a10',
    surface:   '#11161f',
    surfaceHi: '#161c27',
    ink:       '#e8e3d8',
    inkDim:    'rgba(232,227,216,0.60)',
    inkFaint:  'rgba(232,227,216,0.34)',
    inkGhost:  'rgba(232,227,216,0.14)',
    line:      'rgba(232,227,216,0.08)',
    lineHi:    'rgba(232,227,216,0.18)',
    accent:    '#4cc9f0',
    amber:     '#ff9a3c',
    green:     '#3ddc97',
    red:       '#ff5c6c',
    sans:      '"IBM Plex Sans", system-ui, sans-serif',
    mono:      '"JetBrains Mono", ui-monospace, monospace',
    serif:     '"Newsreader", Georgia, serif',
  };

  // Five verdict colors
  var VC = {
    COMMIT:   '#3ddc97',
    HOLD:     '#f5b942',
    WAIT:     '#f5b942',
    ESCALATE: '#ff9a3c',
    TOXIC:    '#ff5c6c',
  };

  // Short verdict glosses — the instrument subtitle under the word
  var VGLOSS = {
    COMMIT:   'clear to act',
    HOLD:     'close — tighten and re-score',
    WAIT:     'not enough signal yet',
    ESCALATE: 'a human needs to sign off',
    TOXIC:    'do not proceed',
  };

  // ── Plain-language factor definitions ────────────────────────────────────
  var FACTORS = [
    { k: 'E',  label: 'Urgency',   desc: 'How time-pressured is this?',         inverted: false },
    { k: 'S',  label: 'Strategy',  desc: 'How well-planned is the approach?',   inverted: false },
    { k: 'R',  label: 'Risk',      desc: 'How bad could the downside be?',      inverted: true  },
    { k: 'Sp', label: 'Support',   desc: 'How solid is the evidence?',          inverted: false },
    { k: 'St', label: 'Stability', desc: 'How stable is the situation?',        inverted: false },
  ];

  var CONF_LEVELS = [
    { label: 'Guessing',  v: 0.25 },
    { label: 'Rough',     v: 0.50 },
    { label: 'Solid',     v: 0.75 },
    { label: 'Confirmed', v: 0.92 },
  ];

  function aggToLevelIdx(agg) {
    return CONF_LEVELS.reduce(function (best, cl, i) {
      return Math.abs(cl.v - agg) < Math.abs(CONF_LEVELS[best].v - agg) ? i : best;
    }, 0);
  }

  // ── Confidence → human phrase / band ─────────────────────────────────────
  // band: 'firm' | 'rough' | 'guess'  — drives the instrument texture.
  function confBand(cf) {
    if (cf >= 0.7) return 'firm';
    if (cf >= 0.45) return 'rough';
    return 'guess';
  }
  function confChipLabel(cf) {
    var b = confBand(cf);
    return b === 'firm' ? 'firm read' : b === 'rough' ? 'rough read' : 'a guess';
  }
  function confColor(cf) {
    if (cf >= 0.7) return T.green;
    if (cf >= 0.45) return '#f5b942';
    return T.red;
  }
  // Phrase used inside the weak-link callout sentence.
  function confPhrase(cf) {
    if (cf >= 0.7) return 'a firm read';
    if (cf >= 0.45) return 'only a rough read';
    return 'mostly a guess';
  }

  function verdictWord(decision) {
    if (!decision) return '';
    return decision[0] + decision.slice(1).toLowerCase();
  }

  // Lowest-confidence factor — the weak link the v11 story hinges on.
  function weakestByConfidence(c) {
    return FACTORS.reduce(function (w, f) {
      return c[f.k] < c[w.k] ? f : w;
    }, FACTORS[0]);
  }

  // ── Safety classifier (offline keyword fallback) ─────────────────────────
  var CRISIS_RE = [
    /\bsuicid|\bkill myself\b|\bend my life\b|\bself[\s-]?harm|\bhurt myself\b/i,
    /\bdon[''']?t want to (?:live|be here|exist)\b|\bwant to die\b|\bno reason to live\b/i,
  ];
  var PROFESSIONAL_RE = [
    /\b(?:medical advice|my (?:doctor|physician)|diagnos\w+|chemotherapy|prescription|dosage|cancer|tumor|surgery)\b/i,
    /\b(?:legal advice|lawsuit|sue me|my attorney|my lawyer|court order|liable|contract dispute)\b/i,
    /\b(?:financial advice|investment advice|stock tip|tax advice|my (?:ira|401k|portfolio)|securities fraud)\b/i,
  ];
  function classify(text) {
    var i;
    for (i = 0; i < CRISIS_RE.length; i++) if (CRISIS_RE[i].test(text)) return 'crisis';
    for (i = 0; i < PROFESSIONAL_RE.length; i++) if (PROFESSIONAL_RE[i].test(text)) return 'professional';
    return 'ok';
  }

  // ── One-line verdict rationale (verdict face) ────────────────────────────
  function buildRationale(result, c) {
    if (!result) return '';
    var decision = result.decision, flags = result.flags;
    var weak = weakestByConfidence(c);
    var wl = weak.label.toLowerCase();

    if (flags.toxic_veto)            return 'High risk with little protection — do not proceed.';
    if (flags.emergency_override)    return 'This is urgent and hard to undo — a human needs to sign off first.';
    if (flags.low_confidence_brake)  return 'This is hard to undo and your read on ' + wl + ' is mostly a guess — a human should sign off.';
    if (flags.one_way_brake)         return 'This is hard to undo and the foundation is shaky — a human should sign off.';
    if (decision === 'COMMIT')       return "Strong signal, your inputs are well-grounded, and this is reversible — you're clear to act.";
    if (decision === 'HOLD')         return 'Close, but the expected payoff is thin — hold and tighten your read on ' + wl + '.';
    if (decision === 'WAIT')         return "The signal isn't strong enough yet, and your read on " + wl + ' is mostly a guess — get better information first.';
    if (decision === 'ESCALATE')     return 'This is hard to undo and the foundation is shaky — a human should sign off.';
    if (decision === 'TOXIC')        return 'High risk with little protection — do not proceed.';
    return '';
  }

  // ── Structured "read" for the reasoning face ─────────────────────────────
  // Returns { headline, callout, weakKey } — plain-language, no math.
  function buildRead(result, v, c) {
    if (!result) return { headline: '', callout: '', weakKey: null };
    var decision = result.decision, flags = result.flags;
    var weak = weakestByConfidence(c);
    var wl = weak.label.toLowerCase();
    var phrase = confPhrase(c[weak.k]);

    var headline, callout;
    if (flags.toxic_veto) {
      headline = 'Hard stop.';
      callout = 'Risk is high and there’s little protecting you. This isn’t a tighten-and-retry — do not proceed.';
    } else if (flags.emergency_override) {
      headline = 'Too big to auto-clear.';
      callout = 'This is urgent and hard to undo. Even a strong signal shouldn’t auto-commit here — a human signs off first.';
    } else if (flags.low_confidence_brake) {
      headline = 'This would be a Commit — but the read isn’t earned.';
      callout = 'The numbers clear the bar, but it’s hard to undo and your read on ' + wl + ' is ' + phrase + '. Firm that up and it can move.';
    } else if (flags.one_way_brake) {
      headline = 'One-way door, shaky footing.';
      callout = 'This is hard to undo and the foundation is too weak to trust. A human should sign off before it moves.';
    } else if (decision === 'COMMIT') {
      headline = 'The case holds up.';
      callout = c[weak.k] < 0.7
        ? 'You’re clear to act. Weakest link is your read on ' + wl + ' (' + phrase + ') — not blocking, but worth confirming.'
        : 'Strong signal, firm reads, and it’s reversible. You’re clear to act.';
    } else if (decision === 'HOLD') {
      headline = 'Close, but thin.';
      callout = 'The payoff is too slim to commit. Tighten your read on ' + wl + ' (' + phrase + ' right now) and re-score.';
    } else if (decision === 'WAIT') {
      headline = 'Not enough to go on yet.';
      callout = 'The signal is weak and your read on ' + wl + ' is ' + phrase + '. Get better information before you act.';
    } else if (decision === 'ESCALATE') {
      headline = 'Needs a human.';
      callout = 'It’s hard to undo and the foundation is shaky. A human should sign off before this moves.';
    } else {
      headline = '';
      callout = '';
    }
    return { headline: headline, callout: callout, weakKey: weak.k };
  }

  // ── Sample checkpoints — real factor sets, evaluated by the real kernel ──
  // Plain-language decisions a person would actually type. Verdicts are
  // produced live by v11_evaluate, never hard-coded.
  var SAMPLES = [
    {
      id: 'vendor',
      text: 'Greenlight the new vendor based on the numbers in their pitch deck.',
      v: { E: 0.30, S: 0.85, R: 0.30, Sp: 0.78, St: 0.78 },
      c: { E: 0.92, S: 0.90, R: 0.85, Sp: 0.25, St: 0.25 },
    },
    {
      id: 'standup',
      text: 'Switch the team to the new async standup format starting Monday.',
      v: { E: 0.35, S: 0.86, R: 0.22, Sp: 0.82, St: 0.78 },
      c: { E: 0.95, S: 0.95, R: 0.93, Sp: 0.97, St: 0.96 },
    },
    {
      id: 'lease',
      text: 'Sign the lease on the bigger office before the quarter closes.',
      v: { E: 0.45, S: 0.72, R: 0.42, Sp: 0.66, St: 0.62 },
      c: { E: 0.78, S: 0.72, R: 0.66, Sp: 0.58, St: 0.55 },
    },
    {
      id: 'deposit',
      text: "Wire the full deposit tonight to lock in the deal before it's gone.",
      v: { E: 0.82, S: 0.74, R: 0.78, Sp: 0.18, St: 0.22 },
      c: { E: 0.86, S: 0.84, R: 0.92, Sp: 0.74, St: 0.72 },
    },
    {
      id: 'migrate',
      text: 'Delete the legacy database this weekend to free up the budget.',
      v: { E: 0.55, S: 0.68, R: 0.62, Sp: 0.32, St: 0.35 },
      c: { E: 0.92, S: 0.88, R: 0.86, Sp: 0.90, St: 0.88 },
    },
  ];

  // Short, stable-looking checkpoint id from a seed string.
  function checkpointId(seed) {
    var pre = ['DRN', 'HFT', 'AVL', 'ADV', 'NRV'];
    var s = String(seed || '');
    var h = 0, i;
    for (i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    var p = pre[h % pre.length];
    var n = (h % 90000 + 10000);
    return p + '-' + n;
  }

  window.NERVA = {
    T: T, VC: VC, VGLOSS: VGLOSS,
    FACTORS: FACTORS, CONF_LEVELS: CONF_LEVELS, aggToLevelIdx: aggToLevelIdx,
    confBand: confBand, confChipLabel: confChipLabel, confColor: confColor, confPhrase: confPhrase,
    verdictWord: verdictWord, weakestByConfidence: weakestByConfidence,
    classify: classify, buildRationale: buildRationale, buildRead: buildRead,
    SAMPLES: SAMPLES, checkpointId: checkpointId,
  };
})();
