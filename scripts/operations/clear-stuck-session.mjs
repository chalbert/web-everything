/**
 * @file scripts/operations/clear-stuck-session.mjs
 * @description THE `clear-stuck-session` DECLARATION (#3383) — mechanizes the by-hand workaround for a known
 *   Claude Code harness bug (GitHub #77683): some dispatched background sessions go on being listed by
 *   `claude agents --json --all` (and refuse `claude stop <id>` / `claude rm <id>`, which fail or silently
 *   no-op) long after their OS process has died. The confirmed workaround is moving the session's own job
 *   directory aside at `<config-dir>/jobs/<id>/` — today a human has to find and do that by hand every time.
 *
 * FOUR STEPS, `compute` → `compute` → `confirm` → `effect`. No `judge` — nothing here needs a model's
 * judgement, only a liveness fact and a human's authorization to touch state outside this repo's own tree.
 *
 *   | step        | kind      | does                                                                        |
 *   |-------------|-----------|------------------------------------------------------------------------------|
 *   | `read`      | `compute` | shapes ONE injected `readStuckFacts({session, pr})` call into a `read` finding |
 *   | `assess`    | `compute` | THE VERDICT: does this session actually match the confirmed-stuck shape?   |
 *   | `authorize` | `confirm` | a human decides whether to proceed — the move touches `~/.claude`, not this repo |
 *   | `move`      | `effect`  | declares the quarantine-move effect; a no-op unless BOTH the verdict AND the human said yes |
 *
 * DO NOT BLINDLY CLEAR ANYTHING THAT IS NOT CONFIRMED STUCK. `assessStuck` requires ALL of:
 *   1. the job directory actually exists on disk;
 *   2. the session IS listed by `claude agents --json --all` (this operation clears a listed-but-dead
 *      session, not an already-vanished one — see the io shell for what "not listed" means instead);
 *   3. its last self-reported state is `"blocked"` — the shape every known stuck session carries;
 *   4. {@link ../conveyor/reconcile-core.mjs#assessLiveness}, called with THIS session's own listing row,
 *      reports **nothing live** — the SAME liveness rule `reconcile-core.mjs`'s reconcile pass already uses,
 *      reused rather than re-derived so the two can never disagree about what "alive" means. The io shell
 *      resolves `pidAlive` for that row itself (see `clear-stuck-session-io.mjs`'s `resolvePidAlive`) — a
 *      wider `ps aux` scan for the session's own id, because the known-stuck listing rows carry no `pid`
 *      field at all (measured: every one of the 13 `state:"blocked"` rows on 2026-09-13 had none), so there
 *      is no pid for the ordinary `kill(pid, 0)` probe to check in the first place;
 *   5. no run record in THIS repo's own operation-engine store (`we:scripts/operations/run-store.mjs`) still
 *      carries an `in-flight` effect handle bound to this session — clearing a session something else is
 *      still waiting to observe would strand that run rather than free anything.
 *
 * Any one of those failing means `confirmedStuck: false`, and the `move` step then declares ZERO effects
 * regardless of what the human answers at `authorize` — the human's "proceed" only ever *permits* a move the
 * verdict has already found genuine; it can never manufacture one the verdict refused.
 *
 * WHY A REAL `confirm` STEP, NOT JUST A REVIEWED VERDICT. This moves a directory outside the repo's own git
 * tree — Claude Code's own state directory, not this repo's content — and although the move is recoverable
 * (quarantined, never deleted), it is still irreversible-ish in effect: the daemon is expected to drop the
 * session from its listings once its job directory is gone. That is exactly the shape `docs/agent`'s
 * judgment-vs-hook split reserves for a person, not a script, however confident the verdict already is.
 *
 * IO IS INJECTED, AND THIS FILE REACHES NOTHING. `./clear-stuck-session-io.mjs` is the only place this reaches
 * `fs`, `claude agents`, `ps`, or the run-store.
 *
 * PURE. No fs, no clock, no process, no network in this file.
 */

import { op } from './registry.mjs';
import { compute, confirm as confirmStep, effect as effectStep } from './step-kinds.mjs';
import { assessLiveness } from '../conveyor/reconcile-core.mjs';

/** The operation's stable id. Adapters resolve it by this name. */
export const CLEAR_STUCK_SESSION_OP = 'clear-stuck-session';

/** The effect type the `move` step declares — the sink is registered under this string in the io shell. */
export const QUARANTINE_MOVE_EFFECT = 'claude-jobs.quarantine-move';

/** The last-self-reported job state every known stuck session carries. Anything else is not this shape. */
export const STUCK_JOB_STATE = 'blocked';

/**
 * SHAPE one `readStuckFacts()` result into the `read` finding. PURE — separated from the injected reader so
 * every branch of {@link assessStuck} is testable without `fs`/`claude`/`ps`.
 *
 * @param {object} raw - what the io shell's `readStuckFacts({session, pr})` returns.
 * @returns {object} the `read` finding — every field defensively coalesced, never `undefined`.
 */
export function shapeStuckRead(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const listingEntry = r.listingEntry && typeof r.listingEntry === 'object' ? r.listingEntry : null;
  const stateJson = r.stateJson && typeof r.stateJson === 'object' ? r.stateJson : null;
  return {
    resolvedVia: r.resolvedVia === 'pr' ? 'pr' : (r.resolvedVia === 'session' ? 'session' : 'none'),
    requestedSession: r.requestedSession ? String(r.requestedSession) : null,
    requestedPr: Number.isInteger(r.requestedPr) && r.requestedPr > 0 ? r.requestedPr : null,
    shortId: r.shortId ? String(r.shortId) : null,
    fullSessionId: r.fullSessionId ? String(r.fullSessionId) : null,
    jobDirPath: r.jobDirPath ? String(r.jobDirPath) : null,
    jobDirExists: r.jobDirExists === true,
    stateJson: stateJson ? { state: stateJson.state ?? null, detail: stateJson.detail ?? null, needs: stateJson.needs ?? null } : null,
    listingEntry,
    // `pidAlive` is resolved by the io shell over a WIDER signal than the listing's own (often-absent) `pid`
    // field — see the file header. `null` means "could not be established", never "confirmed dead".
    pidAlive: listingEntry ? (r.pidAlive === true ? true : (r.pidAlive === false ? false : null)) : null,
    runStoreBound: r.runStoreBound === true,
    boundRuns: Array.isArray(r.boundRuns) ? r.boundRuns.map((b) => ({ runId: String(b?.runId ?? ''), key: String(b?.key ?? '') })) : [],
  };
}

/**
 * THE VERDICT. Every refusal is named, so an operator (or the `authorize` question) can say exactly why this
 * session was not touched. PURE.
 *
 * @param {object} read - the `read` finding from {@link shapeStuckRead}.
 * @returns {{confirmedStuck: boolean, reason: string, shortId: (string|null), jobDirPath: (string|null),
 *   fullSessionId: (string|null), liveness: (object|null)}}
 */
export function assessStuck(read) {
  const r = read || {};
  const base = { shortId: r.shortId ?? null, jobDirPath: r.jobDirPath ?? null, fullSessionId: r.fullSessionId ?? null };

  if (!r.shortId) {
    return { ...base, confirmedStuck: false, liveness: null, reason: 'no session could be resolved from the given input — pass --session=<id> or --pr=<number> naming a session actually bound to that PR' };
  }
  if (!r.jobDirExists) {
    return { ...base, confirmedStuck: false, liveness: null, reason: `no job directory exists for ${r.shortId} — nothing to clear` };
  }
  if (!r.listingEntry) {
    return { ...base, confirmedStuck: false, liveness: null, reason: `${r.shortId} is not currently listed by \`claude agents --json --all\` — this operation clears a listed-but-dead session, not one already absent from the listing` };
  }

  // THE SAME LIVENESS RULE `reconcile-core.mjs`'s reconcile pass uses, reused rather than re-derived. It reads
  // a `bound` array of `{agent, cwd, sha}`; this session IS the one thing bound, by construction.
  const bound = [{ agent: { ...r.listingEntry, pidAlive: r.pidAlive }, cwd: String(r.listingEntry.cwd ?? ''), sha: '' }];
  const liveness = assessLiveness(bound);
  if (liveness) {
    return { ...base, confirmedStuck: false, liveness, reason: `assessLiveness says this session is NOT dead (${liveness.kind}): ${liveness.why}` };
  }

  const state = r.stateJson?.state ?? null;
  if (state !== STUCK_JOB_STATE) {
    return { ...base, confirmedStuck: false, liveness: null, reason: `job state is ${JSON.stringify(state)}, not ${JSON.stringify(STUCK_JOB_STATE)} — only a session in that state is cleared here` };
  }
  if (r.runStoreBound) {
    const runs = (r.boundRuns || []).map((b) => `${b.runId}:${b.key}`).join(', ');
    return { ...base, confirmedStuck: false, liveness: null, reason: `an operation run record still holds an in-flight effect on this session (${runs || 'unnamed'}) — clearing now would strand that run; resolve it first (wake.mjs --resolve) or investigate before clearing` };
  }

  return {
    ...base, confirmedStuck: true, liveness: null,
    reason: `confirmed stuck: state is "${STUCK_JOB_STATE}", assessLiveness found nothing live, and no run record references it`,
  };
}

/** The `authorize` step's question. A function, not a string — it must say WHY, one way or the other. */
export function authorizeQuestion(view) {
  const v = view?.verdict || {};
  if (!v.confirmedStuck) {
    return `${v.shortId ?? 'this session'} is NOT confirmed stuck (${v.reason}). Proceeding will still move nothing — `
      + 'answer to close out this run either way.';
  }
  return `${v.shortId} is confirmed stuck (${v.reason}). Move its job directory aside to `
    + '`<config-dir>/jobs/.cleared/<id>-<timestamp>/`? This is recoverable (a move, never a delete).';
}

/**
 * MAY THE MOVE PROCEED? PURE over the verdict and the human's raw answer. The human's "proceed" only ever
 * PERMITS a move the verdict already found genuine — it can never manufacture one the verdict refused.
 * @param {object} verdict - {@link assessStuck}'s output.
 * @param {string} answer - the `authorize` step's recorded finding (the raw resume value).
 */
export function planMove(verdict, answer) {
  const v = verdict || {};
  if (v.confirmedStuck !== true) return { shouldMove: false, reason: v.reason || 'not confirmed stuck' };
  if (answer !== 'proceed') return { shouldMove: false, reason: `operator answered ${JSON.stringify(answer)}, not "proceed"` };
  return { shouldMove: true, reason: 'confirmed stuck and authorized', shortId: v.shortId, jobDirPath: v.jobDirPath };
}

/**
 * BUILD THE DECLARATION. `readStuckFacts` is the injected reader; {@link ./clear-stuck-session-io.mjs}
 * supplies the real one and tests supply a stub. Built per call so nothing leaks between registries.
 *
 * @param {{readStuckFacts: (o: {session: string, pr: number}) => object}} deps
 * @returns {object} the frozen declaration from `op()`.
 */
export function clearStuckSessionOperation({ readStuckFacts } = {}) {
  if (typeof readStuckFacts !== 'function') {
    throw new TypeError(
      'clear-stuck-session: needs a `readStuckFacts({session, pr})` reader — the io is INJECTED so the '
      + 'declaration stays testable with no `claude` listing, no `ps` and no jobs directory; the real binding '
      + 'is `we:scripts/operations/clear-stuck-session-io.mjs`.',
    );
  }

  return op(CLEAR_STUCK_SESSION_OP, {
    input: {
      // Either names the stuck session — `session` directly (its short id, exactly as `claude agents --json`
      // and the `<config-dir>/jobs/<id>/` directory name spell it, a full session UUID also accepted), or
      // `pr`, which the reader resolves to whichever session `reconcile-core.mjs#bindAgents` binds to that PR
      // (the SAME lookup `reconcile-core.mjs`/`dispatch-abort.mjs` already use — not re-derived here).
      session: { type: 'string', required: false, default: '' },
      pr: { type: 'number', required: false, default: 0 },
    },
    verdictFrom: 'assess',

    // ── 1. read ─────────────────────────────────────────────────────────────────────────────────────────────
    read: compute({
      reads: ['input.session', 'input.pr'],
      fn: (view) => shapeStuckRead(readStuckFacts({ session: view.input.session, pr: view.input.pr })),
    }),

    // ── 2. assess ───────────────────────────────────────────────────────────────────────────────────────────
    assess: compute({
      reads: ['findings.read'],
      fn: (view) => assessStuck(view.findings.read),
    }),

    // ── 3. authorize ────────────────────────────────────────────────────────────────────────────────────────
    // A HUMAN, always — this touches `~/.claude`, not this repo's own tree. See the file header for why no
    // policy auto-answers this the way `review-pr`'s does for an agent-addressed confirm.
    authorize: confirmStep({
      reads: ['verdict'],
      asks: authorizeQuestion,
      of: 'operator',
      options: ['proceed', 'abort'],
    }),

    // ── 4. move ─────────────────────────────────────────────────────────────────────────────────────────────
    // ONE effect or zero. Zero whenever the verdict refused OR the human declined — never on the human's say
    // alone, and never on the verdict's say alone.
    move: effectStep({
      reads: ['verdict', 'findings.authorize'],
      effects: (view) => {
        const plan = planMove(view.verdict, view.findings.authorize);
        if (!plan.shouldMove) return [];
        return [{ type: QUARANTINE_MOVE_EFFECT, payload: { shortId: plan.shortId, jobDirPath: plan.jobDirPath } }];
      },
    }),
  });
}
