/**
 * @file scripts/operations/gate-health.mjs
 * @description THE `gate-health` DECLARATION — *are the review-escalation criteria selecting the right pull
 *   requests?*, as a declared operation callable from the command line and over HTTP.
 *
 * ── WHY IT IS AN OPERATION RATHER THAN A SCRIPT ─────────────────────────────────────────────────────────────
 *
 * Because the question is not asked once. Review parameters are heading for per-project tuning and A/B
 * comparison, and the arithmetic that decides "did variant B actually beat A" is the same arithmetic that
 * decides "are today's criteria any good". A one-off script answers it once, gets thrown away, and its
 * confounds get rediscovered by the next person — this repo has already paid that cost twice on measurement
 * helpers that shipped without their generator.
 *
 * It is **`compute`, both steps** — the closed vocabulary is `compute | judge | confirm | effect`
 * ({@link ./step-kinds.mjs}) and this needs none of the other three: no juror to spawn, no person to ask,
 * nothing to apply. {@link ./http-adapter.mjs} reads that off the step kinds and gives it a `GET`-only
 * surface with no run records and no resume route, exactly as it does for `suggest-next`.
 *
 * AND IT ONLY READS, which is a separate fact this file keeps rather than the engine enforcing it. Its whole
 * import graph is `registry`, `step-kinds` and `lib/gate-health` — no `node:` specifier, so the step
 * functions hold no writer in scope. The injected reader IS the remaining surface:
 * {@link ./gate-health-io.mjs} shells out to `gh` and `git`, and both invocations are read-only. That is a
 * promise this repo keeps, not a property the adapter can verify.
 *
 * ── IT RE-DECLARES; IT DOES NOT RE-IMPLEMENT ────────────────────────────────────────────────────────────────
 *
 *   | step       | kind      | the implementation behind it                                                  |
 *   |------------|-----------|-------------------------------------------------------------------------------|
 *   | `history`  | `compute` | the injected reader — `gh pr list` + `git log --first-parent`, joined by         |
 *   |            |           | `joinHistory` (`we:scripts/operations/gate-health-io.mjs`)                      |
 *   | `assess`   | `compute` | `assessCriteria` (`we:scripts/lib/gate-health.mjs`) — stratification, the        |
 *   |            |           | review-followup correction, and the confidence interval                         |
 *
 * If a reader finds statistics in THIS file rather than a call into `lib/gate-health.mjs`, that is the bug.
 *
 * ── THE ANSWER IT USUALLY GIVES, AND WHY THAT IS THE POINT ──────────────────────────────────────────────────
 *
 * Over 300 merged PRs the honest verdict is normally *"no size band has enough observations to support a
 * comparison"*. That is not the tool failing. A naive version of this measurement returns a confident-looking
 * 23%-versus-7% that is almost entirely PR size and reviews doing their job; the corrections in
 * `lib/gate-health.mjs` remove both, and what is left is too small to call. Reporting that plainly is the
 * feature — the alternative is a parameter change made on noise.
 */
import { op } from './registry.mjs';
import { compute } from './step-kinds.mjs';
import { assessCriteria, classifyFollowUp, SIZE_BANDS } from '../lib/gate-health.mjs';

/** The operation's stable id. Adapters resolve it by this name. */
export const GATE_HEALTH_OP = 'gate-health';

/** The constellation repos this may be asked about — a CLOSED SET, refused before a run record exists. */
export const GATE_HEALTH_REPOS = Object.freeze([
  'chalbert/web-everything',
  'chalbert/frontierui',
  'chalbert/plateau-app',
]);

export const DEFAULT_LIMIT = 300;
export const MAX_LIMIT = 1000;

/**
 * Clamp the history window rather than refuse it — the declaration vocabulary has `enum` but no numeric
 * range, and refusing inside the first step would mean the refusal arrives after a run record exists. Same
 * reasoning, and the same known gap, as `clampLimit` in {@link ./suggest-next.mjs}.
 *
 * Both the requested and the applied value are reported so nothing is silently swallowed — which matters more
 * here than for a page size: the sample size IS the result's credibility, so a caller who asked for 1000 and
 * silently got 300 would read an underpowered verdict as a real one.
 */
export function clampLimit(requested) {
  const n = Math.floor(Number(requested));
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(n, 10), MAX_LIMIT);
}

/**
 * SHAPE the injected read into the `history` finding. PURE — separated from the reader so every refusal below
 * is testable with no `gh` and no repository.
 *
 * @param {object} raw - `{repo, records, unmeasurable, hotFiles}` from the reader.
 * @returns {object} the `history` finding.
 */
export function shapeHistoryFinding(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.records)) {
    throw new Error(
      'gate-health.history: the injected reader must return `{ records: [...] }`. Refusing an unknown shape '
      + 'rather than assessing an empty history and reporting "no signal" — an empty result and a broken '
      + 'reader are the same output otherwise, and the second one silently reads as the first.',
    );
  }
  return {
    repo: String(raw.repo ?? 'unknown'),
    records: raw.records,
    measured: raw.records.length,
    // A PR is UNMEASURABLE when its merge commit is outside the log window, or when every file it touched is
    // high-churn (so any later commit would "follow" it). Reported, never silently dropped: a caller must be
    // able to tell a small sample from a large one that mostly failed to measure.
    unmeasurable: Number(raw.unmeasurable) || 0,
    hotFilesExcluded: Array.isArray(raw.hotFiles) ? raw.hotFiles.length : 0,
  };
}

/**
 * @param {object} deps
 * @param {(o: {limit:number, windowDays:number}) => object} deps.loadHistory - the merged-PR + commit read.
 *   `we:scripts/operations/gate-health-io.mjs` supplies the real one; tests supply fixtures.
 * @returns {object} the frozen declaration from `op()`.
 */
export function gateHealthOperation({ loadHistory } = {}) {
  if (typeof loadHistory !== 'function') {
    throw new TypeError(
      'gate-health: needs a `loadHistory()` reader — the io is INJECTED so the declaration stays testable '
      + 'without `gh`; the real binding is `we:scripts/operations/gate-health-io.mjs`.',
    );
  }

  return op(GATE_HEALTH_OP, {
    input: {
      repo: { type: 'string', required: false, default: GATE_HEALTH_REPOS[0], enum: [...GATE_HEALTH_REPOS] },
      // How many merged PRs to read back. Clamped — see {@link clampLimit}.
      limit: { type: 'number', required: false, default: DEFAULT_LIMIT },
      // How long after a merge a fix still counts as following it.
      windowDays: { type: 'number', required: false, default: 14 },
    },
    // The assessment IS the run's verdict — declared, not inferred by a caller reading findings.
    verdictFrom: 'assess',

    // ── 1. history ──────────────────────────────────────────────────────────────────────────────────────────
    history: compute({
      reads: ['input.repo', 'input.limit', 'input.windowDays'],
      fn: (view) => shapeHistoryFinding(loadHistory({
        limit: clampLimit(view.input.limit),
        windowDays: Math.max(1, Math.floor(Number(view.input.windowDays) || 14)),
      })),
    }),

    // ── 2. assess ───────────────────────────────────────────────────────────────────────────────────────────
    // Stratify, correct for review-driven follow-ups, and interval the difference. All of it in
    // `lib/gate-health.mjs`; this step adds no arithmetic of its own.
    assess: compute({
      reads: ['input.limit', 'findings.history'],
      fn: (view) => {
        const h = view.findings.history;
        return {
          repo: h.repo,
          requestedLimit: view.input.limit,
          limit: clampLimit(view.input.limit),
          measured: h.measured,
          unmeasurable: h.unmeasurable,
          hotFilesExcluded: h.hotFilesExcluded,
          bandEdges: SIZE_BANDS.map(([label, min]) => ({ band: label, minLines: min })),
          // `parameterSet` stays null until the escalation record carries the policy-contract version. The
          // caveat travels WITH the numbers rather than sitting in a report, because the numbers are what a
          // web caller renders.
          ...assessCriteria({ records: h.records, parameterSet: null }),
        };
      },
    }),
  });
}

/** Re-exported so a caller can build the reader without importing the analysis lib separately. */
export { classifyFollowUp };
