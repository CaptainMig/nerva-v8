// nerva-app.jsx — NERVA mobile root.
// Compose → Checkpoint (swipeable verdict↔read) → opt-in math / adjust.
// Drives the REAL v11 kernel via NervaV11Provider — verdicts are computed,
// never hard-coded.

'use strict';

const { useState: useA, useCallback: useACb, useMemo: useAMemo, useRef: useARef } = React;
const _NA = window.NERVA;
const T = _NA.T;

// ════════════════════════════════════════════════════════════════════════════
// BOTTOM SHEET  (mounted only while open; static resting state)
// ════════════════════════════════════════════════════════════════════════════
function BottomSheet({ onClose, zIndex = 20, children }) {
  return (
    <React.Fragment>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: zIndex - 1,
      }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, maxHeight: '92dvh',
        background: T.surface, borderRadius: '16px 16px 0 0',
        zIndex, display: 'flex', flexDirection: 'column', overflowY: 'auto',
        WebkitOverflowScrolling: 'touch', borderTop: `1px solid ${T.lineHi}`,
        boxShadow: '0 -20px 60px -20px rgba(0,0,0,0.7)',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.lineHi }} />
        </div>
        {children}
      </div>
    </React.Fragment>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ADJUST SHEET — edit each factor's value AND your confidence in it.
// Confidence is the v11 story, so it's a first-class control here.
// ════════════════════════════════════════════════════════════════════════════
const CONF_STOPS = [
  { label: 'Guess', v: 0.30 },
  { label: 'Rough', v: 0.55 },
  { label: 'Firm',  v: 0.85 },
];
function confStopIdx(cf) {
  return CONF_STOPS.reduce((b, s, i) => Math.abs(s.v - cf) < Math.abs(CONF_STOPS[b].v - cf) ? i : b, 0);
}

function AdjustRow({ factor, value, conf, onValue, onConf }) {
  const isRisk = factor.inverted;
  const color = isRisk ? T.amber : T.accent;
  const ci = confStopIdx(conf);
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ font: `600 14.5px/1 ${T.sans}`, color: T.ink }}>{factor.label}</span>
          {isRisk && <span style={{ font: `600 8.5px/1 ${T.mono}`, color: T.amber, letterSpacing: '0.12em' }}>DOWNSIDE ↑</span>}
        </div>
        <span style={{ font: `500 13px/1 ${T.mono}`, color, fontVariantNumeric: 'tabular-nums' }}>{Math.round(value * 100)}%</span>
      </div>
      <input type="range" min="0" max="1" step="0.01" value={value}
        onChange={e => onValue(parseFloat(e.target.value))}
        style={{ width: '100%', color, marginBottom: 10 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ font: `9px/1 ${T.mono}`, color: T.inkFaint, letterSpacing: '0.12em', flexShrink: 0 }}>HOW SURE?</span>
        <div style={{ display: 'flex', gap: 5, flex: 1 }}>
          {CONF_STOPS.map((s, i) => (
            <button key={i} onClick={() => onConf(s.v)} style={{
              flex: 1, padding: '7px 0',
              background: i === ci ? 'rgba(76,201,240,0.13)' : 'transparent',
              border: `1px solid ${i === ci ? T.accent : T.line}`,
              color: i === ci ? T.accent : T.inkFaint,
              font: `${i === ci ? 600 : 400} 10.5px/1 ${T.sans}`,
              borderRadius: 4, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}>{s.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PHASE SPACE
// ════════════════════════════════════════════════════════════════════════════
function PhaseSpace({ result, c }) {
  const W = 310, H = 240, Ml = 32, Mr = 12, Mt = 10, Mb = 24;
  const pw = W - Ml - Mr, ph = H - Mt - Mb, D = 0.68;
  const xp = val => Ml + (val / D) * pw;
  const yp = val => Mt + (1 - val / D) * ph;
  const pur = result.bloch_pure, mix = result.bloch;
  const vc = _NA.VC[result.decision] || T.ink;
  const cI = (c.E + c.S) / 2, cG = c.Sp * c.St;
  const rx = Math.min(0.28, (1 - cI) * 0.38) / D * pw;
  const ry = Math.min(0.28, (1 - cG) * 0.38) / D * ph;
  const px = xp(pur.r_x), py = yp(pur.r_z);
  const mx = xp(mix.r_x), my = yp(mix.r_z);
  const tR = (result.tau / D) * Math.min(pw, ph);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      <defs>
        <radialGradient id="mg-env" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={vc} stopOpacity="0.32" />
          <stop offset="70%" stopColor={vc} stopOpacity="0.10" />
          <stop offset="100%" stopColor={vc} stopOpacity="0" />
        </radialGradient>
        <pattern id="mg-grid" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M 16 0 L 0 0 0 16" fill="none" stroke={T.line} strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect x={Ml} y={Mt} width={pw} height={ph} fill="url(#mg-grid)" />
      <line x1={Ml} y1={Mt} x2={Ml} y2={Mt + ph} stroke={T.lineHi} strokeWidth="0.8" />
      <line x1={Ml} y1={Mt + ph} x2={Ml + pw} y2={Mt + ph} stroke={T.lineHi} strokeWidth="0.8" />
      <circle cx={xp(0)} cy={yp(0)} r={tR} fill="none" stroke="#ff5c6c" strokeWidth="1" strokeDasharray="2 3" opacity="0.65" />
      <ellipse cx={mx} cy={my} rx={rx} ry={ry} fill="url(#mg-env)" stroke={vc} strokeWidth="0.8" strokeOpacity="0.5" strokeDasharray="2 3" />
      <line x1={px} y1={py} x2={mx} y2={my} stroke={T.inkDim} strokeWidth="0.8" strokeDasharray="2 2" />
      <circle cx={px} cy={py} r="3.5" fill="none" stroke={T.inkDim} strokeWidth="1" />
      <circle cx={mx} cy={my} r="5.5" fill={vc} stroke={T.bg} strokeWidth="1.5" />
      {[0.2, 0.4, 0.6].map(t => (
        <g key={t}>
          <text x={xp(t)} y={Mt + ph + 13} textAnchor="middle" style={{ font: `8.5px ${T.mono}`, fill: T.inkFaint }}>{t}</text>
          <text x={Ml - 4} y={yp(t) + 3} textAnchor="end" style={{ font: `8.5px ${T.mono}`, fill: T.inkFaint }}>{t}</text>
        </g>
      ))}
      <text x={Ml + pw / 2} y={H - 2} textAnchor="middle" style={{ font: `italic 9.5px ${T.serif}`, fill: T.inkDim }}>intent</text>
      <text x={7} y={Mt + ph / 2} textAnchor="middle" transform={`rotate(-90 7 ${Mt + ph / 2})`} style={{ font: `italic 9.5px ${T.serif}`, fill: T.inkDim }}>integrity</text>
      <text x={mx + 9} y={my + 4} style={{ font: `700 9.5px ${T.mono}`, fill: vc, letterSpacing: '0.1em' }}>{result.decision}</text>
    </svg>
  );
}

function AdjustSheet({ onClose }) {
  const { v, c, updateValue, updateConfidence } = useNervaV11();
  return (
    <div style={{ padding: '4px 24px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: `1px solid ${T.line}`, marginBottom: 20 }}>
        <div style={{ font: `600 10.5px/1 ${T.mono}`, letterSpacing: '0.18em', color: T.inkFaint }}>ADJUST THE INPUTS</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.inkDim, font: `14px/1 ${T.sans}`, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
      </div>
      {_NA.FACTORS.map(f => (
        <AdjustRow key={f.k} factor={f} value={v[f.k]} conf={c[f.k]}
          onValue={val => updateValue(f.k, val)}
          onConf={val => updateConfidence(f.k, val)} />
      ))}
      <div style={{ font: `12px/1.6 ${T.sans}`, color: T.inkFaint, marginTop: 4 }}>
        The verdict updates live as you adjust. Lower your confidence on a factor and watch the read change.
      </div>
    </div>
  );
}

function MathSheet({ onClose }) {
  const { result, c } = useNervaV11();
  if (!result) return null;
  const fmt = (x, d = 3) => (x == null || isNaN(x)) ? '—' : Number(x.toFixed(d));
  const vc = _NA.VC[result.decision] || T.ink;
  const metrics = [
    { l: '|r|', v: fmt(result.bloch.magnitude, 3), s: 'signal', c: vc },
    { l: 'τ',   v: fmt(result.tau, 3),              s: 'threshold' },
    { l: 'C',   v: fmt(result.aggregate_C, 3),      s: 'confidence' },
    { l: 'S(ρ)',v: fmt(result.entropy, 3),           s: 'entropy' },
    { l: 'EV',  v: fmt(result.ev, 2),               s: 'Sp − R', c: result.ev >= 0 ? T.green : T.red },
    { l: 'I',   v: fmt(result.integrity, 2),         s: 'Sp · St' },
  ];
  return (
    <div style={{ padding: '4px 24px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: `1px solid ${T.line}`, marginBottom: 18 }}>
        <div style={{ font: `600 10.5px/1 ${T.mono}`, letterSpacing: '0.18em', color: T.inkFaint }}>THE MATH</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.inkDim, font: `14px/1 ${T.sans}`, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
      </div>
      <div style={{ font: `9.5px/1 ${T.mono}`, color: T.inkFaint, letterSpacing: '0.16em', marginBottom: 10 }}>PHASE SPACE · INTENT × INTEGRITY</div>
      <PhaseSpace result={result} c={c} />
      <div style={{ display: 'flex', gap: 16, margin: '6px 0 22px', justifyContent: 'center', font: `10px/1 ${T.mono}`, color: T.inkFaint }}>
        <span><span style={{ color: vc }}>●</span> mixed (v11)</span>
        <span><span style={{ color: T.inkDim }}>○</span> pure (v10)</span>
        <span><span style={{ color: T.red, opacity: 0.6 }}>- -</span> τ</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 22 }}>
        {metrics.map((m, i) => (
          <div key={i} style={{ background: T.surfaceHi, borderRadius: 6, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ font: `9px/1 ${T.mono}`, color: T.inkFaint, letterSpacing: '0.14em', marginBottom: 5 }}>{m.l}</div>
            <div style={{ font: `500 17px/1 ${T.mono}`, color: m.c || T.ink, fontVariantNumeric: 'tabular-nums' }}>{m.v}</div>
            <div style={{ font: `9px/1 ${T.sans}`, color: T.inkGhost, marginTop: 4 }}>{m.s}</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'rgba(245,185,66,0.06)', border: `1px solid rgba(245,185,66,0.20)`, borderRadius: 6, padding: '14px 16px', marginBottom: 18 }}>
        <div style={{ font: `9.5px/1 ${T.mono}`, color: T.inkFaint, letterSpacing: '0.14em', marginBottom: 8 }}>DENSITY MATRIX</div>
        <div style={{ font: `500 12.5px/1.4 ${T.mono}`, color: T.ink, marginBottom: 6 }}>
          ρ = C · ρ<sub style={{ fontSize: 8 }}>pure</sub> + (1 − C) · <em>I</em>/2
        </div>
        <div style={{ font: `italic 10.5px/1.5 ${T.serif}`, color: T.inkDim }}>
          C = {fmt(result.aggregate_C, 3)} · |r₀| = {fmt(result.bloch_pure.magnitude, 3)} → |r| = {fmt(result.bloch.magnitude, 3)}
        </div>
      </div>
      <div style={{ font: `10px/1.6 ${T.mono}`, color: T.inkGhost, letterSpacing: '0.03em', paddingTop: 14, borderTop: `1px solid ${T.line}` }}>
        Nielsen &amp; Chuang (2010) Ch. 2 &amp; 11 · Shannon (1948) · Baumgratz–Cramer–Plenio (2014)
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// FIRST-RUN DISCLAIMER + SAFETY
// ════════════════════════════════════════════════════════════════════════════
function DisclaimerScreen({ onDismiss }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: T.bg, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: 'max(56px, calc(env(safe-area-inset-top) + 24px)) 28px max(40px, env(safe-area-inset-bottom))' }}>
      <div style={{ font: `600 10.5px/1 ${T.mono}`, letterSpacing: '0.42em', color: T.accent, marginBottom: 48 }}>NERVA</div>
      <div style={{ font: `200 38px/1.1 ${T.serif}`, color: T.ink, letterSpacing: '-0.02em', marginBottom: 22 }}>Before you start.</div>
      <div style={{ font: `16px/1.75 ${T.sans}`, color: T.inkDim, marginBottom: 20 }}>NERVA helps you think clearly about a decision. It does not give medical, legal, or financial advice.</div>
      <div style={{ font: `16px/1.75 ${T.sans}`, color: T.inkDim, marginBottom: 36 }}>If you are in crisis or need professional guidance, please reach out to a qualified person — not an app.</div>
      <div style={{ background: T.surface, borderRadius: 6, padding: '16px 18px', border: `1px solid ${T.line}`, marginBottom: 36, font: `12px/1.7 ${T.mono}`, color: T.inkFaint }}>
        Decisions are stored locally on your device only. Nothing is sent anywhere by default. By continuing you agree to our <span style={{ color: T.accent }}>Terms of Use</span> and <span style={{ color: T.accent }}>Privacy Policy</span> (placeholder links).
      </div>
      <button onClick={onDismiss} style={{ padding: '16px 0', background: 'rgba(76,201,240,0.10)', border: `1px solid rgba(76,201,240,0.35)`, color: T.accent, font: `600 12px/1 ${T.mono}`, letterSpacing: '0.18em', borderRadius: 4, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>GOT IT — LET'S GO</button>
    </div>
  );
}

// Shown when the safety endpoint fails (network blip, timeout, 5xx).
// Honest: says the check failed, not that the user's content is problematic.
function UncertainScreen({ onBack }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: T.bg, display: 'flex', flexDirection: 'column', padding: 'max(56px, calc(env(safe-area-inset-top) + 16px)) 28px max(28px, env(safe-area-inset-bottom))' }}>
      <div style={{ font: `600 10.5px/1 ${T.mono}`, letterSpacing: '0.42em', color: T.accent, marginBottom: 44 }}>NERVA</div>
      <div style={{ font: `200 40px/1.1 ${T.serif}`, color: T.inkDim, letterSpacing: '-0.02em', marginBottom: 18 }}>
        Something went wrong.
      </div>
      <div style={{ font: `15px/1.7 ${T.sans}`, color: T.inkDim, marginBottom: 28 }}>
        The safety check couldn't complete — this is likely a connection problem, not something about your decision.
      </div>
      <div style={{ font: `12px/1.6 ${T.mono}`, color: T.inkFaint, marginBottom: 36 }}>
        Your input wasn't scored. Try again in a moment.
      </div>
      <button onClick={onBack} style={{ background: 'transparent', border: `1px solid ${T.lineHi}`, color: T.inkDim, font: `500 13px/1 ${T.sans}`, padding: '14px 0', borderRadius: 4, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>← Try again</button>
    </div>
  );
}

function SafetyScreen({ flag, onBack }) {
  const crisis = flag === 'crisis';
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: T.bg, display: 'flex', flexDirection: 'column', padding: 'max(56px, calc(env(safe-area-inset-top) + 16px)) 28px max(28px, env(safe-area-inset-bottom))' }}>
      <div style={{ font: `600 10.5px/1 ${T.mono}`, letterSpacing: '0.42em', color: T.accent, marginBottom: 44 }}>NERVA</div>
      <div style={{ font: `200 40px/1.1 ${T.serif}`, color: crisis ? T.red : T.amber, letterSpacing: '-0.02em', marginBottom: 18 }}>
        {crisis ? 'You matter.' : 'This needs a professional.'}
      </div>
      <div style={{ font: `15px/1.7 ${T.sans}`, color: T.inkDim, marginBottom: 28 }}>
        {crisis ? "NERVA isn't the right tool for this moment. Please reach out to someone who can help." : 'NERVA is for operational decisions — not medical, legal, or financial ones. Please consult a qualified professional.'}
      </div>
      {crisis && (
        <div style={{ background: T.surface, border: `1px solid rgba(255,92,108,0.22)`, borderRadius: 8, padding: '18px 20px', marginBottom: 28 }}>
          <div style={{ font: `600 10px/1 ${T.mono}`, color: T.red, letterSpacing: '0.16em', marginBottom: 12 }}>SUPPORT RESOURCES</div>
          {[{ label: '988 Suicide & Crisis Lifeline', sub: 'Call or text 988 (US)' }, { label: 'Crisis Text Line', sub: 'Text HOME to 741741 (US)' }].map((r, i) => (
            <div key={i} style={{ paddingTop: i ? 10 : 0, marginTop: i ? 10 : 0, borderTop: i ? `1px solid ${T.line}` : 'none' }}>
              <div style={{ font: `500 13px/1 ${T.sans}`, color: T.ink }}>{r.label}</div>
              <div style={{ font: `12px/1.4 ${T.sans}`, color: T.inkFaint, marginTop: 3 }}>{r.sub}</div>
            </div>
          ))}
        </div>
      )}
      <button onClick={onBack} style={{ background: 'transparent', border: `1px solid ${T.lineHi}`, color: T.inkDim, font: `500 13px/1 ${T.sans}`, padding: '14px 0', borderRadius: 4, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>← Back</button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMPOSE VIEW
// ════════════════════════════════════════════════════════════════════════════
function shortLabel(text) {
  const t = text.replace(/[".]/g, '').trim();
  const words = t.split(/\s+/).slice(0, 4).join(' ');
  return words.length < t.length ? words + '…' : words;
}

function ComposeView({ text, setText, onScore, onSample, estimateNote }) {
  return (
    <div style={{ padding: '0 28px', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ font: `200 34px/1.12 ${T.serif}`, color: T.ink, letterSpacing: '-0.02em', marginTop: 30, marginBottom: 22 }}>
        What are you<br />weighing?
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Describe a decision you're weighing…"
        style={{ width: '100%', minHeight: 120, padding: 16, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 6, color: T.ink, font: `15px/1.65 ${T.sans}`, resize: 'none', outline: 'none', display: 'block', WebkitAppearance: 'none' }}
      />
      <button onClick={onScore} disabled={!text.trim()} style={{
        marginTop: 10, padding: '16px 0', width: '100%',
        background: text.trim() ? 'rgba(76,201,240,0.10)' : 'transparent',
        border: `1px solid ${text.trim() ? T.accent + '55' : T.line}`,
        color: text.trim() ? T.accent : T.inkGhost,
        font: `600 11.5px/1 ${T.mono}`, letterSpacing: '0.24em', borderRadius: 4,
        cursor: text.trim() ? 'pointer' : 'not-allowed', WebkitTapHighlightColor: 'transparent', transition: 'all 0.12s',
      }}>SCORE IT</button>
      {estimateNote && (
        <div style={{ marginTop: 8, font: `10.5px/1.4 ${T.mono}`, color: T.inkFaint, letterSpacing: '0.03em' }}>{estimateNote}</div>
      )}

      <div style={{ marginTop: 34 }}>
        <div style={{ font: `600 9.5px/1 ${T.mono}`, letterSpacing: '0.2em', color: T.inkFaint, marginBottom: 14 }}>OR TRY ONE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {_NA.SAMPLES.map(s => (
            <button key={s.id} onClick={() => onSample(s)} style={{
              textAlign: 'left', padding: '13px 15px', background: T.surface,
              border: `1px solid ${T.line}`, borderRadius: 6, cursor: 'pointer',
              color: T.inkDim, font: `14px/1.4 ${T.sans}`, WebkitTapHighlightColor: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <span style={{ minWidth: 0 }}>{s.text}</span>
              <span style={{ color: T.accent, flexShrink: 0, font: `15px/1 ${T.sans}` }}>→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CHECKPOINT VIEW
// ════════════════════════════════════════════════════════════════════════════
function CheckpointView({ text, cid, onReset, onMath, onAdjust, verdictStyle, texture, ticks }) {
  const { v, c, result } = useNervaV11();
  const CheckpointCard = window.CheckpointCard;
  return (
    <div style={{ padding: '0 22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <button onClick={onReset} style={{
        alignSelf: 'flex-start', background: 'none', border: 'none', padding: '4px 0',
        color: T.inkDim, font: `13px/1 ${T.sans}`, cursor: 'pointer', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 6, WebkitTapHighlightColor: 'transparent',
      }}>
        <span style={{ color: T.accent }}>‹</span> New decision
      </button>

      <div style={{ font: `italic 300 16px/1.5 ${T.serif}`, color: T.inkDim, marginBottom: 18, paddingLeft: 12, borderLeft: `2px solid ${T.lineHi}` }}>
        {text}
      </div>

      <CheckpointCard
        result={result} v={v} c={c} cid={cid} verdictStyle={verdictStyle}
        texture={texture} ticks={ticks}
        onShowMath={onMath} onAdjust={onAdjust}
      />

      <div style={{ font: `11px/1.5 ${T.mono}`, color: T.inkGhost, letterSpacing: '0.04em', textAlign: 'center', marginTop: 18 }}>
        Reflection tool — not medical, legal, or financial advice.
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ROOT
// ════════════════════════════════════════════════════════════════════════════
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "verdict": "serif",
  "texture": true,
  "ticks": true
}/*EDITMODE-END*/;

function nearestSample(text) {
  const words = new Set(text.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 3));
  let best = _NA.SAMPLES[0], bestScore = -1;
  _NA.SAMPLES.forEach(s => {
    const sw = s.text.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 3);
    let score = 0; sw.forEach(w => { if (words.has(w)) score++; });
    if (score > bestScore) { bestScore = score; best = s; }
  });
  return best;
}

function NervaApp() {
  const { updateValue, updateConfidence } = useNervaV11();
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [text, setText] = useA('');
  const [view, setView] = useA('compose');      // compose | checkpoint
  const [cid, setCid] = useA('');
  const [estimateNote, setEstimateNote] = useA(null);
  const [safetyFlag, setSafetyFlag] = useA(null);
  const [adjustOpen, setAdjustOpen] = useA(false);
  const [mathOpen, setMathOpen] = useA(false);
  const [showDisclaimer, setShowDisclaimer] = useA(() => !localStorage.getItem('nerva_disclaim_v1'));

  const applyFactors = useACb((s) => {
    _NA.FACTORS.forEach(f => { updateValue(f.k, s.v[f.k]); updateConfidence(f.k, s.c[f.k]); });
  }, [updateValue, updateConfidence]);

  const makeCheckpoint = useACb((seed) => {
    setCid(_NA.checkpointId(seed));
    setView('checkpoint');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const onSample = useACb((s) => {
    setText(s.text);
    setEstimateNote(null);
    applyFactors(s);
    makeCheckpoint(s.text + s.id);
  }, [applyFactors, makeCheckpoint]);

  // onScore: keyword pre-screen → AI safety gate → AI parse.
  // Safety gate FAILS CLOSED: any error or timeout shows the stop screen.
  // Parse failure falls back to offline estimate.
  const onScore = useACb(async () => {
    setEstimateNote('Checking…');

    // Stage 1 + 2: keyword pre-screen then AI safety gate (fail-closed)
    const ns = window.NervaSafety;
    try {
      const category = ns
        ? await ns.checkSafety(text)
        : (_NA.classify(text) !== 'ok' ? _NA.classify(text) : 'safe');
      if (category !== 'safe') {
        setSafetyFlag(category === 'crisis' ? 'crisis' : 'professional');
        setEstimateNote(null);
        return;
      }
    } catch (_safetyErr) {
      // Endpoint failure (network, timeout, 500) → fail closed.
      // 'uncertain' = try-again screen, NOT the professional screen —
      // a network blip is not a statement about the user's decision.
      setSafetyFlag('uncertain');
      setEstimateNote(null);
      return;
    }

    // Stage 3: parse (has its own server-side safety backstop)
    setEstimateNote('Parsing…');
    try {
      const resp = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: text }),
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      if (data.safe) { setSafetyFlag(data.safe); setEstimateNote(null); return; }
      updateValue('E',  data.E);  updateConfidence('E',  data.cE);
      updateValue('S',  data.S);  updateConfidence('S',  data.cS);
      updateValue('R',  data.R);  updateConfidence('R',  data.cR);
      updateValue('Sp', data.Sp); updateConfidence('Sp', data.cSp);
      updateValue('St', data.St); updateConfidence('St', data.cSt);
      setEstimateNote(null);
      makeCheckpoint(text);
    } catch (_parseErr) {
      const s = nearestSample(text);
      applyFactors(s);
      setEstimateNote('Offline estimate — live AI parsing activates with the server.');
      makeCheckpoint(text);
    }
  }, [text, applyFactors, makeCheckpoint, updateValue, updateConfidence]);

  const dismiss = useACb(() => { localStorage.setItem('nerva_disclaim_v1', '1'); setShowDisclaimer(false); }, []);
  const reset = useACb(() => { setView('compose'); setEstimateNote(null); }, []);

  if (showDisclaimer) return <DisclaimerScreen onDismiss={dismiss} />;
  if (safetyFlag === 'uncertain') return <UncertainScreen onBack={() => setSafetyFlag(null)} />;
  if (safetyFlag) return <SafetyScreen flag={safetyFlag} onBack={() => setSafetyFlag(null)} />;

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, color: T.ink, fontFamily: T.sans, display: 'flex', flexDirection: 'column', overscrollBehavior: 'contain' }}>
      {/* logo */}
      <div style={{ padding: 'max(52px, calc(env(safe-area-inset-top) + 16px)) 28px 22px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ font: `600 10.5px/1 ${T.mono}`, letterSpacing: '0.42em', color: T.accent }}>NERVA</div>
        <div style={{ font: `9.5px/1 ${T.mono}`, color: T.inkGhost, letterSpacing: '0.16em' }}>v11</div>
      </div>

      {view === 'compose'
        ? <ComposeView text={text} setText={setText} onScore={onScore} onSample={onSample} estimateNote={estimateNote} />
        : <CheckpointView text={text} cid={cid} onReset={reset}
            onMath={() => setMathOpen(true)} onAdjust={() => setAdjustOpen(true)}
            verdictStyle={t.verdict} texture={t.texture} ticks={t.ticks} />}

      <div style={{ height: 'max(28px, env(safe-area-inset-bottom))', flexShrink: 0 }} />

      {adjustOpen && (
        <BottomSheet onClose={() => setAdjustOpen(false)} zIndex={20}>
          <AdjustSheet onClose={() => setAdjustOpen(false)} />
        </BottomSheet>
      )}
      {mathOpen && (
        <BottomSheet onClose={() => setMathOpen(false)} zIndex={20}>
          <MathSheet onClose={() => setMathOpen(false)} />
        </BottomSheet>
      )}

      {/* Tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Verdict" />
        <TweakRadio label="Emphasis" value={t.verdict}
          options={['serif', 'mono']}
          onChange={v => setTweak('verdict', v)} />
        <TweakSection label="The instruments" />
        <TweakToggle label="Confidence texture" value={t.texture}
          onChange={v => setTweak('texture', v)} />
        <TweakToggle label="Gauge tick marks" value={t.ticks}
          onChange={v => setTweak('ticks', v)} />
      </TweaksPanel>
    </div>
  );
}

window.NervaApp = NervaApp;
window.__nervaTweakState = TWEAK_DEFAULTS;
