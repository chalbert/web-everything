/**
 * @file scripts/operations/gap-sweep-status.mjs
 * @description THE `gap-sweep-status` DECLARATION (#xkp1mv8, under epic #3029) — a thin wrap of the existing,
 *   already-tested `we:scripts/gap-sweep-status.mjs` CLI (backlog epic #315's status/snapshot/diff helper).
 *
 * IT DECLARES OVER AN EXISTING HOME, IT DOES NOT REPLACE ONE — same relationship `./verify.mjs` has to
 * `we:scripts/verify-lane.mjs`. The CLI already validates the sweep's three JSON files, prints status, snapshots
 * a baseline, and diffs against one; nothing about that logic is re-derived here. This only maps its three
 * modes onto one declared surface, so a caller gets `run.mjs gap-sweep-status` for free instead of a raw
 * `node scripts/gap-sweep-status.mjs [--snapshot|--baseline=PATH]` line every skill has to remember separately.
 *
 * THE OUTCOME IS THREE-VALUED, same shape as `verify`'s `pass`/`fail`/`unrun`: `ok` (the CLI's own invariant
 * gate passed), `violations` (it printed a parseable violation report), and `unrun` (anything else — a crash,
 * a missing `--baseline` file, output that did not match either format). A non-zero exit with no parseable
 * violations block is NOT folded into `violations`: the CLI's own invariant errors are printed in one fixed
 * format, and a bad `--baseline` path instead throws an uncaught `ENOENT` with a Node stack trace. Reading
 * that as "gap sweep invariants failed" would certify a usage error as a real finding about the sweep's data.
 *
 * THE ONE STEP IS AN `effect`, NOT A `compute`, EVEN THOUGH TWO OF ITS THREE MODES ONLY READ. The step kind is
 * fixed at declaration time and `mode` is a runtime input, so a `compute` classification would put `mode:
 * snapshot` — which writes a file under `reports/gap-sweep-snapshots/` — on `./http-adapter.mjs`'s GET-only
 * surface alongside `status` and `diff`. `./mutation-check.mjs` draws the same line for the same reason: the
 * step's safety classification cannot depend on which mode a particular call happens to choose.
 *
 * PURE apart from the injected effect: no fs, no clock, no process, no network in this file. The subprocess
 * shell lives in `./gap-sweep-status-io.mjs`, behind the effect, so every branch below is reachable in a test
 * with no `node` spawn.
 */
import { op } from './registry.mjs';
import { DECLARED_HOMES } from './declared-homes.mjs';
import { compute, effect as effectStep } from './step-kinds.mjs';

export const GAP_SWEEP_STATUS_OP = 'gap-sweep-status';

/** The one effect this declaration performs: one shell of the CLI. */
export const GAP_SWEEP_STATUS_EFFECT = 'gap-sweep-status.run';

/** The CLI's three modes, matching its own header: `(no args)` / `--snapshot` / `--baseline=PATH`. */
export const GAP_SWEEP_MODES = Object.freeze(['status', 'snapshot', 'diff']);

/** The three outcomes one run can have. `unrun` is not a flavour of `violations` — see the header. */
export const GAP_SWEEP_OUTCOMES = Object.freeze(['ok', 'violations', 'unrun']);

/**
 * Shape the injected runner's result into the `run` finding.
 *
 * Refuses an unrecognised `outcome` rather than reporting a benign default — the same reason
 * `verify.shapeRunFinding` refuses an unknown check outcome: a runner that cannot say which of the three
 * happened has not answered the question, and guessing would let a wrong reading arrive as a quiet `ok`.
 */
export function shapeRunFinding(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('gap-sweep-status.run: the injected runner must return a result object');
  }
  if (!GAP_SWEEP_OUTCOMES.includes(raw.outcome)) {
    throw new Error(
      `gap-sweep-status.run: reported outcome ${JSON.stringify(raw.outcome)} — must be one of `
      + `${GAP_SWEEP_OUTCOMES.join('|')}. A run whose result could not be classified is \`unrun\`, never \`ok\`.`,
    );
  }
  return {
    mode: String(raw.mode ?? ''),
    outcome: raw.outcome,
    violations: Array.isArray(raw.violations) ? raw.violations.map(String) : [],
    snapshotPath: typeof raw.snapshotPath === 'string' ? raw.snapshotPath : '',
    // Three-valued itself: `null` means "not applicable to this mode" (only `diff` reports it), never "no".
    noop: raw.noop === true || raw.noop === false ? raw.noop : null,
    reason: typeof raw.reason === 'string' ? raw.reason : '',
    report: typeof raw.report === 'string' ? raw.report : '',
  };
}

/**
 * Reduce the run to one verdict. PURE.
 *
 * `ok` requires the CLI's own invariant gate to have actually passed — never merely "no violations were
 * reported", which an `unrun` crash would also satisfy vacuously.
 */
export function assessRun(finding) {
  const ok = finding.outcome === 'ok';
  const blocking = finding.outcome === 'violations'
    ? finding.violations.map((v) => ({ why: 'invariant-violation', detail: v }))
    : finding.outcome === 'unrun'
      ? [{ why: 'did-not-run', detail: finding.reason || 'no reason reported' }]
      : [];
  return {
    mode: finding.mode,
    ok,
    outcome: finding.outcome,
    violations: finding.violations,
    blocking,
    // Mode-specific facts, present only where they apply — an absent `snapshotPath` on a `status` run is not
    // the same fact as an empty one on a `snapshot` run that somehow wrote nowhere.
    ...(finding.mode === 'snapshot' ? { snapshotPath: finding.snapshotPath } : {}),
    ...(finding.mode === 'diff' && finding.noop !== null ? { noop: finding.noop } : {}),
  };
}

/**
 * Build the declaration. NO INJECTED DEPS: same as `mutationCheckOperation`, the transaction is an EFFECT, so
 * it arrives through the sink registered in `./run.mjs` rather than through this builder. Tests supply a stub
 * sink instead of a stub function, which is the same substitution one layer out.
 */
export function gapSweepStatusOperation() {
  return op(GAP_SWEEP_STATUS_OP, {
    declaresOver: DECLARED_HOMES['gap-sweep-status'],
    input: {
      mode: { type: 'string', required: false, default: 'status', enum: [...GAP_SWEEP_MODES] },
      // Required only for `mode: 'diff'`; the effect below refuses the combination rather than the schema,
      // since an unconditional `required: true` would break the other two modes, which take no baseline at all.
      baseline: { type: 'string', required: false, default: '' },
    },
    verdictFrom: 'assess',

    run: effectStep({
      reads: ['input.mode', 'input.baseline'],
      effects: (view) => {
        const { mode, baseline } = view.input;
        if (mode === 'diff' && !baseline.trim()) {
          throw new Error("gap-sweep-status: `mode: 'diff'` requires a non-empty `baseline` path");
        }
        return [{ type: GAP_SWEEP_STATUS_EFFECT, payload: { mode, baseline } }];
      },
    }),

    assess: compute({
      reads: ['findings.run'],
      // The engine records an effect's return value under `effects[].result`, so this reads the same runner
      // result it always did, one indirection further in — same pattern `mutation-check.assess` uses.
      fn: (view) => {
        const entry = (view.findings.run?.effects ?? [])[0];
        if (!entry || entry.status !== 'applied' || !entry.result) {
          throw new Error(
            'gap-sweep-status.assess: the run effect did not complete, so there is no result to judge. '
            + `status=${entry?.status ?? 'missing'}${entry?.error ? ` error=${entry.error}` : ''}`,
          );
        }
        return assessRun(shapeRunFinding(entry.result));
      },
    }),
  });
}
