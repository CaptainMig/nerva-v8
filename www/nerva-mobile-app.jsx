// nerva-mobile-app.jsx — NERVA Mobile v1
// Three-layer progressive disclosure: verdict gate → factors → math.
// Layer 1 is always visible. Layers 2 and 3 slide up as bottom sheets.

'use strict';

const { useState, useCallback, useMemo, useEffect, useRef } = React;

// ── Design tokens ─────────────────────────────────────────────────────────
const T = {
  bg:        '#0a0e15',
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
  sans:      '"IBM Plex Sans", system-ui, sans-serif',
  mono:      '"JetBrains Mono", ui-monospace, monospace',
  serif:     '"Newsreader", Georgia, serif',
};

// Five verdict colors
const VC = {
  COMMIT:   '#3ddc97',
  HOLD:     '#f5b942',
  WAIT:     '#f5b942',
  ESCALATE: '#ff9a3c',
  TOXIC:    '#ff5c6c',
};

// ── Monetization ─────────────────────────────────────────────────────────
// v1 ships fully free. Flip to true and wire @revenuecat/purchases-capacitor
// to activate the paid tier (cloud sync, history, export, Layer 3 advanced).
const PAYWALL_ENABLED = false;
function isPremium() {
  // TODO: return window.Purchases?.getCustomerInfo()?.entitlements?.active?.pro?.isActive
  return false;
}

// ── Confidence levels ─────────────────────────────────────────────────────
const CONF_LEVELS = [
  { label: 'Guessing',  v: 0.25 },
  { label: 'Rough',     v: 0.50 },
  { label: 'Solid',     v: 0.75 },
  { label: 'Confirmed', v: 0.92 },
];

function aggToLevelIdx(agg) {
  return CONF_LEVELS.reduce(
    (best, cl, i) => Math.abs(cl.v - agg) < Math.abs(CONF_LEVELS[best].v - agg) ? i : best, 0
  );
}

// ── Plain-language factor definitions ─────────────────────────────────────
const FACTORS = [
  { k: 'E',  label: 'Urgency',   desc: 'How time-pressured is this?',      inverted: false },
  { k: 'S',  label: 'Strategy',  desc: 'How well-planned is your approach?', inverted: false },
  { k: 'R',  label: 'Risk',      desc: 'How bad could the downside be?',    inverted: true  },
  { k: 'Sp', label: 'Support',   desc: 'How solid is the evidence?',         inverted: false },
  { k: 'St', label: 'Stability', desc: 'How stable is the situation?',       inverted: false },
];

// ── Safety classifier ─────────────────────────────────────────────────────
// Keyword-based offline fallback. The SCORE IT path runs an AI safety gate
// via /api/parse before any kernel evaluation — this is a belt-and-suspenders
// backstop for the offline / manual-factors path only.
const CRISIS_RE = [
  /\bsuicid|\bkill myself\b|\bend my life\b|\bself[\s-]?harm|\bhurt myself\b/i,
  /\bdon[''']?t want to (?:live|be here|exist)\b|\bwant to die\b|\bno reason to live\b/i,
];
const PROFESSIONAL_RE = [
  /\b(?:medical advice|my (?:doctor|physician)|diagnos\w+|chemotherapy|prescription|dosage|cancer|tumor|surgery)\b/i,
  /\b(?:legal advice|lawsuit|sue me|my attorney|my lawyer|court order|liable|contract dispute)\b/i,
  /\b(?:financial advice|investment advice|stock tip|tax advice|my (?:ira|401k|portfolio)|securities fraud)\b/i,
];

function classify(text) {
  for (const r of CRISIS_RE) if (r.test(text)) return 'crisis';
  for (const r of PROFESSIONAL_RE) if (r.test(text)) return 'professional';
  return 'ok';
}

// ── Deterministic rationale (no AI call — runs fully offline) ─────────────
function buildRationale(result, c) {
  if (!result) return '';
  const { decision, flags } = result;
  const weakest = FACTORS.reduce((w, f) => c[f.k] < c[w.k] ? f : w, FACTORS[0]);
  const wl = weakest.label.toLowerCase();

  if (flags.toxic_veto)
    return 'High risk with little protection — do not proceed.';
  if (flags.emergency_override)
    return 'This is urgent and hard to undo — a human needs to sign off first.';
  if (flags.low_confidence_brake)
    return `This is hard to undo and your read on ${wl} is mostly a guess — a human should sign off before this moves.`;
  if (flags.one_way_brake)
    return 'This is hard to undo and the foundation is shaky — a human should sign off before this moves.';
  if (decision === 'COMMIT')
    return "Strong signal, your inputs are well-grounded, and this is reversible — you're clear to act.";
  if (decision === 'HOLD')
    return `Close, but the expected payoff is thin — hold and tighten your read on ${wl}.`;
  if (decision === 'WAIT')
    return `The signal isn't strong enough yet, and your read on ${wl} is mostly a guess — get better information before you act.`;
  if (decision === 'ESCALATE')
    return 'This is hard to undo and the foundation is shaky — a human should sign off before this moves.';
  if (decision === 'TOXIC')
    return 'High risk with little protection — do not proceed.';
  return '';
}

// ═══════════════════════════════════════════════════════════════════════════
// FIRST-RUN DISCLAIMER  (must dismiss to proceed; stores flag in localStorage)
// ═══════════════════════════════════════════════════════════════════════════
function DisclaimerScreen({ onDismiss }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, background: T.bg,
      display: 'flex', flexDirection: 'column', overflowY: 'auto',
      padding: 'max(52px, calc(env(safe-area-inset-top) + 20px)) 28px max(40px, env(safe-area-inset-bottom))',
    }}>
      <div style={{ font: `600 10.5px/1 ${T.mono}`, letterSpacing: '0.42em', color: T.accent, marginBottom: 48 }}>
        NERVA
      </div>

      <div style={{ font: `200 38px/1.1 ${T.serif}`, color: T.ink, letterSpacing: '-0.02em', marginBottom: 22 }}>
        Before you start.
      </div>

      <div style={{ font: `16px/1.75 ${T.sans}`, color: T.inkDim, marginBottom: 20 }}>
        NERVA helps you think clearly about a decision. It does not give medical, legal, or financial advice.
      </div>
      <div style={{ font: `16px/1.75 ${T.sans}`, color: T.inkDim, marginBottom: 36 }}>
        If you are in crisis or need professional guidance, please reach out to a qualified person — not an app.
      </div>

      <div style={{
        background: T.surface, borderRadius: 6, padding: '16px 18px',
        border: `1px solid ${T.line}`, marginBottom: 36,
        font: `12px/1.7 ${T.mono}`, color: T.inkFaint,
      }}>
        Decisions are stored locally on your device only. Nothing is sent anywhere by default.{' '}
        By continuing you agree to our{' '}
        <span style={{ color: T.accent }}>Terms of Use</span>{' '}and{' '}
        <span style={{ color: T.accent }}>Privacy Policy</span>{' '}
        (starpoint.llc/nerva — placeholder links, update before submission).
      </div>

      <button onClick={onDismiss} style={{
        padding: '16px 0', background: 'rgba(76,201,240,0.10)',
        border: `1px solid rgba(76,201,240,0.35)`,
        color: T.accent, font: `600 12px/1 ${T.mono}`, letterSpacing: '0.18em',
        borderRadius: 4, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
      }}>
        GOT IT — LET'S GO
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SYNC CONSENT BANNER  (one-time, after first successful SCORE IT)
// ═══════════════════════════════════════════════════════════════════════════
function SyncConsentBanner({ onAccept, onDecline }) {
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
      background: T.surface, borderTop: `1px solid ${T.lineHi}`,
      padding: '16px 24px max(24px, env(safe-area-inset-bottom))',
    }}>
      <div style={{ font: `12px/1.6 ${T.sans}`, color: T.inkDim, marginBottom: 12 }}>
        Help improve NERVA? Contribute anonymized decision logs — no scenario text, only numeric values and verdict.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onDecline} style={{
          flex: 1, padding: '10px 0',
          background: 'transparent', border: `1px solid ${T.line}`,
          color: T.inkFaint, font: `500 11.5px/1 ${T.sans}`,
          borderRadius: 4, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
        }}>No thanks</button>
        <button onClick={onAccept} style={{
          flex: 2, padding: '10px 0',
          background: 'rgba(76,201,240,0.10)', border: `1px solid rgba(76,201,240,0.30)`,
          color: T.accent, font: `600 11.5px/1 ${T.sans}`,
          borderRadius: 4, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
        }}>Yes, contribute anonymously</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAYWALL SCREEN  (shown when PAYWALL_ENABLED=true and user is not premium)
// ═══════════════════════════════════════════════════════════════════════════
function PaywallScreen({ featureName, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(10,14,21,0.94)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 28px',
    }}>
      <div style={{ font: `200 34px/1.1 ${T.serif}`, color: T.ink, marginBottom: 16, textAlign: 'center' }}>
        {featureName} is a Pro feature.
      </div>
      <div style={{ font: `15px/1.7 ${T.sans}`, color: T.inkDim, marginBottom: 36, textAlign: 'center' }}>
        Upgrade to NERVA Pro for the full math view, history, cloud sync, and export.
      </div>
      <button style={{
        padding: '16px 40px', background: T.accent, color: T.bg,
        border: 'none', borderRadius: 4, font: `600 13px/1 ${T.mono}`,
        letterSpacing: '0.12em', cursor: 'pointer', marginBottom: 16,
      }}>
        UPGRADE — $X.XX / MONTH {/* TODO: wire RevenueCat price */}
      </button>
      <button onClick={onClose} style={{
        background: 'none', border: 'none', color: T.inkFaint,
        font: `13px/1 ${T.sans}`, cursor: 'pointer',
      }}>Not now</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SAFETY SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function SafetyScreen({ flag, onBack }) {
  const crisis = flag === 'crisis';
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: T.bg,
      display: 'flex', flexDirection: 'column',
      padding: 'max(52px, calc(env(safe-area-inset-top) + 16px)) 28px max(28px, env(safe-area-inset-bottom))',
    }}>
      <div style={{ font: `600 10.5px/1 ${T.mono}`, letterSpacing: '0.42em', color: T.accent, marginBottom: 44 }}>
        NERVA
      </div>

      <div style={{
        font: `200 40px/1.1 ${T.serif}`,
        color: crisis ? '#ff5c6c' : '#ff9a3c',
        letterSpacing: '-0.02em', marginBottom: 18,
      }}>
        {crisis ? 'You matter.' : 'This needs a professional.'}
      </div>

      <div style={{ font: `15px/1.7 ${T.sans}`, color: T.inkDim, marginBottom: 28 }}>
        {crisis
          ? "NERVA isn't the right tool for this moment. Please reach out to someone who can help."
          : 'NERVA is for operational decisions — not medical, legal, or financial ones. Please consult a qualified professional.'}
      </div>

      {crisis && (
        <div style={{
          background: T.surface, border: `1px solid rgba(255,92,108,0.22)`,
          borderRadius: 8, padding: '18px 20px', marginBottom: 28,
        }}>
          <div style={{ font: `600 10px/1 ${T.mono}`, color: '#ff5c6c', letterSpacing: '0.16em', marginBottom: 12 }}>
            SUPPORT RESOURCES
          </div>
          {[
            { label: '988 Suicide & Crisis Lifeline', sub: 'Call or text 988 (US)' },
            { label: 'Crisis Text Line',              sub: 'Text HOME to 741741 (US)' },
            { label: 'International resources',       sub: 'iasp.info/resources/Crisis_Centres' },
          ].map((r, i) => (
            <div key={i} style={{
              paddingTop: i ? 10 : 0, marginTop: i ? 10 : 0,
              borderTop: i ? `1px solid ${T.line}` : 'none',
            }}>
              <div style={{ font: `500 13px/1 ${T.sans}`, color: T.ink }}>{r.label}</div>
              <div style={{ font: `12px/1.4 ${T.sans}`, color: T.inkFaint, marginTop: 3 }}>{r.sub}</div>
            </div>
          ))}
        </div>
      )}

      <button onClick={onBack} style={{
        background: 'transparent', border: `1px solid ${T.lineHi}`,
        color: T.inkDim, font: `500 13px/1 ${T.sans}`,
        padding: '14px 0', borderRadius: 4, cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}>← Back</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BOTTOM SHEET
// ═══════════════════════════════════════════════════════════════════════════
function BottomSheet({ open, onClose, zIndex = 20, children }) {
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
        transition: 'opacity 0.22s ease',
        zIndex: zIndex - 1,
      }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        maxHeight: '92dvh',
        background: T.surface,
        borderRadius: '16px 16px 0 0',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.30s cubic-bezier(0.32,0.72,0,1)',
        zIndex,
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.lineHi }} />
        </div>
        {children}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 2 — FACTORS SHEET
// ═══════════════════════════════════════════════════════════════════════════
function ConfidenceSelector({ levelIdx, onChange }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ font: `600 10px/1 ${T.mono}`, letterSpacing: '0.16em', color: T.inkFaint, marginBottom: 12 }}>
        HOW SURE ARE YOU ABOUT THESE?
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
        {CONF_LEVELS.map((cl, i) => (
          <button key={i} onClick={() => onChange(i)} style={{
            padding: '12px 4px',
            background: i === levelIdx ? 'rgba(76,201,240,0.13)' : 'transparent',
            border: `1px solid ${i === levelIdx ? T.accent : T.line}`,
            color: i === levelIdx ? T.accent : T.inkDim,
            font: `${i === levelIdx ? '600' : '400'} 12px/1 ${T.sans}`,
            borderRadius: 4, cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            transition: 'all 0.12s',
          }}>{cl.label}</button>
        ))}
      </div>
    </div>
  );
}

// ── STEP 1: Risk slider is visually distinct from the other four. ──────────
// Risk is an inverted axis (higher = worse downside).  Using amber/orange
// for the thumb ring and value readout makes it unambiguous that maxing
// this bar is NOT a good signal, unlike the other four.
function FactorRow({ factor, value, onChange }) {
  const isRisk = factor.k === 'R';
  const color  = isRisk ? T.amber : T.accent;

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ font: `600 15px/1 ${T.sans}`, color: T.ink }}>{factor.label}</span>
          {isRisk && (
            <span style={{
              font: `600 9.5px/1 ${T.mono}`, color: T.amber,
              letterSpacing: '0.12em', opacity: 0.8,
            }}>DOWNSIDE ↑</span>
          )}
          <span style={{ font: `12px/1 ${T.sans}`, color: T.inkFaint }}>{factor.desc}</span>
        </div>
        <span style={{
          font: `500 13px/1 ${T.mono}`, color,
          fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: 8,
        }}>{Math.round(value * 100)}%</span>
      </div>
      <input type="range" min="0" max="1" step="0.01" value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', color }} />
    </div>
  );
}

function FactorsSheet({ onClose, onShowMath, onFirstResult }) {
  const { v, masterC, updateValue, updateMaster } = useNervaV11();
  const levelIdx = aggToLevelIdx(masterC);

  return (
    <div style={{ padding: '4px 24px 24px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingBottom: 16, borderBottom: `1px solid ${T.line}`, marginBottom: 20,
      }}>
        <div style={{ font: `600 10.5px/1 ${T.mono}`, letterSpacing: '0.18em', color: T.inkFaint }}>
          THE FACTORS
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: T.inkDim,
          font: `14px/1 ${T.sans}`, cursor: 'pointer', padding: '4px 8px',
        }}>✕</button>
      </div>

      <ConfidenceSelector
        levelIdx={levelIdx}
        onChange={i => { updateMaster(CONF_LEVELS[i].v); onFirstResult(); }}
      />

      {FACTORS.map(f => (
        <FactorRow
          key={f.k}
          factor={f}
          value={v[f.k]}
          onChange={val => { updateValue(f.k, val); onFirstResult(); }}
        />
      ))}

      <button onClick={onShowMath} style={{
        background: 'none', border: 'none', padding: '8px 0 0',
        color: T.inkFaint, font: `14px/1 ${T.sans}`,
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
        WebkitTapHighlightColor: 'transparent',
      }}>
        <span>Show the math</span>
        <span style={{ color: T.accent }}>→</span>
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 3 — MATH SHEET
// ═══════════════════════════════════════════════════════════════════════════
function PhaseSpace({ result, c }) {
  const W = 310, H = 240;
  const Ml = 32, Mr = 12, Mt = 12, Mb = 24;
  const pw = W - Ml - Mr, ph = H - Mt - Mb;
  const D = 0.68;
  const xp = v => Ml + (v / D) * pw;
  const yp = v => Mt + (1 - v / D) * ph;

  const pur = result.bloch_pure, mix = result.bloch;
  const vc  = VC[result.decision] || T.ink;
  const cI  = (c.E + c.S) / 2, cG = c.Sp * c.St;
  const rx  = Math.min(0.28, (1 - cI) * 0.38) / D * pw;
  const ry  = Math.min(0.28, (1 - cG) * 0.38) / D * ph;
  const px  = xp(pur.r_x), py = yp(pur.r_z);
  const mx  = xp(mix.r_x), my = yp(mix.r_z);
  const tR  = (result.tau / D) * Math.min(pw, ph);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      <defs>
        <radialGradient id="mg-env" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={vc} stopOpacity="0.32" />
          <stop offset="70%"  stopColor={vc} stopOpacity="0.10" />
          <stop offset="100%" stopColor={vc} stopOpacity="0" />
        </radialGradient>
        <pattern id="mg-grid" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M 16 0 L 0 0 0 16" fill="none" stroke={T.line} strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect x={Ml} y={Mt} width={pw} height={ph} fill="url(#mg-grid)" />
      <line x1={Ml} y1={Mt} x2={Ml} y2={Mt+ph} stroke={T.lineHi} strokeWidth="0.8" />
      <line x1={Ml} y1={Mt+ph} x2={Ml+pw} y2={Mt+ph} stroke={T.lineHi} strokeWidth="0.8" />
      <circle cx={xp(0)} cy={yp(0)} r={tR} fill="none" stroke="#ff5c6c" strokeWidth="1" strokeDasharray="2 3" opacity="0.65" />
      <ellipse cx={mx} cy={my} rx={rx} ry={ry} fill="url(#mg-env)" stroke={vc} strokeWidth="0.8" strokeOpacity="0.5" strokeDasharray="2 3" />
      <line x1={px} y1={py} x2={mx} y2={my} stroke={T.inkDim} strokeWidth="0.8" strokeDasharray="2 2" />
      <circle cx={px} cy={py} r="3.5" fill="none" stroke={T.inkDim} strokeWidth="1" />
      <circle cx={mx} cy={my} r="5.5" fill={vc} stroke={T.bg} strokeWidth="1.5" />
      {[0.2, 0.4, 0.6].map(t => (
        <g key={t}>
          <text x={xp(t)} y={Mt+ph+13} textAnchor="middle" style={{ font: `8.5px ${T.mono}`, fill: T.inkFaint }}>{t}</text>
          <text x={Ml-4}  y={yp(t)+3}  textAnchor="end"    style={{ font: `8.5px ${T.mono}`, fill: T.inkFaint }}>{t}</text>
        </g>
      ))}
      <text x={Ml+pw/2} y={H-2} textAnchor="middle" style={{ font: `italic 9.5px ${T.serif}`, fill: T.inkDim }}>intent</text>
      <text x={7} y={Mt+ph/2} textAnchor="middle" transform={`rotate(-90 7 ${Mt+ph/2})`} style={{ font: `italic 9.5px ${T.serif}`, fill: T.inkDim }}>integrity</text>
      <text x={mx+9} y={my+4} style={{ font: `700 9.5px ${T.mono}`, fill: vc, letterSpacing: '0.1em' }}>{result.decision}</text>
    </svg>
  );
}

function MathSheet({ onClose }) {
  const { result, c } = useNervaV11();
  if (!result) return null;
  const fmt = (x, d=3) => (x == null || isNaN(x)) ? '—' : Number(x.toFixed(d));
  const vc = VC[result.decision] || T.ink;

  const metrics = [
    { l: '|r|',  v: fmt(result.bloch.magnitude, 3), s: 'signal',    c: vc },
    { l: 'τ',    v: fmt(result.tau, 3),             s: 'threshold' },
    { l: 'C',    v: fmt(result.aggregate_C, 3),     s: 'confidence' },
    { l: 'S(ρ)', v: fmt(result.entropy, 3),         s: 'entropy' },
    { l: 'EV',   v: fmt(result.ev, 2),              s: 'Sp − R',    c: result.ev >= 0 ? '#3ddc97' : '#ff5c6c' },
    { l: 'I',    v: fmt(result.integrity, 2),       s: 'Sp · St' },
  ];

  return (
    <div style={{ padding: '4px 24px 24px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingBottom: 16, borderBottom: `1px solid ${T.line}`, marginBottom: 20,
      }}>
        <div style={{ font: `600 10.5px/1 ${T.mono}`, letterSpacing: '0.18em', color: T.inkFaint }}>
          THE MATH
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: T.inkDim,
          font: `14px/1 ${T.sans}`, cursor: 'pointer', padding: '4px 8px',
        }}>✕</button>
      </div>

      <div style={{ marginBottom: 6 }}>
        <div style={{ font: `9.5px/1 ${T.mono}`, color: T.inkFaint, letterSpacing: '0.16em', marginBottom: 10 }}>
          PHASE SPACE · INTENT × INTEGRITY
        </div>
        <PhaseSpace result={result} c={c} />
      </div>
      <div style={{
        display: 'flex', gap: 16, marginBottom: 24, justifyContent: 'center',
        font: `10px/1 ${T.mono}`, color: T.inkFaint,
      }}>
        <span><span style={{ color: vc }}>●</span> mixed (v11)</span>
        <span><span style={{ color: T.inkDim }}>○</span> pure (v10)</span>
        <span><span style={{ color: '#ff5c6c', opacity: 0.6 }}>- -</span> τ</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 24 }}>
        {metrics.map((m, i) => (
          <div key={i} style={{
            background: T.surfaceHi, borderRadius: 6,
            padding: '10px 8px', textAlign: 'center',
          }}>
            <div style={{ font: `9px/1 ${T.mono}`, color: T.inkFaint, letterSpacing: '0.14em', marginBottom: 5 }}>{m.l}</div>
            <div style={{ font: `500 17px/1 ${T.mono}`, color: m.c || T.ink, fontVariantNumeric: 'tabular-nums' }}>{m.v}</div>
            <div style={{ font: `9px/1 ${T.sans}`, color: T.inkGhost, marginTop: 4 }}>{m.s}</div>
          </div>
        ))}
      </div>

      <div style={{
        background: 'rgba(245,185,66,0.06)', border: `1px solid rgba(245,185,66,0.20)`,
        borderRadius: 6, padding: '14px 16px', marginBottom: 20,
      }}>
        <div style={{ font: `9.5px/1 ${T.mono}`, color: T.inkFaint, letterSpacing: '0.14em', marginBottom: 8 }}>
          DENSITY MATRIX
        </div>
        <div style={{ font: `500 12.5px/1.4 ${T.mono}`, color: T.ink, marginBottom: 6 }}>
          ρ = C · ρ<sub style={{ fontSize: 8 }}>pure</sub> + (1 − C) · <em>I</em>/2
        </div>
        <div style={{ font: `italic 10.5px/1.5 ${T.serif}`, color: T.inkDim }}>
          C = {fmt(result.aggregate_C, 3)} · |r₀| = {fmt(result.bloch_pure.magnitude, 3)} → |r| = {fmt(result.bloch.magnitude, 3)}
        </div>
      </div>

      <div style={{
        font: `10px/1.6 ${T.mono}`, color: T.inkGhost,
        letterSpacing: '0.03em', paddingTop: 16, borderTop: `1px solid ${T.line}`,
      }}>
        Nielsen &amp; Chuang (2010) Ch. 2 &amp; 11 · Shannon (1948) · Baumgratz–Cramer–Plenio (2014)
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT APP — LAYER 1 + SHEET ORCHESTRATION
// ═══════════════════════════════════════════════════════════════════════════
function NervaMobileApp() {
  const { v, c, result, updateValue, updateConfidence, updateMaster, masterC } = useNervaV11();

  // ── UI state ─────────────────────────────────────────────────────────────
  const [text,          setText]          = useState('');
  const [hasResult,     setHasResult]     = useState(false);
  const [safetyFlag,    setSafetyFlag]    = useState(null);
  const [scoreError,    setScoreError]    = useState(null);
  const [isScoring,     setIsScoring]     = useState(false);
  const [factorsOpen,   setFactorsOpen]   = useState(false);
  const [mathOpen,      setMathOpen]      = useState(false);
  const [paywallOpen,   setPaywallOpen]   = useState(false);

  // First-run disclaimer — dismiss once; stored in localStorage
  const [showDisclaimer, setShowDisclaimer] = useState(
    () => !localStorage.getItem('nerva_disclaim_v1')
  );

  // Cloud-sync opt-in prompt — shown once after first successful score
  const [showSyncAsk, setShowSyncAsk] = useState(false);

  const dismissDisclaimer = useCallback(() => {
    localStorage.setItem('nerva_disclaim_v1', '1');
    setShowDisclaimer(false);
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const rationaleTxt = useMemo(() => buildRationale(result, c), [result, c]);
  const vColor = result ? (VC[result.decision] || T.ink) : T.ink;
  const vWord  = result ? (result.decision[0] + result.decision.slice(1).toLowerCase()) : '';

  // ── Helpers ───────────────────────────────────────────────────────────────
  const openFactors = useCallback(() => {
    if (!hasResult) {
      updateMaster(0.5);
      FACTORS.forEach(f => updateValue(f.k, 0.5));
    }
    setFactorsOpen(true);
  }, [hasResult, updateMaster, updateValue]);

  const openMath = useCallback(() => {
    if (PAYWALL_ENABLED && !isPremium()) { setPaywallOpen(true); return; }
    setMathOpen(true);
  }, []);

  // ── SCORE IT — Step 2: AI safety gate before kernel touches state ─────────
  const handleScore = useCallback(async () => {
    if (!text.trim() || isScoring) return;

    // Belt-and-suspenders: offline keyword check first (instant, no network)
    const kwFlag = classify(text);
    if (kwFlag !== 'ok') { setSafetyFlag(kwFlag); return; }

    setSafetyFlag(null);
    setScoreError(null);

    if (!navigator.onLine) {
      setScoreError("You're offline — set factors manually to get a verdict.");
      openFactors();
      return;
    }

    setIsScoring(true);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // AI safety gate — hard stop before any state update
      if (data.safe) { setSafetyFlag(data.safe); return; }

      // Apply parsed values to kernel state
      const VKEYS = ['E', 'S', 'R', 'Sp', 'St'];
      VKEYS.forEach(k => { if (data[k] != null) updateValue(k, data[k]); });
      VKEYS.forEach(k => {
        const ck = 'c' + k;
        if (data[ck] != null) updateConfidence(k, data[ck]);
      });

      setHasResult(true);

      // Step 3: write local log entry (non-blocking, never awaited)
      window.NervaStorage?.appendDecisionLog?.({
        text:      text.slice(0, 200),
        timestamp: Date.now(),
      }).catch(() => {});

      // Offer sync consent once, if never answered
      if (window.NervaStorage?.getSyncConsent?.() === null) {
        setShowSyncAsk(true);
      }

    } catch (err) {
      console.warn('[nerva] score error', err);
      setScoreError('Scoring failed — check your connection and try again.');
    } finally {
      setIsScoring(false);
    }
  }, [text, isScoring, updateValue, updateConfidence, openFactors]);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (showDisclaimer) return <DisclaimerScreen onDismiss={dismissDisclaimer} />;
  if (safetyFlag)     return <SafetyScreen flag={safetyFlag} onBack={() => setSafetyFlag(null)} />;

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, color: T.ink, fontFamily: T.sans, overscrollBehavior: 'contain' }}>

      {/* ── LAYER 1 (always visible) ─────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>

        {/* Logo */}
        <div style={{ padding: 'max(52px, calc(env(safe-area-inset-top) + 16px)) 28px 0', flexShrink: 0 }}>
          <div style={{ font: `600 10.5px/1 ${T.mono}`, letterSpacing: '0.42em', color: T.accent }}>NERVA</div>
        </div>

        {/* Input area */}
        <div style={{ padding: '32px 28px 0', flexShrink: 0 }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Describe a decision you're weighing…"
            style={{
              width: '100%', minHeight: 130, padding: '16px',
              background: T.surface, border: `1px solid ${T.line}`, borderRadius: 4,
              color: T.ink, font: `15px/1.65 ${T.sans}`,
              resize: 'none', outline: 'none', display: 'block',
              WebkitAppearance: 'none',
            }}
          />

          {/* SCORE IT */}
          <button
            onClick={handleScore}
            disabled={isScoring || !text.trim()}
            style={{
              marginTop: 10, padding: '16px 0', width: '100%',
              background: isScoring ? 'transparent' : 'rgba(76,201,240,0.10)',
              border: `1px solid ${isScoring ? T.line : T.accent + '55'}`,
              color: isScoring ? T.inkGhost : T.accent,
              font: `600 11.5px/1 ${T.mono}`, letterSpacing: '0.24em',
              borderRadius: 4, cursor: isScoring ? 'not-allowed' : 'pointer',
              WebkitTapHighlightColor: 'transparent', transition: 'all 0.12s',
              display: 'block',
            }}
          >{isScoring ? '⟳ SCORING…' : 'SCORE IT'}</button>

          {/* Error */}
          {scoreError && (
            <div style={{ marginTop: 8, font: `11px/1.4 ${T.mono}`, color: '#ff5c6c', letterSpacing: '0.04em' }}>
              {scoreError}
            </div>
          )}

          {/* Set manually */}
          <button onClick={openFactors} style={{
            background: 'none', border: 'none', marginTop: 14, padding: 0,
            color: T.inkGhost, font: `12px/1 ${T.sans}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            WebkitTapHighlightColor: 'transparent',
          }}>
            <span>or set factors manually</span>
            <span style={{ color: T.accent }}>→</span>
          </button>
        </div>

        {/* Verdict area — appears after first score or manual set */}
        {hasResult && result && !isScoring && (
          <div style={{ padding: '44px 28px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{
              font: `200 78px/0.88 ${T.serif}`,
              color: vColor, letterSpacing: '-0.03em', marginBottom: 16,
            }}>
              {vWord}
            </div>

            <div style={{ font: `16px/1.65 ${T.sans}`, color: T.inkDim, marginBottom: 36 }}>
              {rationaleTxt}
            </div>

            <button onClick={() => setFactorsOpen(true)} style={{
              background: 'none', border: 'none', padding: 0,
              color: T.inkFaint, font: `14px/1 ${T.sans}`,
              cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 8,
              WebkitTapHighlightColor: 'transparent',
            }}>
              <span>See the factors</span>
              <span style={{ color: T.accent }}>→</span>
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 'auto',
          padding: 'max(24px, 20px) 28px max(28px, env(safe-area-inset-bottom))',
          font: `10.5px/1.5 ${T.mono}`, color: T.inkGhost, letterSpacing: '0.04em',
          borderTop: hasResult && result ? `1px solid ${T.line}` : 'none',
        }}>
          Reflection tool — not medical, legal, or financial advice.
        </div>
      </div>

      {/* ── LAYER 2 — Factors bottom sheet ──────────────────────────────── */}
      <BottomSheet open={factorsOpen} onClose={() => setFactorsOpen(false)} zIndex={20}>
        <FactorsSheet
          onClose={() => setFactorsOpen(false)}
          onShowMath={openMath}
          onFirstResult={() => setHasResult(true)}
        />
      </BottomSheet>

      {/* ── LAYER 3 — Math bottom sheet ─────────────────────────────────── */}
      <BottomSheet open={mathOpen} onClose={() => setMathOpen(false)} zIndex={30}>
        <MathSheet onClose={() => setMathOpen(false)} />
      </BottomSheet>

      {/* ── Paywall ────────────────────────────────────────────────────── */}
      {paywallOpen && (
        <PaywallScreen featureName="The math view" onClose={() => setPaywallOpen(false)} />
      )}

      {/* ── Sync consent banner ─────────────────────────────────────────── */}
      {showSyncAsk && !factorsOpen && !mathOpen && (
        <SyncConsentBanner
          onAccept={() => {
            window.NervaStorage?.setSyncConsent?.('granted');
            setShowSyncAsk(false);
          }}
          onDecline={() => {
            window.NervaStorage?.setSyncConsent?.('denied');
            setShowSyncAsk(false);
          }}
        />
      )}
    </div>
  );
}

window.NervaMobileApp = NervaMobileApp;
