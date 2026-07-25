/**
 * micro-decision-surface.mjs — the SURFACING half of #2650 (micro-decision surfacing + challenge loop, last
 * piece of the autonomous jury layer, ratified record 273a2dbd; child of #2577).
 *
 * WHY: #2652's disposition judge (`disposition-judge.mjs`) classifies a review's jury ledger as `auto-dispose`
 * (auto-clear, no human) or `escalate` (needs a human). A prepared DECISION is a SET of forks, each carrying its
 * own jury ledger. Running the judge PER FORK yields a per-fork contention map: some forks auto-clear, some are
 * CONTESTED (escalate). The human should only ever be handed the CONTESTED forks — one micro-choice at a time —
 * not the whole decision. This module is that reduction: it CONSUMES the judge's per-fork disposition (it does
 * NOT re-derive contention) and emits the ordered micro-decision QUEUE the console surface (plateau-app:src/)
 * walks one fork at a time.
 *
 * SPLIT OF OWNERSHIP (the item's cross-locus seam):
 *   • THIS module (we:scripts/) owns WHICH forks are contested, in what ORDER, and WHY (the judge's reason +
 *     trail). It is pure: no I/O, no side effects, deterministic — the same per-fork ledgers always yield the
 *     same queue. It is the contract shape the UI mirrors (like `decision-forks.ts` mirrors the WE projection).
 *   • The plateau-app console owns the PRESENTATION — surfacing the contested forks one at a time, and the three
 *     challenge-loop affordances (challenge the disposition · ask a question · open for full discussion). It
 *     consumes the DTO this module produces; it never re-runs the judge.
 *
 * A CONTESTED fork is exactly one whose combined disposition is `escalate` (green proposed escalate, OR green
 * proposed auto-dispose and the red judge refuted it). An auto-cleared fork is one whose disposition survives to
 * `auto-dispose`. Fail-closed is inherited from the judge: any fork the judge cannot prove safe (unreadable
 * ledger, missing mandatory lens, gate-self, dissent) surfaces as CONTESTED — surfacing MORE, never fewer, so a
 * doubtful fork always reaches the human.
 *
 * Pure, unit-tested in `we:scripts/lib/__tests__/micro-decision-surface.test.mjs`.
 */
import { disposeVerdict, DISPOSITIONS } from './disposition-judge.mjs';
import { resolveDispositionConfig } from './review-policy.mjs';
import { MANDATORY_LENSES } from './jury-core.mjs';

/**
 * @typedef {Object} ForkInput
 * @property {number} n - the fork number (`## Fork N`), used for identity + default ordering.
 * @property {string} [question] - the fork's question heading (carried through for the surface to render).
 * @property {string} [recommendedDefault] - the fork's recommended-default line, carried through for context.
 * @property {Array<object>} [ledger] - this fork's jury-ledger events (the #2654 append-only stream).
 * @property {{lensWeights: object, dissentThreshold: number, resolutionMode: string}} [config] - a RESOLVED
 *   #2651 disposition config for this fork. When absent, the module resolves the global default once.
 * @property {{gateSelf?: boolean, humanRequired?: boolean, nonConvergence?: boolean}} [signals] - the judge's
 *   hard-escalate signals for this fork.
 * @property {string[]} [mandatoryLenses] - override the mandatory-lens set (defaults to correctness+security).
 */

/**
 * @typedef {Object} MicroDecisionForkDTO
 * @property {number} n - the fork number.
 * @property {string} question - the fork's question (or `Fork N` when the input carried none).
 * @property {boolean} contested - true when the fork's disposition is `escalate` (it needs a human).
 * @property {'auto-dispose'|'escalate'} disposition - the judge's combined disposition for this fork.
 * @property {string} reason - the judge's machine reason token (e.g. `dissent-present`, `red-refuted`, `gate-self`).
 * @property {string[]} trail - the judge's human-readable disposition trail (WHY this fork landed where it did).
 * @property {string} [recommendedDefault] - carried through when the fork input had one.
 */

/**
 * Classify ONE fork's contention by running the #2652 combined disposition judge over its ledger + config.
 * PURE. CONSUMES the judge — it does not re-derive contention. A fork with no explicit `config` uses the
 * resolved global default. Never throws: a malformed ledger is handled fail-closed by the judge (→ escalate →
 * contested), so a doubtful fork always surfaces to the human rather than silently auto-clearing.
 * @param {ForkInput} fork
 * @param {{lensWeights: object, dissentThreshold: number, resolutionMode: string}} [defaultConfig] - a pre-resolved
 *   default so a batch does not re-resolve the config per fork (an internal optimisation; callers may omit it).
 * @returns {MicroDecisionForkDTO}
 */
export function classifyForkContention(fork, defaultConfig) {
  const n = Number.isInteger(fork?.n) ? fork.n : 0;
  const question = fork?.question && String(fork.question).trim() ? String(fork.question).trim() : `Fork ${n}`;
  // A per-fork config must be a real object for the judge (a truthy non-object would make `disposeVerdict` throw,
  // breaking the never-throws contract). Fall back to the shared default / a freshly-resolved one otherwise.
  const forkConfig = fork?.config && typeof fork.config === 'object' ? fork.config : undefined;
  const config = forkConfig ?? defaultConfig ?? resolveDispositionConfig();
  const verdict = disposeVerdict({
    ledger: Array.isArray(fork?.ledger) ? fork.ledger : [],
    config,
    signals: fork?.signals ?? {},
    mandatoryLenses: Array.isArray(fork?.mandatoryLenses) && fork.mandatoryLenses.length ? fork.mandatoryLenses : MANDATORY_LENSES,
  });
  const contested = verdict.disposition === DISPOSITIONS.ESCALATE;
  return {
    n,
    question,
    contested,
    disposition: verdict.disposition,
    reason: verdict.reason,
    trail: Array.isArray(verdict.trail) ? [...verdict.trail] : [],
    ...(fork?.recommendedDefault && String(fork.recommendedDefault).trim()
      ? { recommendedDefault: String(fork.recommendedDefault).trim() }
      : {}),
  };
}

/**
 * @typedef {Object} MicroDecisionSurfaceDTO
 * @property {string} repo - the repo slug the decision was read from (the configurable seam; mirrors #2580).
 * @property {string} decisionId - the decision item's filename stem (route key).
 * @property {string} [decisionNum] - the leading `NNN`/`xNNNNNN` token, when present.
 * @property {string} decisionTitle - the decision's title.
 * @property {MicroDecisionForkDTO[]} contested - the ordered micro-decision QUEUE: the contested forks the human
 *   walks one at a time. Ordered by fork `n` ascending (file order) so the surface is stable across re-reads.
 * @property {MicroDecisionForkDTO[]} autoCleared - the forks the judge auto-cleared (never surfaced as a choice,
 *   kept so the surface can honestly say "N of M forks auto-cleared").
 * @property {number} forkCount - total forks classified.
 * @property {number} contestedCount - `contested.length` (the number of micro-choices the human faces).
 * @property {number} autoClearedCount - `autoCleared.length`.
 */

/**
 * Build the micro-decision surface DTO for ONE decision from its per-fork jury ledgers (#2650). PURE — the
 * contract seam between the WE surfacing half and the plateau-app console half. Runs the #2652 judge per fork
 * (via {@link classifyForkContention}), partitions the forks into CONTESTED (escalate → the surfaced queue) and
 * AUTO-CLEARED (auto-dispose → never surfaced), and orders the contested queue by fork `n` ascending so the
 * "one micro-choice at a time" walk is stable. The config is resolved ONCE up front and shared by every fork
 * that carries no per-fork override (cheap + deterministic). Never throws: a decision with no forks yields an
 * honest empty queue (`contested: []`), never a surfaced blank.
 * @param {{ repo?: string, id?: string, decisionId?: string, num?: string, decisionNum?: string, title?: string,
 *   decisionTitle?: string, forks?: ForkInput[] }} decision
 * @returns {MicroDecisionSurfaceDTO}
 */
export function buildMicroDecisionQueue(decision) {
  const repo = decision?.repo && String(decision.repo).trim() ? String(decision.repo).trim() : 'webeverything';
  const decisionId = String(decision?.decisionId ?? decision?.id ?? '');
  const decisionNum = decision?.decisionNum ?? decision?.num;
  const decisionTitle = String(decision?.decisionTitle ?? decision?.title ?? '');
  const forks = Array.isArray(decision?.forks) ? decision.forks : [];

  // Resolve the global default config once — every fork without its own override shares it (deterministic + cheap).
  const defaultConfig = resolveDispositionConfig();
  const classified = forks.map((fork) => classifyForkContention(fork, defaultConfig));

  const byN = (a, b) => a.n - b.n;
  const contested = classified.filter((f) => f.contested).sort(byN);
  const autoCleared = classified.filter((f) => !f.contested).sort(byN);

  return {
    repo,
    decisionId,
    ...(decisionNum !== undefined && decisionNum !== null && String(decisionNum) !== '' ? { decisionNum: String(decisionNum) } : {}),
    decisionTitle,
    contested,
    autoCleared,
    forkCount: classified.length,
    contestedCount: contested.length,
    autoClearedCount: autoCleared.length,
  };
}
