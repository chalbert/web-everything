/**
 * @file scripts/conveyor/run-quality-record.mjs
 * @description mechanical-dispatcher (#3383) Bug 2 fix — THE MISSING WIRING. `#3649`'s scorer
 *   (`run-quality-scorer.mjs`), store (`run-scorecard-store.mjs`) and subject-class gate
 *   (`run-quality-subject-class.mjs`) were all built and unit-tested, then proven ONCE against two real Codex
 *   runs by a throwaway scratch script (`we:backlog/3651-*.md`'s own update note) — but NO real dispatch
 *   completion path ever called any of them. `we:scripts/conveyor/run-scorecards.json` stayed empty for every
 *   genuine `fix`/`ci-heal`/`build` Codex dispatch and every real advisory-review judge call, defeating the
 *   entire point of building a probation/recording system: nothing was ever actually recorded.
 *
 * THIS MODULE is the one seam every real call site now goes through, so the scoring/recording logic exists
 * exactly ONCE rather than once per wrapper. It composes, in order:
 *   1. {@link scoreCodexJsonStreamStdout} — score the run's own captured `--json` stdout (see that function's
 *      own docblock for why the in-memory stdout, not a resolved rollout file, is the right input for every
 *      real call site this dispatcher owns: it needs no disk read, and the advisory-review judge seat writes
 *      no rollout file at all, since it always spawns with `--ephemeral`).
 *   2. {@link classifySubject} — Fork 5's subject-class gate, stamped from the CALLER-SUPPLIED `kind` (never
 *      inferred from the transcript).
 *   3. {@link liveStatusFor} — the model's live probation status for this run's `role`, stamped AT SCORING
 *      TIME (never re-queried later), so a model's later promotion never retroactively relabels history.
 *   4. {@link appendScorecard} — the durable, validated write.
 *
 * NEVER THROWS. Recording a run's quality is an observational side effect, not part of what makes a dispatch
 * succeed or fail — the same discipline `codex-delivery-provider.mjs#recordCodexTurnUsage` and
 * `telemetry-store.mjs`'s own best-effort spans already keep. A caller gets the stored row back on success, or
 * `null` on ANY failure (an unreadable stdout shape, a store-write error, a bad `role`) — never an exception
 * that could turn a genuinely successful dispatch into a reported failure over a RECORDING bug.
 *
 * `outcome` is always stamped `null` here, per `#3649` Fork 1's ratified design: the outcome is JOINED later,
 * by whatever aggregator eventually reads `run-scorecards.json`, when the dispatch itself resolves — this
 * module scores and records at the run's own end, before that outcome is knowable (a `fix` dispatch's own
 * `outcome` is decided by the wrapper's post-spawn gate/hand-back logic, which runs AFTER this call).
 *
 * `recordAntigravityRunScorecard` (mechanical-dispatcher Gap 1 fix, epic #3383) is this module's SECOND
 * composition, added once a real live review trial (PR #2177) showed the fifth (Antigravity) judge seat had
 * transcript PERSISTENCE (`antigravity-judge-spawn.mjs#persistAntigravityJudgeTranscript`) and a working SCORER
 * (`run-quality-scorer.mjs#scoreAntigravityJudgeTranscriptFile`, proven in its own unit tests) but NOTHING
 * calling either from `antigravityJudgeSpawn` itself — the identical "built, tested, never wired" gap this
 * file's own header describes for Codex, one seat later. It mirrors `recordCodexRunScorecard` field-for-field
 * (same `classifySubject`, same `liveStatusFor`, same `appendScorecard`, same never-throws discipline) and
 * differs in exactly the one place the two providers' own transcripts differ: Antigravity's scorer reads a
 * PERSISTED FILE PATH, never raw stdout (`antigravity-judge-spawn.mjs`'s own `transcriptFile` is already
 * computed, durably, before this is called — see that function's header for why the Codex seat can score off
 * stdout directly while this one cannot: Codex's advisory seat is proven to write no rollout file at all
 * — `--ephemeral` — while Antigravity's own stream-json answer line is `agy`'s ONLY output surface `#3633`
 * proved reliable enough to score, and it is already durably persisted before this module ever sees it).
 */
import { scoreCodexJsonStreamStdout, scoreAntigravityJudgeTranscriptFile } from './run-quality-scorer.mjs';
import { classifySubject } from './run-quality-subject-class.mjs';
import { appendScorecard } from './run-scorecard-store.mjs';
import { liveStatusFor } from '../lib/model-probation.mjs';

/**
 * Score + record ONE real, completed Codex run. Call this once, right after the run's own spawn call
 * resolves (its stdout is fully captured at that point) — see `fix-dispatch-wrapper.mjs#FIX_CODEX_PROVIDER`,
 * `ci-heal-dispatch-wrapper.mjs#CI_HEAL_CODEX_PROVIDER`, `deliver-item-wrapper.mjs#CODEX_PROVIDER` and
 * `codex-judge-spawn.mjs#codexJudgeSpawn` for the four real call sites this was built for.
 *
 * @param {object} o
 * @param {string} o.stdout - the run's own captured `--json` stdout.
 * @param {string} o.dispatchKind - stamped on the stored row verbatim (e.g. `'fix'`, `'ci-heal'`, `'build'`,
 *   `'advisory-review'`).
 * @param {string} [o.kind] - the vocabulary {@link classifySubject} checks against
 *   (`run-quality-subject-class.mjs#WORK_AGENT_KINDS`); defaults to `dispatchKind` (true for `fix`/`ci-heal`/
 *   `build`, all members of that list) — the advisory-review call site passes `kind: 'review'` explicitly,
 *   since `'advisory-review'` itself is not a member (see that module's own header for why the two
 *   vocabularies are not required to match one-to-one).
 * @param {string} o.role - `model-probation.mjs#PROBATION_ROLES` (`'delivery'` or `'advisory-review'`).
 * @param {string} [o.provider] - defaults to `'codex'` — every real call site this module serves is Codex.
 * @param {string} o.model
 * @param {string|null} [o.effort]
 * @param {string|null} [o.item] - the backlog item, when known.
 * @param {string|null} [o.handle] - the dispatch session slug/handle.
 * @param {object} [io] - injectable seams for tests: `scoreStdout`, `classify`, `statusFor`, `append`.
 * @returns {object|null} the stored scorecard row, or `null` on ANY failure (never throws).
 */
export function recordCodexRunScorecard({
  stdout, dispatchKind, kind = dispatchKind, role, provider = 'codex', model, effort = null, item = null,
  handle = null,
} = {}, {
  scoreStdout = scoreCodexJsonStreamStdout,
  classify = classifySubject,
  statusFor = liveStatusFor,
  append = appendScorecard,
} = {}) {
  try {
    const scored = scoreStdout(stdout);
    const subjectClass = classify({ kind });
    const probationStatus = statusFor({ provider, model, role });
    return append({
      ...scored,
      item,
      handle,
      subjectClass,
      provider,
      model,
      effort,
      dispatchKind,
      probationStatus,
      outcome: null, // joined later, when the dispatch itself resolves — #3649 Fork 1.
    });
  } catch {
    return null; // recording must never turn a real dispatch's own outcome into a failure.
  }
}

/**
 * Score + record ONE real, completed Antigravity advisory-review judge run — the #3383 mechanical-dispatcher
 * Gap 1 fix, mirroring {@link recordCodexRunScorecard} exactly except for WHAT it scores (a persisted
 * transcript FILE PATH, never raw stdout — see this module's own header for why). Call this once, right after
 * `antigravity-judge-spawn.mjs#antigravityJudgeSpawn`'s own `transcriptFile` is computed — the sole real call
 * site this was built for.
 *
 * @param {object} o
 * @param {string|null} o.transcriptFile - `persistAntigravityJudgeTranscript`'s own return value. `null` (a
 *   failed persist) scores as a failed read, same as any other unreadable transcript — this function still
 *   never throws; it returns `null` right along with every other recording failure.
 * @param {string} o.dispatchKind - stamped on the stored row verbatim (`'advisory-review'` for the one real
 *   call site today).
 * @param {string} [o.kind] - the vocabulary {@link classifySubject} checks against; defaults to `dispatchKind`.
 *   The real call site passes `kind: 'review'` explicitly, identical to `recordCodexRunScorecard`'s own.
 * @param {string} o.role - `model-probation.mjs#PROBATION_ROLES` (`'advisory-review'` for the one real call
 *   site today).
 * @param {string} [o.provider] - defaults to `'antigravity'` — every real call site this module serves is.
 * @param {string} o.model
 * @param {string|null} [o.effort]
 * @param {string|null} [o.item] - the backlog item, when known.
 * @param {string|null} [o.handle] - the dispatch session slug/handle.
 * @param {object} [io] - injectable seams for tests: `scoreTranscript`, `classify`, `statusFor`, `append`.
 * @returns {object|null} the stored scorecard row, or `null` on ANY failure (never throws).
 */
export function recordAntigravityRunScorecard({
  transcriptFile, dispatchKind, kind = dispatchKind, role, provider = 'antigravity', model, effort = null,
  item = null, handle = null,
} = {}, {
  scoreTranscript = scoreAntigravityJudgeTranscriptFile,
  classify = classifySubject,
  statusFor = liveStatusFor,
  append = appendScorecard,
} = {}) {
  try {
    const scored = scoreTranscript(transcriptFile);
    const subjectClass = classify({ kind });
    const probationStatus = statusFor({ provider, model, role });
    return append({
      ...scored,
      item,
      handle,
      subjectClass,
      provider,
      model,
      effort,
      dispatchKind,
      probationStatus,
      outcome: null, // joined later, when the dispatch itself resolves — #3649 Fork 1.
    });
  } catch {
    return null; // recording must never turn a real dispatch's own outcome into a failure.
  }
}
