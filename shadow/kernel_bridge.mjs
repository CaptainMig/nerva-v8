// shadow/kernel_bridge.mjs — read-only executor for the FROZEN v11.1 kernel.
//
// The kernel source is read from the git tag `v11.1-stable` blob, NOT from the
// working tree. Editing nerva-v11-core.jsx on this branch cannot change what
// this bridge computes; the shadow verdicts always come from the frozen bytes.
//
// The frozen file is a browser script (React + window globals), so it runs in
// a Node vm sandbox with those globals stubbed. Its top-level function
// declarations (evaluate, aggConfidence, ...) become sandbox globals, which
// lets us:
//   1. call the frozen evaluate() verbatim for the verdict of record, and
//   2. compute the SHADOW verdict by re-running the same frozen evaluate()
//      with aggConfidence temporarily overridden to return C_empirical —
//      zero kernel logic is duplicated here.
//
// ONE-WAY BRAKE INVARIANT (documented for any future promotion; nothing
// consumes shadow output today): Grok dissent may reduce C or escalate a
// verdict toward HOLD/WAIT/CONSULT(ESCALATE); subsequent agreement must NEVER
// release a tripped brake or upgrade a verdict. See shadow/brake.py.
//
// Protocol: JSON on stdin -> JSON on stdout.
//   in : { records: [ { values: {E,S,R,Sp,St},
//                       confidences: {E,S,R,Sp,St},
//                       opts?: {},
//                       c_empirical?: number|null } ] }
//   out: { kernel_ref, kernel_blob_sha, conf_weights,
//          results: [ { record: <evaluate() result>,
//                       shadow: <evaluate() result with C := c_empirical> | null } ] }

import { execFileSync } from 'node:child_process';
import { createContext, Script } from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KERNEL_REF = process.env.NERVA_KERNEL_REF || 'v11.1-stable';
const KERNEL_PATH = 'nerva-v11-core.jsx';

function git(...args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
}

const kernelSource = git('show', `${KERNEL_REF}:${KERNEL_PATH}`);
const kernelBlobSha = git('rev-parse', `${KERNEL_REF}:${KERNEL_PATH}`).trim();

// Minimal stubs: only React.createContext and window are touched at the
// frozen file's top level; the rest exist so nothing throws if reached.
const noop = () => {};
const sandbox = {
  React: {
    createContext: () => ({ Provider: {}, Consumer: {} }),
    createElement: noop,
    useContext: noop, useState: noop, useMemo: noop,
    useEffect: noop, useCallback: noop, useRef: noop,
  },
  window: {},
  Math, console, Date,
};
createContext(sandbox);
new Script(kernelSource, { filename: `${KERNEL_REF}:${KERNEL_PATH}` }).runInContext(sandbox);

if (typeof sandbox.evaluate !== 'function' || typeof sandbox.aggConfidence !== 'function') {
  process.stderr.write('kernel_bridge: frozen kernel did not expose evaluate/aggConfidence\n');
  process.exit(2);
}

// Extract the kernel's own per-axis aggregation weights (CONF_WEIGHTS) by
// probing the frozen aggConfidence with unit vectors — the const itself is
// not reachable from outside, and we do not hardcode a copy here.
const AXES = ['E', 'S', 'R', 'Sp', 'St'];
const confWeights = {};
for (const axis of AXES) {
  const unit = { E: 0, S: 0, R: 0, Sp: 0, St: 0, [axis]: 1 };
  confWeights[axis] = sandbox.aggConfidence(unit);
}

function evaluateRecord(rec) {
  const opts = rec.opts || {};
  const record = sandbox.evaluate(rec.values, rec.confidences, opts);

  let shadow = null;
  if (rec.c_empirical !== undefined && rec.c_empirical !== null) {
    const original = sandbox.aggConfidence;
    sandbox.aggConfidence = () => rec.c_empirical;
    try {
      shadow = sandbox.evaluate(rec.values, rec.confidences, opts);
    } finally {
      sandbox.aggConfidence = original;
    }
  }
  return { record, shadow };
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const req = JSON.parse(input);
    const results = (req.records || []).map(evaluateRecord);
    process.stdout.write(JSON.stringify({
      kernel_ref: KERNEL_REF,
      kernel_blob_sha: kernelBlobSha,
      conf_weights: confWeights,
      results,
    }));
  } catch (err) {
    process.stderr.write(`kernel_bridge: ${err.message}\n`);
    process.exit(1);
  }
});
