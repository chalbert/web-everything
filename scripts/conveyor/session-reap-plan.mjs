/**
 * @file scripts/conveyor/session-reap-plan.mjs
 * @description THE PURE PLANNER of the conveyor session reaper (WE #3435, epic #3383) — split out of
 *   `session-reaper.mjs` (a MOVE, no logic change). Given `claude agents --json` rows, it decides which BACKGROUND
 *   sessions are done producing more work and which are kept. It has NO fs / exec / clock / network: every signal
 *   (a row's resolved `pidAlive`, the ground-truth resolver, the verdict evidence resolver, `now`) is INJECTED, so it is
 *   unit-tested on fixtures and can graduate on its own. Its siblings own the impure halves:
 *     • `session-reap-evidence.mjs` — the ground-truth resolver (backlog-file reads, `gh pr view`).
 *     • `session-reap-stop.mjs`     — the stop mechanics (`claude stop` retry, the #77683 clear-stuck repair).
 *     • `session-reaper.mjs`        — the thin CLI that wires them together and re-exports every name.
 *
 * MIRRORS `lease-reaper.mjs`'S PURE-CORE / IO-SHELL SPLIT: {@link classifySessionReap},
 *   {@link classifySessionReapWithGroundTruth}, {@link classifySessionReapWithVerdict}, {@link sessionReapPlan} and
 *   {@link sessionTarget} take every row (and, for the ground-truth upgrade, every resolver answer) exactly as shaped
 *   by the caller.
 *
 * THE PID-LIVENESS AXIS (#3383, found live 2026-09-14 — an independent audit of a live registry turned up 26
 * `conveyor-*`/`prepare-*`/`prepare-decision-*` rows, ALL `state: "working"`, `pid: null`, `startedAt` 6-13.5
 * DAYS old). This is a DIFFERENT shape from the `conveyor-3451` gap the ground-truth axis above closed: that
 * gap needed the session's OWN target (its item/PR) to be independently confirmed done, which a genuinely
 * still-open item never is — so a dead session sitting on a still-open item was invisible to BOTH the original
 * state-only axis (state never advances once the harness loses track of the process) AND the ground-truth axis
 * (nothing to confirm). `driver-watchdog.mjs` and `lease-reaper.mjs` had ALREADY built the real fix for this
 * exact failure mode — a two-signal `pid`/`ps aux` liveness probe — for THEIR OWN downstream decisions (is an
 * item in-flight? is a lease still held?), but this reaper, the one file whose actual job is registry hygiene
 * (getting a dead entry off the `claude agents` listing at all), never got the same probe. So the 26 entries
 * were correctly excluded from in-flight/lease bookkeeping by the earlier two fixes, yet sat in the registry
 * itself untouched — `claude stop` was never even attempted on them. {@link classifySessionReap}'s `pid-dead`
 * branch closes that: REUSED, not reimplemented, from `driver-watchdog.mjs`'s own `resolvePidAlive`/
 * `scanPsOutput` (the SAME reuse `lease-reaper.mjs` already established for the identical probe).
 *
 * `pid: null` ITSELF IS NOT THE BUG — it is documented (`clear-stuck-session-io.mjs`'s own header) as the
 * NORMAL shape of every background row this harness lists; nothing here ever registers a real OS pid for a
 * background session, so waiting for one to "arrive" is not a fix. The real gap is that nothing besides a
 * `ps aux` scan for the row's own `sessionId` can ever tell a genuinely-still-running session apart from one
 * whose process died with the harness never noticing — which is exactly what the reused probe does.
 *
 * THE REGISTRY ITSELF IS NOT THIS REPO'S CODE. `claude agents --json` / `claude stop` / `claude rm` are the
 * harness's own CLI surface; nothing in this repository writes a `state: "working"` row or assigns it a `pid`
 * — every file in this codebase that touches that registry (this one included) only ever READS it (`claude
 * agents --json[--all]`) or asks the harness to mutate it (`claude stop`/`rm`, or — as a last-resort, human-
 * gated repair for a KNOWN harness bug, GitHub #77683 — `clear-stuck-session.mjs`'s own directory move). So the
 * durable fix on THIS side of that boundary is exactly the standing rule the #3383 epic's other two fixes
 * already apply: never trust `state` at face value — always cross-check a repo-owned liveness signal (the pid/
 * `ps aux` probe here; a lease's own session-liveness in `lease-reaper.mjs`; the driver's own progress
 * signals in `driver-watchdog.mjs`) before treating a registry row as live.
 *
 * WHY `done`/`failed` STATE ALONE WAS NOT ENOUGH (found live 2026-09-03, `conveyor-3451`). The original cut of
 * this reaper (above) reasoned that a state-only reap axis was safe by construction because no `done`/`failed`
 * FALSE POSITIVE had ever been observed (a session `claude` itself reports finished that was still actually
 * running) — that reasoning still holds and is UNCHANGED below. What it did not address, because nothing had
 * yet evidenced it, is the opposite failure: a session whose real-world work is genuinely finished — its own
 * backlog item `status: resolved`, a real PR merged — while `claude agents` itself never advances that
 * session's `state` past `working`/`blocked` at all. Confirmed live: `conveyor-3451`'s target,
 * `we:backlog/3451-*.md`, carries `status: resolved` with a merged PR (`chalbert/web-everything#1862`, "WE
 * #3451: resolve — active → resolved"), yet the SAME live `claude agents --json --all` listing that landed
 * that PR still reported `conveyor-3451` as `state: "blocked"` — a session the original state-only axis would
 * never touch. A same-night survey of the other 22 non-`done`/`failed` background rows found 17 in the
 * identical shape (target confirmed `status: resolved`, session state stuck at `working`) against 6 genuinely
 * still-open ones (`conveyor-2786`, `conveyor-3447c`, `prepare-3436`, `prepare-3438`, `prepare-3441`, and
 * `review-1871` — an OPEN, unmerged PR) — real, sizable, not a one-off.
 *
 * THE FIX IS AN ADDITIONAL AXIS, NOT A REPLACEMENT. {@link classifySessionReapWithGroundTruth} upgrades a
 * `not-terminal` verdict to `reap:true` ONLY when an injected ground-truth resolver independently confirms the
 * session's OWN target item/PR (derived from its `name` by {@link sessionTarget}, the same
 * `conveyor-<NUM>`/`prepare-<NUM>`/`prepare-decision-<NUM>`/`review-<PR>`/`fix-<PR>`/`ci-heal-<PR>` grammar
 * `we:scripts/conveyor/lease-reaper.mjs`'s `itemNumFromSession` and `we:scripts/operations/dispatch-lane.mjs`'s
 * `sessionSlugFor` already mint) is done — never on a guess, never widening the original `done`/`failed` axis
 * itself. A session whose name matches no known grammar, or whose target cannot be confirmed one way or the
 * other (an unreadable backlog file, a `gh` failure/timeout), is left exactly as before: `not-terminal`, kept.
 * This mirrors the ground-truth-check pattern `we:backlog/3457-*.md` ratified for the DISPATCH side (never
 * guess, always verify against real backlog/GitHub state before acting) — reused here for REAP, its inverse.
 *
 * THE THREE TERMINAL STATES, measured live against a real `claude agents --json --all` listing (192 rows,
 * 2026-09-03) rather than assumed: `done` (134), `stopped` (31), `failed` (1) — `working` (21) is the only
 * non-terminal state this environment's own dispatches produced that day; `blocked` is the fixture's own
 * shape (`__fixtures__/claude-agents-payload.json`), also confirmed live the same night on `conveyor-3451`
 * itself. `stopped` needs NO action (the session is already stopped — re-stopping it is a wasted subprocess
 * call, not a correctness issue, since {@link stopSession} treats an already-gone handle as benign; still
 * worth naming so `keep`'s reason distinguishes it from a live one). `done` and `failed` are the two
 * ({@link TERMINAL_REAP_STATES}) the base axis acts on; `working`/`blocked`/undefined are the ones the new
 * ground-truth axis can now ALSO act on, but only when independently confirmed.
 *
 * `kind !== 'background'` IS AN ABSOLUTE GUARD, CHECKED BEFORE STATE OR GROUND TRUTH. The SAME listing that
 * carries every dispatched agent also carries the operator's own INTERACTIVE terminal sessions (`kind:
 * 'interactive'`, `pid` set, no `state` field at all — measured live, 5 of 192 rows). An interactive row never
 * has a `state` of `done`/`failed` today, and its `name` is never one of this reaper's dispatcher-minted
 * grammars either, but the guard is structural, checked first, and never depends on either of those staying
 * true — the blast radius of `claude stop`-ing a human's own open terminal session is categorically worse than
 * leaving a finished background dispatch listed one tick longer.
 *
 * THE VERDICT AXIS (#3383 tracker item 11, 2026-09-20 — "blocked should be mechanically handled"). Three sessions
 * (`unstick-2072`, `fold-2220`, the old `fix-2347`) read `state: blocked, status: idle, waitingFor: null` with a live pid
 * AND a finished `~/workspace/.operations/jobs/<name>.result.md`: done, sitting at the prompt, never reaped. The
 * pure classifier `session-verdicts.mjs#classifySession` now decides, from injected ground truth, whether a live
 * non-terminal row is `finished-unreaped` (result file / completion record / a new review verdict on its PR, all
 * NEWER than the session's start) or `target-moved-on`, and this reaper reaps on both — through the classifier, not a
 * second rule. It ADDS to every rule above and never widens them: the `kind` guard, the terminal-state and `pid-dead`
 * axes still come first, and `--dry-run` / `--no-ground-truth` / `--no-clear-stuck` behave as before. `--no-verdicts`
 * is the rollback for this axis alone. `stalled` / `waiting-permission` rows are never stopped here (this file only
 * stops sessions whose work is done); they are reported as `attention` so land-advance can redispatch or escalate.
 * THIS REAPER REMAINS THE ONLY STOPPER — nothing hand-runs `claude stop`.
 *
 * THE `no handler` GAP (#3383, 2026-09-20). A `stalled` row is reported `attention` with the action `redispatch-once`,
 * but no code executes that rung. The reaper does not build the executor; it names the gap (`handler: 'none'`, "no
 * handler" in the log) so it is never mistaken for something already being handled ({@link attentionRows},
 * {@link REDISPATCH_ACTIONS}). (The other half of that day's fix — resolving a repo-less `review-<PR>` name across the
 * constellation — lives in `session-reap-evidence.mjs`.)
 */

// #3383 item 11 — the pure verdict classifier: REUSED, never re-derived. `session-verdicts.mjs` imports only the
// (import-free) `land-advance-tools.mjs`.
import { classifySession, DEFAULT_STALL_MINUTES } from './session-verdicts.mjs';

// `normalizeHandle` is a one-line local copy of `../operations/dispatch-lane-io.mjs#normalizeHandle`, kept HERE on purpose:
// importing it would drag that whole IO module (run store, action dispatch, lease reaper, pr-watch) into this pure
// planner's import closure. Keep the two identical.
const normalizeHandle = (x) => String(x ?? '').trim().toLowerCase();

// ── PURE CORE (no fs / exec / clock — every signal is injected) ────────────────────────────────────────────

/** States `claude agents` reports for a session's OWN process that mean "stop it — it is done producing more
 *  work" (see the file header for the live count that grounds this pair). */
export const TERMINAL_REAP_STATES = new Set(['done', 'failed']);

/** States that mean the session is already stopped — nothing to do, kept apart from `not-terminal` so a
 *  caller can tell "already handled" from "still live, leave it alone". */
export const ALREADY_STOPPED_STATES = new Set(['stopped']);

/**
 * The DETERMINISTIC reap verdict for ONE `claude agents --json` row — pure, same row → same verdict. This is
 * the STATE-ONLY + PID-LIVENESS axis; see {@link classifySessionReapWithGroundTruth} for the axis that can
 * ALSO reap a `not-terminal` row once its target is independently confirmed done.
 *
 * @param {object|null} session - one element of a `claude agents --json` listing, optionally carrying a
 *   `pidAlive` fact the IO shell already resolved (see the `pid-dead` branch below).
 * @returns {{reap:boolean, reason:('done'|'failed'|'already-stopped'|'not-background'|'pid-dead'|'not-terminal')}}
 */
export function classifySessionReap(session) {
  if (!session || typeof session !== 'object') return { reap: false, reason: 'not-terminal' };
  // Structural guard FIRST — see the file header on why this can never be state-dependent.
  if (session.kind !== 'background') return { reap: false, reason: 'not-background' };
  const state = session.state;
  if (TERMINAL_REAP_STATES.has(state)) return { reap: true, reason: state };
  if (ALREADY_STOPPED_STATES.has(state)) return { reap: false, reason: 'already-stopped' };
  // #3383 (found live 2026-09-14 — the "26 entries, `pid: null`, 6-13.5 DAYS old, `state: working`" audit) — THE
  // PID-LIVENESS AXIS. `working`/`blocked` is NOT evidence of life: a background row under today's harness never
  // carries a `pid` at all (measured — see `clear-stuck-session-io.mjs`'s own header), so `state` simply never
  // advances once the harness has lost track of the real process, and nothing before this axis ever noticed —
  // the OTHER axis here (ground truth, below) only fires once the item/PR a session names is INDEPENDENTLY
  // confirmed done elsewhere, which a genuinely still-open item never is, so a dead session working a real,
  // still-open item sat listed forever. `session.pidAlive` is a REAL, DIRECT liveness read the IO shell resolves
  // before calling this — the SAME two-signal probe `driver-watchdog.mjs#resolvePidAlive`/`scanPsOutput`
  // established and `lease-reaper.mjs` already reuses for its own in-flight axis, reused a THIRD time here,
  // never reimplemented: a row's own `pid` when present (rare for this listing shape), else a `ps aux` scan for
  // its full `sessionId`. Only an explicit `false` fires — `true` (genuinely alive) and `undefined`/`null`
  // (unknown: no `sessionId` to scan, or the scan itself failed) both leave this exactly as before, so a
  // session merely not yet probed, or freshly spawned, is never mistaken for a dead one.
  if (session.pidAlive === false) return { reap: true, reason: 'pid-dead' };
  return { reap: false, reason: 'not-terminal' }; // working / blocked / undefined — never touched by THIS axis
}

/**
 * The dispatcher-minted TARGET a session's own `name` encodes, or `null` when it matches no known grammar —
 * never a guess. Mirrors `we:scripts/conveyor/lease-reaper.mjs`'s `itemNumFromSession` for the item-kind names
 * (`conveyor-<NUM>` / `prepare-<NUM>` / `prepare-decision-<NUM>`, an optional trailing retry-attempt letter
 * collapsed to the base number, same as `conveyor-3441b` → item `3441`), and `we:scripts/operations/
 * dispatch-lane.mjs`'s `sessionSlugFor` for the PR-kind names (`fix-<PR>` / `ci-heal-<PR>` are minted from the
 * PR number, not the item number — `sessionSlugFor(num, 'fix', pr)` → `` `fix-${pr}` ``); `review-<PR>` (the
 * independent-review dispatch, a separate mechanism from `dispatch-lane.mjs`) follows the identical PR-number
 * grammar. `fix`/`ci-heal` deliberately are NOT folded into `lease-reaper.mjs`'s item-kind bucket here even
 * though that module's own `itemNumFromSession` does — this function answers "what does the NUMBER in this
 * name identify", and for `fix`/`ci-heal` the number is a PR, not an item; conflating the two would ask the
 * wrong ground-truth question (a PR number happening to also be a valid item number, or vice versa).
 * A PR-kind name minted BEFORE repo markers existed (`review-148`) names a PR NUMBER only — it carries no `repo`,
 * and that absence is meaningful, not a default: the resolver ({@link makeGroundTruthResolver}) must not guess
 * `we`. A target that DOES carry `repo` (a constellation repo key) is checked in that repo alone.
 * @param {string|null|undefined} name
 * @returns {{kind:'item', id:string}|{kind:'pr', id:string, repo?:string}|null}
 */
export function sessionTarget(name) {
  const s = String(name ?? '');
  let m = s.match(/^(?:conveyor|prepare-decision|prepare)-(\d+)[a-z]?$/i);
  if (m) return { kind: 'item', id: m[1] };
  m = s.match(/^(?:review|fix|ci-heal)-(\d+)[a-z]?$/i);
  if (m) return { kind: 'pr', id: m[1] };
  return null;
}

/**
 * {@link classifySessionReap}'s verdict, UPGRADED to `reap:true` when the base verdict is `not-terminal` AND
 * the injected `groundTruthFor` resolver independently confirms the session's own target is done. Never
 * downgrades a verdict, never touches `not-background`/`already-stopped`/already-terminal rows, and never
 * fires without BOTH a derivable target ({@link sessionTarget}) and a resolver answer of `resolved: true` —
 * an unresolvable name, a `null` answer (unknown), or `resolved: false` all fall through to the base verdict
 * unchanged. Omitting `groundTruthFor` (or passing a non-function) makes this byte-identical to
 * {@link classifySessionReap} — the new axis is strictly additive.
 *
 * The resolver is called `(target, session)`: the row rides along so a repo-less PR name can be resolved from the
 * session's own follow-up ledger entry (see {@link makeGroundTruthResolver}). A one-argument resolver ignores it.
 *
 * @param {object|null} session
 * @param {((target:{kind:'item'|'pr', id:string, repo?:string}, session?:object) => ({resolved:boolean, evidence?:string}|null))|null} [groundTruthFor]
 * @returns {{reap:boolean, reason:string}}
 */
export function classifySessionReapWithGroundTruth(session, groundTruthFor) {
  const base = classifySessionReap(session);
  if (base.reap || base.reason !== 'not-terminal' || typeof groundTruthFor !== 'function') return base;
  const target = sessionTarget(session?.name);
  if (!target) return base; // no derivable target — never guess
  const truth = groundTruthFor(target, session);
  if (truth && truth.resolved === true) {
    return { reap: true, reason: `ground-truth-${target.kind}:${truth.evidence || target.id}` };
  }
  return base; // unresolved / unknown / not yet done — leave it exactly as the state-only axis would
}

/**
 * {@link classifySessionReap}'s verdict, extended by the {@link classifySession} VERDICT AXIS (see the file header):
 * a live, non-terminal row is reaped when the classifier says `finished-unreaped` or `target-moved-on` — the latter
 * from the SAME injected `groundTruthFor` resolver, so the ground-truth answer is asked once, not re-derived. The
 * result carries `verdict`/`action`/`why` so a caller can report the rows it kept (`stalled`, `waiting-permission`).
 * Every existing reason string is preserved (`ground-truth-<kind>:<evidence>` for a moved-on target).
 *
 * Without `evidenceFor` this is byte-identical to {@link classifySessionReapWithGroundTruth}.
 *
 * @param {object|null} session - carrying `pidAlive`, as resolved by the IO shell.
 * @param {{groundTruthFor?:Function|null, evidenceFor?:((session:object)=>object)|null, now?:number, stallMinutes?:number, graceMinutes?:number}} [opts]
 * @returns {{reap:boolean, reason:string, verdict?:string, action?:string, why?:string}}
 */
export function classifySessionReapWithVerdict(session, { groundTruthFor = null, evidenceFor = null, now, stallMinutes = DEFAULT_STALL_MINUTES, graceMinutes = stallMinutes } = {}) {
  if (typeof evidenceFor !== 'function') return classifySessionReapWithGroundTruth(session, groundTruthFor);
  const base = classifySessionReap(session);
  if (base.reap || base.reason !== 'not-terminal') return base;
  const target = typeof groundTruthFor === 'function' ? sessionTarget(session?.name) : null;
  const truth = target ? groundTruthFor(target, session) : null;
  let gathered;
  try { gathered = evidenceFor(session) ?? {}; } catch { gathered = {}; } // unreadable evidence = unknown, never a reap
  const result = classifySession(session, { ...gathered, pidAlive: session.pidAlive, targetMovedOn: truth }, { now, stallMinutes, graceMinutes });
  const fields = { verdict: result.verdict, action: result.action, why: result.why };
  if (result.action !== 'reap') return { ...base, ...fields };
  const reason = result.verdict === 'target-moved-on'
    ? `ground-truth-${target.kind}:${truth.evidence || target.id}`
    : `${result.verdict}:${result.why}`;
  return { reap: true, reason, ...fields };
}

/**
 * Map {@link classifySessionReapWithVerdict} over a full `claude agents --json` listing. Passing no `groundTruthFor`
 * and no `evidenceFor` (the default) makes this byte-identical to mapping {@link classifySessionReap} alone —
 * every existing caller/test is unaffected.
 * @param {unknown[]} sessions
 * @param {{groundTruthFor?: Function|null, evidenceFor?: Function|null, now?: number, stallMinutes?: number, graceMinutes?: number}} [opts]
 * @returns {{reap:Array, keep:Array}} each entry carries the original row plus its `reason` (and, when the verdict
 *   axis ran, `verdict`/`action`/`why`).
 */
export function sessionReapPlan(sessions, { groundTruthFor = null, evidenceFor = null, now, stallMinutes, graceMinutes } = {}) {
  const reap = [];
  const keep = [];
  for (const session of Array.isArray(sessions) ? sessions : []) {
    const { reap: doReap, reason, verdict, action, why } = classifySessionReapWithVerdict(session, { groundTruthFor, evidenceFor, now, stallMinutes, graceMinutes });
    const row = { session, reason, ...(verdict ? { verdict, action, why } : {}) };
    (doReap ? reap : keep).push(row);
  }
  return { reap, keep };
}

/**
 * The live rows the verdict axis found stuck but does NOT stop (`stalled` / `waiting-permission`), each naming
 * whether anything executes its `action` (`handler`: `'none'` for {@link REDISPATCH_ACTIONS}, else `'land-advance'`).
 * @param {Array<{session:object, verdict?:string, action?:string, why?:string}>} keep - {@link sessionReapPlan}'s `keep`.
 */
export function attentionRows(keep) {
  return keep.filter((r) => r.verdict === 'stalled' || r.verdict === 'waiting-permission')
    .map((r) => ({ id: normalizeHandle(r.session.id) || null, name: r.session.name ?? null, verdict: r.verdict, action: r.action, why: r.why, handler: hasHandler(r.action) ? 'land-advance' : 'none' }));
}

/** Verdict actions no code executes yet. The reaper only REPORTS these (`attention`); land-advance turns `escalate`
 *  into an escalation packet, but nothing re-dispatches a stalled session — the first rung is a known gap (#3383). */
export const REDISPATCH_ACTIONS = new Set(['redispatch-once', 'stop-and-redispatch-once']);

/** Does any code execute this verdict `action`? `false` only for {@link REDISPATCH_ACTIONS} — reported as `no handler`. */
export function hasHandler(action) {
  return !REDISPATCH_ACTIONS.has(action);
}
