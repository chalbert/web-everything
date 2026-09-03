#!/usr/bin/env node
/**
 * @file scripts/conveyor/session-reaper.mjs
 * @description THE CONVEYOR SESSION REAPER (WE #3435, epic #3383). Walks `claude agents --json` and calls
 *   `claude stop <id>` on every BACKGROUND session that is done producing more work — nothing did this before:
 *   `lease-reaper.mjs` (#2667) reclaims LANE leases, a wholly separate resource from a `claude agents` session
 *   registration. Left undone, every review/fix/build dispatch this epic's own mechanism runs adds one more
 *   entry that stays listed until a human runs `claude stop <id>` by hand — 12 finished `review-*` sessions
 *   plus 4 stale `conveyor-*` ones in one live-fire night alone.
 *
 * MIRRORS `lease-reaper.mjs`'S PURE-CORE / IO-SHELL SPLIT:
 *   • The PURE core ({@link classifySessionReap}, {@link classifySessionReapWithGroundTruth},
 *     {@link sessionReapPlan}, {@link sessionTarget}) has NO fs / exec / clock — every session row (and, for
 *     the ground-truth upgrade, every resolver answer) is passed in exactly as shaped by its caller. Unit-tested
 *     directly on fixtures.
 *   • The IO SHELL (the `main()` CLI) owns the one `claude agents --json` read, the ground-truth resolver's
 *     backlog-file reads and `gh pr view` calls, and the stop delegation to `dispatch-abort.mjs`'s
 *     `stopSession` — the ONE existing `claude stop <id>` wrapper in this repo (built for #3383's own "don't
 *     `kill`, `claude stop`" lesson) — rather than re-shelling `claude` a second way.
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
 * COST DISCIPLINE, mirroring `we:scripts/operations/dispatch-lane-io.mjs`'s own `PR_LIST_TIMEOUT_MS`/
 * `PR_LIST_LIMIT` bounds. A backlog-item ground-truth check is one local file read — no rate-limit concern, so
 * it is unbounded. A PR-target check is one real `gh pr view <pr>` network call, bounded two ways: (1) it
 * reuses `dispatch-lane-io.mjs`'s own `prListTimeoutMs` per-call timeout rather than inventing a second knob
 * for the same class of cost (`defaultLaneRefForPr`'s own docblock names this exact reuse), and (2)
 * {@link makeGroundTruthResolver} caps the number of `gh pr view` calls ONE reaper pass will make
 * ({@link MAX_GH_PR_VIEW_CALLS_PER_TICK}) — a candidate past the cap is left `not-terminal` this tick and
 * re-tried the next one, never an unbounded `gh` burst. Every resolver answer is cached per pass too, so two
 * sessions naming the same target (a retried `conveyor-3441b` alongside `conveyor-3441`) cost one lookup.
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
 * `claude stop`'S REPORTED SUCCESS IS A HINT, NOT A CERTAINTY (found live 2026-09-02, confirmed against
 * upstream `anthropics/claude-code` issues #65925/#45250/#41461): a stop can report success while the local
 * listing keeps reporting the session unchanged. This reaper does not re-poll to confirm — that would add a
 * second `claude agents --json` read (and a race) for a confirmation this repo already knows is unreliable —
 * it logs {@link stopSession}'s own `alreadyGone` distinction and moves on, exactly as best-effort as
 * `lease-reaper.mjs`'s own per-candidate try/catch.
 *
 * WHY `id`, NOT `sessionId` — the near-universal `claude stop` FAILURE `we:backlog/3435-*.md`'s "Found live"
 * finding 3 recorded (all five sessions, including `conveyor-3421b`, came back "No job matching" on `claude
 * stop <sessionId>`) was read at the time as a CLI/registry-staleness limitation, the same family as the
 * success-side note just above. It is not that. It is a wrong-FIELD bug: this loop passed `session.sessionId`
 * (the full listing-internal UUID `claude stop`/`claude rm` do not match on) where it should have passed
 * `session.id` (the short form the CLI actually accepts). Verified live 2026-09-03: a fresh `claude agents
 * --json --all` (208 rows) shows `id` present on all 204 `kind: 'background'` rows and absent on exactly the 4
 * `kind: 'interactive'` ones (a human's own terminal/Remote-Control session — never a row this reaper's `kind
 * !== 'background'` guard, above, would let reach the stop call in the first place). So within this reaper's
 * own domain `id` is always present — never the "absent from half the listing" shape `dispatch-lane-io.mjs
 * #listedSessionIds`'s own docblock measured (correctly, for the FULL mixed listing that function reads; that
 * finding stands, it just does not extend to `kind: 'background'` rows, the only ones this file ever acts on).
 * Direct proof the swap fixes the failure, same session: `claude stop <full sessionId>` on a real `done`
 * session (`conveyor-2972`) exited 1 with "No job matching"; `claude stop <short id>` on the SAME session
 * immediately after exited 0, "stopped". THIS DOES NOT MAKE `claude stop` UNIVERSALLY RELIABLE — a genuinely-
 * already-exited background session can still legitimately answer "No job matching" even given the correct
 * `id` (that is {@link stopSession}'s own documented `alreadyGone` case, expected and benign); today's failure
 * was near-100% and traced to the wrong field, not to occasional legitimate staleness. `main()`'s stop loop
 * below therefore reads `session.id` (never `session.sessionId`) for the actual handle, and treats a missing
 * `id` on a reap candidate as a logged anomaly rather than a silent skip — it should never happen given the
 * `kind !== 'background'` guard above, but "should never happen" is not the same as "cannot happen".
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { readField } from '../backlog/frontmatter.mjs';
import { stopSession } from '../operations/dispatch-abort.mjs';
import { defaultListAgents, normalizeHandle, prListTimeoutMs } from '../operations/dispatch-lane-io.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// ── PURE CORE (no fs / exec / clock — every signal is injected) ────────────────────────────────────────────

/** States `claude agents` reports for a session's OWN process that mean "stop it — it is done producing more
 *  work" (see the file header for the live count that grounds this pair). */
export const TERMINAL_REAP_STATES = new Set(['done', 'failed']);

/** States that mean the session is already stopped — nothing to do, kept apart from `not-terminal` so a
 *  caller can tell "already handled" from "still live, leave it alone". */
export const ALREADY_STOPPED_STATES = new Set(['stopped']);

/**
 * The DETERMINISTIC reap verdict for ONE `claude agents --json` row — pure, same row → same verdict. This is
 * the STATE-ONLY axis; see {@link classifySessionReapWithGroundTruth} for the axis that can ALSO reap a
 * `not-terminal` row once its target is independently confirmed done.
 *
 * @param {object|null} session - one element of a `claude agents --json` listing.
 * @returns {{reap:boolean, reason:('done'|'failed'|'already-stopped'|'not-background'|'not-terminal')}}
 */
export function classifySessionReap(session) {
  if (!session || typeof session !== 'object') return { reap: false, reason: 'not-terminal' };
  // Structural guard FIRST — see the file header on why this can never be state-dependent.
  if (session.kind !== 'background') return { reap: false, reason: 'not-background' };
  const state = session.state;
  if (TERMINAL_REAP_STATES.has(state)) return { reap: true, reason: state };
  if (ALREADY_STOPPED_STATES.has(state)) return { reap: false, reason: 'already-stopped' };
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
 * @param {string|null|undefined} name
 * @returns {{kind:'item', id:string}|{kind:'pr', id:string}|null}
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
 * @param {object|null} session
 * @param {((target:{kind:'item'|'pr', id:string}) => ({resolved:boolean, evidence?:string}|null))|null} [groundTruthFor]
 * @returns {{reap:boolean, reason:string}}
 */
export function classifySessionReapWithGroundTruth(session, groundTruthFor) {
  const base = classifySessionReap(session);
  if (base.reap || base.reason !== 'not-terminal' || typeof groundTruthFor !== 'function') return base;
  const target = sessionTarget(session?.name);
  if (!target) return base; // no derivable target — never guess
  const truth = groundTruthFor(target);
  if (truth && truth.resolved === true) {
    return { reap: true, reason: `ground-truth-${target.kind}:${truth.evidence || target.id}` };
  }
  return base; // unresolved / unknown / not yet done — leave it exactly as the state-only axis would
}

/**
 * Map {@link classifySessionReapWithGroundTruth} over a full `claude agents --json` listing. Passing no
 * `groundTruthFor` (the default) makes this byte-identical to mapping {@link classifySessionReap} alone —
 * every existing caller/test is unaffected.
 * @param {unknown[]} sessions
 * @param {{groundTruthFor?: ((target:{kind:'item'|'pr', id:string}) => ({resolved:boolean, evidence?:string}|null))|null}} [opts]
 * @returns {{reap:Array, keep:Array}} each entry carries the original row plus its `reason`.
 */
export function sessionReapPlan(sessions, { groundTruthFor = null } = {}) {
  const reap = [];
  const keep = [];
  for (const session of Array.isArray(sessions) ? sessions : []) {
    const verdict = classifySessionReapWithGroundTruth(session, groundTruthFor);
    const row = { session, reason: verdict.reason };
    (verdict.reap ? reap : keep).push(row);
  }
  return { reap, keep };
}

// ── IO SHELL (runs only as a CLI — owns the one `claude agents --json` read, the ground-truth lookups, and the
//    stop delegation) ──────────────────────────────────────────────────────────────────────────────────────

/** Default backlog directory, matching `src/_data/backlog.js`'s own `WE_BACKLOG_DIR` override convention
 *  (#3445) so a test can point the ground-truth resolver at a throwaway corpus without touching the real one. */
const DEFAULT_BACKLOG_DIR = process.env.WE_BACKLOG_DIR || join(HERE, '..', '..', 'backlog');

/** How many real `gh pr view` calls ONE reaper pass will make for PR-kind ground-truth checks — see the file
 *  header's "COST DISCIPLINE" section. Generous relative to the live-measured 2026-09-03 count (at most a
 *  handful of `review-*`/`fix-*`/`ci-heal-*` rows in `working`/`blocked` at once) while still bounding a
 *  pathological listing from firing an unbounded `gh` burst in one tick. */
export const MAX_GH_PR_VIEW_CALLS_PER_TICK = 25;

/**
 * The item-kind ground-truth answer for backlog item `id` — `resolved: true` iff its own card's `status:`
 * frontmatter reads exactly `resolved`. A missing card, or one whose `status:` can't be read, answers
 * `resolved: false`/`null` respectively — NEVER `true` on absence, so a mis-derived or since-renumbered id
 * never falsely reads as done. One local file read, no rate-limit concern.
 * @param {string} id
 * @param {{backlogDir?:string, readdirSyncFn?:Function, readFileSyncFn?:Function}} [io]
 * @returns {{resolved:boolean, evidence?:string}|null} `null` only when the backlog directory itself is unreadable.
 */
export function groundTruthForItem(id, { backlogDir = DEFAULT_BACKLOG_DIR, readdirSyncFn = readdirSync, readFileSyncFn = readFileSync } = {}) {
  let entries;
  try {
    entries = readdirSyncFn(backlogDir);
  } catch {
    return null; // backlog dir itself unreadable — unknown, never reap on an unreadable signal
  }
  const fname = entries.find((f) => f.endsWith('.md') && (f === `${id}.md` || f.startsWith(`${id}-`)));
  if (!fname) return { resolved: false }; // no card at all — nothing to confirm, not an error
  try {
    const text = readFileSyncFn(join(backlogDir, fname), 'utf8');
    const status = readField(text, 'status');
    return status === 'resolved' ? { resolved: true, evidence: `backlog#${id}:resolved` } : { resolved: false };
  } catch {
    return null; // the one found file itself unreadable — unknown, never reap on an unreadable signal
  }
}

/**
 * The PR-kind ground-truth answer for PR `pr` — `resolved: true` iff `gh pr view` reports it merged. Any
 * failure (no `gh`, PR not found, timeout) answers `null` (unknown) rather than throwing — a best-effort
 * check, matching every other `gh`-shelling function in this codebase's own fail-soft convention.
 * @param {string|number} pr
 * @param {{exec?:Function, env?:object}} [io]
 * @returns {{resolved:boolean, evidence?:string}|null}
 */
export function groundTruthForPr(pr, { exec = execFileSync, env = process.env } = {}) {
  try {
    // Reuses `dispatch-lane-io.mjs`'s own `prListTimeoutMs` bound rather than inventing a second knob for the
    // same class of cost (one bounded `gh pr view` network call) — see the file header's "COST DISCIPLINE".
    const out = exec('gh', ['pr', 'view', String(pr), '--json', 'state,mergedAt'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024,
      timeout: prListTimeoutMs(env),
      killSignal: 'SIGKILL',
    });
    const parsed = JSON.parse(String(out || '{}'));
    const merged = Boolean(parsed?.mergedAt) || String(parsed?.state || '').toUpperCase() === 'MERGED';
    return merged ? { resolved: true, evidence: `pr#${pr}:merged` } : { resolved: false };
  } catch {
    return null; // `gh` unavailable / PR not found / timeout — unknown, never reap on an unreadable signal
  }
}

/**
 * Build a `groundTruthFor` resolver for {@link sessionReapPlan}: routes an item-kind target to
 * {@link groundTruthForItem} (unbounded, local) and a PR-kind target to {@link groundTruthForPr} (bounded by
 * {@link MAX_GH_PR_VIEW_CALLS_PER_TICK}, network) — each answer cached per target for the life of the returned
 * resolver, so two sessions naming the same target cost one lookup.
 * @param {{exec?:Function, env?:object, backlogDir?:string, readdirSyncFn?:Function, readFileSyncFn?:Function, maxPrViewCalls?:number}} [io]
 * @returns {(target:{kind:'item'|'pr', id:string}) => ({resolved:boolean, evidence?:string}|null)}
 */
export function makeGroundTruthResolver({
  exec = execFileSync,
  env = process.env,
  backlogDir = DEFAULT_BACKLOG_DIR,
  readdirSyncFn = readdirSync,
  readFileSyncFn = readFileSync,
  maxPrViewCalls = MAX_GH_PR_VIEW_CALLS_PER_TICK,
} = {}) {
  const cache = new Map();
  let prViewCalls = 0;
  return function groundTruthFor(target) {
    const key = `${target.kind}:${target.id}`;
    if (cache.has(key)) return cache.get(key);
    let result;
    if (target.kind === 'item') {
      result = groundTruthForItem(target.id, { backlogDir, readdirSyncFn, readFileSyncFn });
    } else if (target.kind === 'pr') {
      if (prViewCalls >= maxPrViewCalls) {
        result = null; // bounded — left unresolved this tick rather than an unbounded `gh` burst; retried next tick
      } else {
        prViewCalls++;
        result = groundTruthForPr(target.id, { exec, env });
      }
    } else {
      result = null;
    }
    cache.set(key, result);
    return result;
  };
}

const log = (m) => process.stderr.write(m + '\n');

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

function main(argv) {
  const flags = parseFlags(argv);
  const dryRun = !!flags['dry-run'];
  // `--no-ground-truth` is an escape hatch back to the original state-only axis, for a rollback or an
  // A/B live comparison — the default is ON, matching the operator's own instruction that this axis should
  // actually run, not merely exist.
  const groundTruthFor = flags['no-ground-truth'] ? null : makeGroundTruthResolver({ exec: execFileSync });

  let sessions;
  try {
    // `all: true` IS LOAD-BEARING (#3435 review finding): every OTHER caller of `defaultListAgents` (the
    // dispatch observer, the dispatch guard's liveness check) deliberately omits `--all`, because for THEIR
    // job a completed session must read as gone. This reaper's job is the opposite — it exists to find and
    // `claude stop` exactly the `done`/`failed` sessions the plain listing excludes — so passing no `all` here
    // made `sessionReapPlan` compute `reap: []` on every real invocation; `claude stop` was never called, and
    // the clutter #3435 was filed to fix never actually got touched. See `defaultListAgents`'s own docblock
    // (`we:scripts/operations/dispatch-lane-io.mjs`) for why the OTHER callers must not also flip this.
    sessions = defaultListAgents({ exec: execFileSync, all: true });
  } catch (e) {
    // Best-effort like every other mechanical pass (Done-when #3): an unreadable listing means there is
    // nothing safe to act on this tick, not a hard failure — the next tick tries again.
    log(`  ⚠ \`claude agents --json\` unreadable — session-reaper skipping this tick: ${String(e?.message || e).split('\n')[0]}`);
    process.exit(0);
  }
  if (!Array.isArray(sessions)) sessions = [];

  const { reap, keep } = sessionReapPlan(sessions, { groundTruthFor });

  let stopped = 0;
  let alreadyGone = 0;
  let failures = 0;
  let anomalies = 0;
  const done = [];
  for (const { session, reason } of reap) {
    // `id` (the SHORT form), never `sessionId` (the full UUID `claude stop` does not match on) — see the file
    // header's "WHY `id`, NOT `sessionId`" section. Every row here already passed `classifySessionReap`'s
    // `kind !== 'background'` guard, and every `kind: 'background'` row measured (live and in the checked-in
    // fixture) carries a real `id` — so a missing one here is a genuine anomaly, not an expected shape, and is
    // logged + counted rather than silently skipped (a `continue` with no trace would hide exactly the case
    // this guard exists to catch).
    const handle = normalizeHandle(session.id);
    if (!handle) {
      log(`  ⚠ ${session.sessionId ?? session.name ?? 'unknown'}: reap candidate is missing \`id\` — should never happen for a \`kind: background\` row, skipping and flagging as an anomaly`);
      anomalies++;
      continue;
    }
    if (dryRun) {
      log(`  would stop ${handle} (${reason}; ${session.name ?? 'unnamed'})`);
      continue;
    }
    try {
      const res = stopSession({ handle, exec: execFileSync });
      if (res.alreadyGone) alreadyGone++;
      else stopped++;
      log(`  ${res.alreadyGone ? 'already gone' : 'stopped'} ${handle} (${reason}; ${session.name ?? 'unnamed'})`);
      done.push({ id: handle, sessionId: normalizeHandle(session.sessionId) || null, name: session.name ?? null, reason, alreadyGone: res.alreadyGone });
    } catch (e) {
      // ONE session's stop failing never blocks the rest of the pass (Done-when #3) — the same
      // "couldn't confirm, background service may be restarting" flakiness lease-reaper.mjs already treats
      // as per-candidate, not pass-fatal.
      log(`  ⚠ ${handle}: stop failed (${String(e?.message || e).split('\n')[0]}) — left for the next tick`);
      failures++;
    }
  }

  if (flags.json) {
    process.stdout.write(
      JSON.stringify(
        {
          scanned: sessions.length,
          stopped: dryRun ? 0 : stopped,
          alreadyGone: dryRun ? 0 : alreadyGone,
          failures: dryRun ? 0 : failures,
          anomalies,
          wouldStop: dryRun
            ? reap.map((r) => ({ id: normalizeHandle(r.session.id) || null, sessionId: normalizeHandle(r.session.sessionId) || null, name: r.session.name ?? null, reason: r.reason }))
            : undefined,
          collected: dryRun ? undefined : done,
          kept: keep.length,
        },
        null,
        2,
      ) + '\n',
    );
  } else {
    log(
      `session-reaper: ${sessions.length} session(s) listed · ` +
        `${dryRun ? `${reap.length} would stop` : `${stopped} stopped${alreadyGone ? `, ${alreadyGone} already gone` : ''}${failures ? `, ${failures} failed` : ''}${anomalies ? `, ${anomalies} anomal${anomalies === 1 ? 'y' : 'ies'}` : ''}`} · ${keep.length} kept`,
    );
  }
  // Non-zero exit when a stop we ATTEMPTED actually failed, OR a reap candidate turned out to be missing its
  // `id` (the anomaly case — see the loop above) — mirrors lease-reaper.mjs's own convention, so a cron/loop
  // wrapper can tell a clean sweep from a partial one. `runQuiet` (the runner's own caller) swallows this
  // either way — it is surfaced for anyone invoking the CLI directly.
  process.exit(failures > 0 || anomalies > 0 ? 1 : 0);
}

// Run the IO shell only when invoked directly — never on import (keeps the pure core side-effect-free).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2));
}
