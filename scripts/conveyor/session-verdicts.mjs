/**
 * @file scripts/conveyor/session-verdicts.mjs
 * @description THE MECHANICAL SESSION VERDICT (epic #3383, tracker item 11, first slice). A `claude agents --json`
 *   row whose registry `state` says `blocked` is NOT evidence that anything is blocking it: live 2026-09-20,
 *   `unstick-2072`, `fold-2220` and the old `fix-2347` all read `state: blocked, status: idle, waitingFor: null`
 *   with a live pid AND a finished `<name>.result.md`. The work was done; the session sat at its prompt. The reaper
 *   stopped only `done`/`failed` rows (or ones whose target was merged/resolved), so none was ever reaped, and
 *   `/wip` printed them as work in progress. "Blocked should be mechanically handled" (operator, 2026-09-20).
 *
 * PURE: no fs, no clock, no env, no process. Every fact is injected — the row, the evidence about it, `now`, and the
 * stall threshold — so the same inputs give byte-identical output. The IO shell that gathers the evidence lives in
 * {@link ./session-reaper.mjs} (reap side) and `we:scripts/operations/wip-agents-io.mjs` (display side).
 *
 * THE CLOSED VERDICT ENUM ({@link VERDICTS}) AND THE L0 ACTION MAP ({@link classifySession}). L0 is the rung with NO
 * model in it — a table lookup over ground truth:
 *
 *   progressing          live pid, transcript fresh (or state not idle)            → none
 *   finished-unreaped    live pid, registry `done` OR (blocked/idle, no waitingFor,
 *                        and a result file / completion record / new PR verdict
 *                        newer than the session's start)                           → reap
 *   waiting-permission   `status: waiting` + `waitingFor` names a permission prompt → stop-and-redispatch-once, then escalate
 *   stalled              live pid, quiet longer than `stallMinutes`, no result,
 *                        not waiting                                               → redispatch-once, then escalate
 *   dead-record          no live process                                           → clear-record
 *   target-moved-on      the session's OWN target (PR merged / item resolved) is
 *                        done, per the reaper's injected ground-truth resolver     → reap
 *
 * `escalate` means: write an escalation packet (`we:scripts/operations/land-advance-escalations.mjs`, built by
 * {@link escalationRow}). It NEVER goes to the operator queue — that queue lists only `review:human` PRs, and a
 * blocked worker is agent work. No verdict here maps to an operator action; a test pins that.
 *
 * `redispatch-once` / `stop-and-redispatch-once` are the FIRST rung only: the attempt count comes from the follow-up
 * ledger entry (injected as `evidence.redispatchAttempts`), and one prior attempt turns the action into `escalate`.
 * A session with no dispatch grammar in its name (a hand-launched `proto-note`) cannot be re-dispatched by name, so it
 * escalates straight away. Executing a redispatch is NOT this module's job (see the result file: owed).
 *
 * NEVER GUESS. Unknown liveness (`pidAlive` neither true nor false) is `progressing`/`none`: only an explicit `false`
 * is a dead record (the one exception: a confirmed-moved-on target, which the reaper has always reaped on without
 * any liveness read). An unknown idle duration (no transcript mtime) is never `stalled`. A result file only counts when
 * it is NEWER than the session's own `startedAt`, so an older session's file of the same name (the old and new
 * `fix-2347`) is not mistaken for the new session's result.
 */

import { allowedToolsArg } from '../operations/land-advance-tools.mjs';

/** The closed verdict set. Adding one is a deliberate edit here, never an emergent string elsewhere. */
export const VERDICTS = Object.freeze([
  'progressing', 'finished-unreaped', 'waiting-permission', 'stalled', 'dead-record', 'target-moved-on',
]);

/** The closed action set. `escalate` writes a packet; nothing here is an operator-queue action. */
export const ACTIONS = Object.freeze([
  'none', 'reap', 'clear-record', 'redispatch-once', 'stop-and-redispatch-once', 'escalate',
]);

/** Quiet longer than this (minutes, on the transcript's mtime) with no result is `stalled`. */
export const DEFAULT_STALL_MINUTES = 30;

/**
 * The dispatch grammar a session's `name` carries. Mirrors `session-reaper.mjs#sessionTarget` and
 * `wip-agents.mjs`'s copy (pinned together by `session-verdicts.test.mjs`); kept local so this pure module does not
 * import the reaper (which imports IO) and the reaper can import this module without a cycle.
 * @param {string|null|undefined} name
 * @returns {{kind:'review'|'fix'|'ci-heal'|'conveyor'|'prepare', target:'pr'|'item', id:string}|null}
 */
export function dispatchGrammar(name) {
  const s = String(name ?? '');
  let m = s.match(/^(conveyor|prepare-decision|prepare)-(\d+)[a-z]?$/i);
  if (m) return { kind: m[1].toLowerCase() === 'conveyor' ? 'conveyor' : 'prepare', target: 'item', id: m[2] };
  m = s.match(/^(review|fix|ci-heal)-(\d+)[a-z]?$/i);
  if (m) return { kind: m[1].toLowerCase(), target: 'pr', id: m[2] };
  return null;
}

/** `land-advance-tools.mjs`'s permission-grant kind for a dispatch kind (`review` | `fix` | `build`). */
const TOOL_KIND = Object.freeze({ review: 'review', fix: 'fix', 'ci-heal': 'fix', conveyor: 'build', prepare: 'build' });

/**
 * The FIFTH state, same rule as `reconcile-core.mjs#isAwaitingPermission` (pinned by a test): `status: waiting` with
 * `waitingFor` naming a permission prompt. The process exists and will never advance — a background agent has
 * nobody to ask.
 * @param {{status?:string, waitingFor?:string|null}|null|undefined} agent
 */
export function isPermissionWait(agent) {
  return String(agent?.status ?? '').toLowerCase() === 'waiting' && /permission/i.test(String(agent?.waitingFor ?? ''));
}

const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const ms = (v) => (finite(v) ? v : typeof v === 'string' && Number.isFinite(Date.parse(v)) ? Date.parse(v) : null);
const rawState = (a) => String(a?.state ?? a?.status ?? '').toLowerCase();

/**
 * Does injected evidence show the session's own work is finished? Returns the first proof, or `null`.
 * Every proof must be NEWER than the session's own start (`startedAt`); with no known start nothing counts.
 * @returns {string|null} a short evidence label for `why`.
 */
function finishedEvidence(agent, evidence) {
  const started = ms(agent?.startedAt);
  if (started == null) return null;
  for (const f of evidence?.resultFiles ?? []) {
    if (finite(f?.mtimeMs) && f.mtimeMs >= started) return `result file ${f.path ?? 'present'}`;
  }
  const c = evidence?.completion;
  if (c && c.status === 'done' && (ms(c.updatedAt) ?? ms(c.startedAt)) >= started) return 'completion record done';
  // A review/fix session's ground truth is its PR: a new `review:*` label or verdict comment after it started.
  const grammar = dispatchGrammar(agent?.name);
  if (grammar && (grammar.kind === 'review' || grammar.kind === 'fix') && finite(evidence?.prSignal?.reviewSignalAtMs)
    && evidence.prSignal.reviewSignalAtMs >= started) return `${evidence.prSignal.what ?? 'review:* label/verdict'} on PR after start`;
  return null;
}

/**
 * The L0 escalation-or-redispatch step for a stuck-but-live session. First failure of a re-dispatchable session →
 * the redispatch action; a prior attempt (ledger), or a name the dispatcher cannot re-mint → `escalate`.
 */
function stuckAction(agent, evidence, firstRung) {
  const grammar = dispatchGrammar(agent?.name);
  const attempts = Number.isInteger(evidence?.redispatchAttempts) ? evidence.redispatchAttempts : 0;
  if (!grammar || attempts >= 1) return { action: 'escalate', attempts, grammar };
  return { action: firstRung, attempts, grammar };
}

/**
 * The DETERMINISTIC verdict for ONE session — pure, same inputs → byte-identical output.
 *
 * @param {object} agent - one `claude agents --json` row (`kind`, `name`, `state`, `status`, `waitingFor`, `startedAt`, `pid`).
 * @param {object} [evidence] - facts the shell resolved, all optional (absent = unknown, never assumed):
 *   `pidAlive` (true/false/null), `transcriptMtimeMs`, `resultFiles` (`[{path, mtimeMs}]`: the
 *   `<name>.result.md` convention plus the ledger's `expectedResultPath`), `completion` (`{status, startedAt,
 *   updatedAt}`), `prSignal` (`{reviewSignalAtMs, what}`: newest `review:*` label / verdict comment on the PR),
 *   `targetMovedOn` (`{resolved, evidence}`: the reaper's ground-truth resolver answer), `redispatchAttempts`
 *   (from the follow-up ledger entry).
 * @param {{now:number, stallMinutes?:number}} opts
 * @returns {{verdict:string, action:string, why:string, allowedTools?:string}} `allowedTools` (a `--allowedTools=…`
 *   argv atom, scoped to the dispatch kind) is present only on `stop-and-redispatch-once`.
 */
export function classifySession(agent, evidence = {}, { now, stallMinutes = DEFAULT_STALL_MINUTES } = {}) {
  const name = agent?.name ?? 'unnamed';
  if (!agent || typeof agent !== 'object' || agent.kind !== 'background') {
    return { verdict: 'progressing', action: 'none', why: `${name}: not a background session — never acted on` };
  }
  const state = rawState(agent);
  if (evidence?.pidAlive === false) {
    return { verdict: 'dead-record', action: 'clear-record', why: `${name}: no live process (registry says ${state || 'no state'})` };
  }
  // Ground truth needs no liveness read: the reaper has always reaped on an independently-confirmed target alone.
  if (evidence?.targetMovedOn?.resolved === true) {
    return { verdict: 'target-moved-on', action: 'reap', why: `${name}: target done (${evidence.targetMovedOn.evidence ?? 'resolved'})` };
  }
  if (evidence?.pidAlive !== true) {
    return { verdict: 'progressing', action: 'none', why: `${name}: liveness unknown — never acted on` };
  }
  if (state === 'done') {
    return { verdict: 'finished-unreaped', action: 'reap', why: `${name}: registry says done, process still alive` };
  }
  if (isPermissionWait(agent)) {
    const step = stuckAction(agent, evidence, 'stop-and-redispatch-once');
    const out = { verdict: 'waiting-permission', action: step.action,
      why: `${name}: blocked on "${agent.waitingFor}" — a background agent has nobody to answer${step.action === 'escalate' ? (step.grammar ? ` (redispatch attempts: ${step.attempts})` : ' (no dispatch grammar to re-mint)') : ''}` };
    if (step.action === 'stop-and-redispatch-once') out.allowedTools = allowedToolsArg(TOOL_KIND[step.grammar.kind]);
    return out;
  }
  if (agent.waitingFor) {
    // Waiting on something that is not a permission prompt: not ours to classify, never guess.
    return { verdict: 'progressing', action: 'none', why: `${name}: waiting on "${agent.waitingFor}" (not a permission prompt)` };
  }
  const quiet = String(agent.status ?? '').toLowerCase() === 'idle' || state === 'blocked' || state === 'idle';
  if (quiet) {
    const proof = finishedEvidence(agent, evidence);
    if (proof) return { verdict: 'finished-unreaped', action: 'reap', why: `${name}: ${state || 'idle'} at its prompt, ${proof}` };
    const idleMs = finite(evidence?.transcriptMtimeMs) && finite(now) ? Math.max(0, now - evidence.transcriptMtimeMs) : null;
    if (idleMs != null && idleMs >= stallMinutes * 60000) {
      const step = stuckAction(agent, evidence, 'redispatch-once');
      return { verdict: 'stalled', action: step.action,
        why: `${name}: idle ${Math.floor(idleMs / 60000)} min (threshold ${stallMinutes}), no result${step.action === 'escalate' ? (step.grammar ? `, redispatch attempts: ${step.attempts}` : ', no dispatch grammar to re-mint') : ''}` };
    }
  }
  return { verdict: 'progressing', action: 'none', why: `${name}: live, ${quiet ? 'quiet but within threshold or idle time unknown' : 'working'}` };
}

/**
 * The ROW shape `land-advance-escalations.mjs#buildEscalationPacket` consumes, for a verdict whose action is
 * `escalate`. Pure. The packet goes to the escalation store (agent triage, `L2 ai-triage`) — never to the operator
 * queue. Returns `null` for any other action, so a caller cannot escalate what the ladder did not.
 * @param {object} agent
 * @param {{verdict:string, action:string, why:string}} result
 * @returns {{kind:string, subject:string, packetId:string, evidence:string[], verdict:string, pr:number|null}|null}
 */
export function escalationRow(agent, result) {
  if (result?.action !== 'escalate') return null;
  const g = dispatchGrammar(agent?.name);
  const subject = `session:${agent?.name ?? agent?.id ?? 'unknown'}`;
  const kind = `session-${result.verdict}`;
  return {
    kind,
    subject,
    packetId: `${kind}-${subject}`.replace(/[^a-zA-Z0-9_-]/g, '-'),
    evidence: [result.why, `registry: state=${agent?.state ?? 'none'} status=${agent?.status ?? 'none'} id=${agent?.id ?? 'none'}`],
    verdict: 'session ladder exhausted at L0 (no model)',
    pr: g?.target === 'pr' ? Number(g.id) : null,
  };
}
