// checkpoint-card.jsx — the swipeable Checkpoint instrument.
// Face 1: the Verdict (cockpit chrome). Face 2: the Read (five factor
// instruments + plain-language weak-link callout). Math stays opt-in below.

'use strict';

const { useState: useCC, useRef: useCCRef, useEffect: useCCEffect,
        useLayoutEffect: useCCLayout, useCallback: useCCCb } = React;

const _N = window.NERVA;

// ── INSTRUMENT BAR ─────────────────────────────────────────────────────────
// Two encodings at once: bar FILL = the value, bar TEXTURE = your confidence.
// A firm read reads as solid; a guess reads as a ghosted, hatched, unstable
// bar. That is the v11 story made visual — and defensible in plain language.
function InstrumentBar({ factor, value, conf, weak, texture = true, ticks = true }) {
  const T = _N.T;
  const isRisk = factor.inverted;
  const base = isRisk ? T.amber : T.accent;
  const band = texture ? _N.confBand(conf) : 'firm';   // firm | rough | guess
  const pct = Math.max(2, Math.round(value * 100));

  // Texture by confidence band
  let fillBg, fillOpacity, overlay, topEdge;
  if (band === 'firm') {
    fillBg = base; fillOpacity = 1; overlay = 'none';
    topEdge = `0 0 0 0.5px ${base}`;
  } else if (band === 'rough') {
    fillBg = base; fillOpacity = 0.82;
    overlay = `repeating-linear-gradient(90deg, rgba(10,14,21,0) 0 5px, rgba(10,14,21,0.5) 5px 6px)`;
    topEdge = 'none';
  } else { // guess — ghosted + diagonal hatch, looks unstable
    fillBg = base; fillOpacity = 0.4;
    overlay = `repeating-linear-gradient(-45deg, rgba(10,14,21,0) 0 4px, rgba(10,14,21,0.6) 4px 7px)`;
    topEdge = 'none';
  }

  const chipColor = _N.confColor(conf);

  return (
    <div style={{
      padding: '13px 14px',
      borderRadius: 7,
      background: weak ? 'rgba(255,154,60,0.06)' : 'transparent',
      boxShadow: weak ? `inset 2px 0 0 ${T.amber}` : 'none',
      transition: 'background 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 9 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
          <span style={{ font: `600 14.5px/1 ${T.sans}`, color: T.ink }}>{factor.label}</span>
          {isRisk && (
            <span style={{ font: `600 8.5px/1 ${T.mono}`, color: T.amber, letterSpacing: '0.12em', opacity: 0.85 }}>
              DOWNSIDE ↑
            </span>
          )}
          {weak && (
            <span style={{ font: `600 8.5px/1 ${T.mono}`, color: T.amber, letterSpacing: '0.12em' }}>
              WEAK LINK
            </span>
          )}
        </div>
        {/* confidence chip — names what the texture shows */}
        <span style={{
          font: `600 9px/1 ${T.mono}`, letterSpacing: '0.08em',
          color: chipColor, whiteSpace: 'nowrap', flexShrink: 0,
          padding: '3px 6px', borderRadius: 3,
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${chipColor}33`,
        }}>{_N.confChipLabel(conf).toUpperCase()}</span>
      </div>

      {/* the gauge */}
      <div style={{ position: 'relative', height: 12, borderRadius: 3, background: 'rgba(232,227,216,0.05)', overflow: 'hidden' }}>
        {/* tick marks */}
        {ticks && [25, 50, 75].map(t => (
          <div key={t} style={{ position: 'absolute', left: `${t}%`, top: 0, bottom: 0, width: 1, background: 'rgba(232,227,216,0.10)' }} />
        ))}
        {/* fill */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`,
          background: fillBg, opacity: fillOpacity,
          borderRadius: '3px 2px 2px 3px',
          boxShadow: topEdge === 'none' ? 'none' : topEdge,
          transition: 'width 0.35s cubic-bezier(0.32,0.72,0,1), opacity 0.2s',
        }}>
          {overlay !== 'none' && (
            <div style={{ position: 'absolute', inset: 0, background: overlay, borderRadius: 'inherit' }} />
          )}
        </div>
        {/* leading edge marker */}
        <div style={{
          position: 'absolute', left: `calc(${pct}% - 1px)`, top: -1, bottom: -1, width: 2,
          background: band === 'guess' ? `${base}66` : base,
          boxShadow: `0 0 6px ${base}`, borderRadius: 1,
          transition: 'left 0.35s cubic-bezier(0.32,0.72,0,1)',
        }} />
      </div>

      <div style={{ marginTop: 7, font: `12px/1.4 ${T.sans}`, color: T.inkFaint }}>{factor.desc}</div>
    </div>
  );
}

// ── VERDICT FACE ────────────────────────────────────────────────────────────
function VerdictFace({ result, rationale, cid, vstyle = 'serif' }) {
  const T = _N.T;
  const vc = _N.VC[result.decision] || T.ink;
  const word = _N.verdictWord(result.decision);
  const gloss = _N.VGLOSS[result.decision] || '';
  const mono = vstyle === 'mono';

  return (
    <div style={{ padding: '20px 22px 22px', display: 'flex', flexDirection: 'column' }}>
      {/* cockpit header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ font: `600 9.5px/1 ${T.mono}`, letterSpacing: '0.22em', color: T.inkFaint }}>
          CHECKPOINT
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, font: `9.5px/1 ${T.mono}`, color: T.inkFaint }}>
          <span style={{ letterSpacing: '0.08em' }}>{cid}</span>
          <span style={{ width: 5, height: 5, borderRadius: 5, background: vc, boxShadow: `0 0 7px ${vc}` }} />
        </span>
      </div>

      {/* the readout */}
      <div style={{ position: 'relative', padding: '30px 0 26px', textAlign: 'center' }}>
        {/* soft instrument glow */}
        <div style={{
          position: 'absolute', left: '50%', top: '48%', width: 240, height: 240,
          transform: 'translate(-50%,-50%)', borderRadius: '50%',
          background: `radial-gradient(circle, ${vc}22 0%, ${vc}0d 42%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative' }}>
          <div style={{ font: `600 9px/1 ${T.mono}`, letterSpacing: '0.34em', color: T.inkFaint, marginBottom: 16 }}>
            VERDICT
          </div>
          <div style={mono
            ? { font: `600 52px/0.95 ${T.mono}`, color: vc, letterSpacing: '0.04em', textShadow: `0 0 30px ${vc}55`, textTransform: 'uppercase' }
            : { font: `200 76px/0.9 ${T.serif}`, color: vc, letterSpacing: '-0.03em', textShadow: `0 0 36px ${vc}55` }
          }>{mono ? result.decision : word}</div>
          <div style={{ font: `italic 300 16px/1 ${T.serif}`, color: T.inkDim, marginTop: 14, letterSpacing: '0.01em' }}>
            {gloss}
          </div>
        </div>
      </div>

      {/* plain rationale */}
      <div style={{
        font: `15px/1.6 ${T.sans}`, color: T.inkDim, textAlign: 'center',
        maxWidth: 320, margin: '0 auto',
      }}>{rationale}</div>
    </div>
  );
}

// ── READ FACE ───────────────────────────────────────────────────────────────
function ReadFace({ result, v, c, read, onShowMath, onAdjust, texture = true, ticks = true }) {
  const T = _N.T;
  const vc = _N.VC[result.decision] || T.ink;

  return (
    <div style={{ padding: '20px 8px 18px' }}>
      {/* header + the terminal narrative, in human language */}
      <div style={{ padding: '0 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ font: `600 9.5px/1 ${T.mono}`, letterSpacing: '0.2em', color: T.inkFaint }}>
            THE READ
          </span>
          <span style={{ font: `9.5px/1 ${T.mono}`, color: vc, letterSpacing: '0.1em' }}>
            → {_N.verdictWord(result.decision).toUpperCase()}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
          {['PARSED', 'WEIGHED', 'GATED'].map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span style={{ flex: 1, height: 1, background: T.line }} />}
              <span style={{
                font: `600 8.5px/1 ${T.mono}`, letterSpacing: '0.12em',
                color: T.accent, opacity: 0.7,
              }}>{s}</span>
            </React.Fragment>
          ))}
        </div>
        <div style={{ font: `400 19px/1.3 ${T.serif}`, color: T.ink, letterSpacing: '-0.01em', marginBottom: 4 }}>
          {read.headline}
        </div>
      </div>

      {/* the five instruments */}
      <div style={{ marginTop: 8 }}>
        {_N.FACTORS.map(f => (
          <InstrumentBar
            key={f.k}
            factor={f}
            value={v[f.k]}
            conf={c[f.k]}
            weak={f.k === read.weakKey}
            texture={texture}
            ticks={ticks}
          />
        ))}
      </div>

      {/* weak-link callout — plain language */}
      <div style={{
        margin: '10px 14px 0', padding: '14px 16px', borderRadius: 7,
        background: 'rgba(255,154,60,0.07)', border: '1px solid rgba(255,154,60,0.22)',
      }}>
        <div style={{ font: `600 8.5px/1 ${T.mono}`, letterSpacing: '0.16em', color: T.amber, marginBottom: 9 }}>
          WHY, IN PLAIN ENGLISH
        </div>
        <div style={{ font: `14.5px/1.55 ${T.sans}`, color: T.ink }}>{read.callout}</div>
      </div>

      {/* actions */}
      <div style={{ display: 'flex', gap: 8, margin: '14px 14px 0' }}>
        <button onClick={onAdjust} style={{
          flex: 1, padding: '12px 0', background: 'transparent',
          border: `1px solid ${T.lineHi}`, color: T.inkDim,
          font: `600 10.5px/1 ${T.mono}`, letterSpacing: '0.12em',
          borderRadius: 5, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
        }}>ADJUST INPUTS</button>
        <button onClick={onShowMath} style={{
          flex: 1, padding: '12px 0', background: 'rgba(76,201,240,0.08)',
          border: `1px solid ${T.accent}44`, color: T.accent,
          font: `600 10.5px/1 ${T.mono}`, letterSpacing: '0.12em',
          borderRadius: 5, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
        }}>SHOW THE MATH →</button>
      </div>
    </div>
  );
}

// ── SWIPE / FLIP CARD ────────────────────────────────────────────────────────
// style: 'slide' (drag-follow carousel) | 'flip' (3D) | 'lift' (read rises up)
function CheckpointCard({ result, v, c, cid, verdictStyle = 'serif', texture = true, ticks = true, onShowMath, onAdjust }) {
  const T = _N.T;
  const [page, setPage] = useCC(0);          // 0 = verdict, 1 = read
  const [dragging, setDragging] = useCC(false);

  const vc = _N.VC[result.decision] || T.ink;
  const rationale = _N.buildRationale(result, c);
  const read = _N.buildRead(result, v, c);

  const start = useCCRef(null);
  const dir = useCCRef(1);                     // enter direction: +1 fwd, -1 back

  const go = useCCCb((p) => {
    setPage(prev => {
      const np = Math.max(0, Math.min(1, p));
      dir.current = np >= prev ? 1 : -1;
      return np;
    });
  }, []);

  // pointer swipe — horizontal flips the page; vertical scrolls the page
  const onDown = useCCCb((e) => { start.current = { x: e.clientX, y: e.clientY, t: Date.now() }; setDragging(true); }, []);
  const onUp = useCCCb((e) => {
    if (!start.current) { setDragging(false); return; }
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    const dt = Date.now() - start.current.t;
    if (Math.abs(dx) > Math.abs(dy)) {
      const fast = Math.abs(dx) / Math.max(dt, 1) > 0.4;
      if (fast || Math.abs(dx) > 56) { if (dx < 0) go(page + 1); else go(page - 1); }
    }
    start.current = null;
    setDragging(false);
  }, [page, go]);

  // NOTE: this runtime can freeze CSS transitions/animations at their first
  // frame, so the resting state must be static. Faces are key-remounted (fresh
  // mount = correct initial styles); motion is conveyed by the swipe + dots.
  const activeFace = page === 0
    ? <VerdictFace result={result} rationale={rationale} cid={cid} vstyle={verdictStyle} />
    : <ReadFace result={result} v={v} c={c} read={read} onShowMath={onShowMath} onAdjust={onAdjust} texture={texture} ticks={ticks} />;

  const body = (
    <div key={page + '-' + verdictStyle} style={{ position: 'relative' }}>
      {activeFace}
    </div>
  );

  const hints = ['Swipe for the read', 'The factors behind it'];

  return (
    <div style={{
      borderRadius: 14, background: T.surface,
      border: `1px solid ${T.line}`,
      boxShadow: `0 1px 0 rgba(255,255,255,0.03) inset, 0 18px 50px -24px ${vc}40, 0 10px 30px -18px rgba(0,0,0,0.8)`,
      overflow: 'hidden',
      transition: 'height 0.42s cubic-bezier(0.32,0.72,0,1)',
    }}>
      {/* swipe surface */}
      <div
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ touchAction: 'pan-y', cursor: dragging ? 'grabbing' : 'grab' }}
      >
        {body}
      </div>

      {/* persistent nav chrome (cockpit footer) */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 18px', borderTop: `1px solid ${T.line}`,
        background: T.bgDeep,
      }}>
        <button onClick={() => go(page - 1)} disabled={page === 0} style={{
          background: 'none', border: 'none', cursor: page === 0 ? 'default' : 'pointer',
          color: page === 0 ? T.inkGhost : T.inkDim, font: `15px/1 ${T.sans}`,
          padding: '4px 6px', opacity: page === 0 ? 0.4 : 1, WebkitTapHighlightColor: 'transparent',
        }}>←</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {[0, 1].map(i => (
            <button key={i} onClick={() => go(i)} style={{
              background: 'none', border: 'none', padding: 4, cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}>
              <span style={{
                display: 'block',
                width: i === page ? 22 : 6, height: 6, borderRadius: 3,
                background: i === page ? vc : T.lineHi,
                boxShadow: i === page ? `0 0 8px ${vc}66` : 'none',
              }} />
            </button>
          ))}
          <span style={{ font: `10px/1 ${_N.T.mono}`, color: T.inkFaint, letterSpacing: '0.06em', marginLeft: 4 }}>
            {hints[page]}
          </span>
        </div>

        <button onClick={() => go(page + 1)} disabled={page === 1} style={{
          background: 'none', border: 'none', cursor: page === 1 ? 'default' : 'pointer',
          color: page === 1 ? T.inkGhost : T.accent, font: `15px/1 ${T.sans}`,
          padding: '4px 6px', opacity: page === 1 ? 0.4 : 1, WebkitTapHighlightColor: 'transparent',
        }}>→</button>
      </div>
    </div>
  );
}

window.CheckpointCard = CheckpointCard;
