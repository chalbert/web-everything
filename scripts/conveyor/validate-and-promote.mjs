#!/usr/bin/env node
/**
 * @file scripts/conveyor/validate-and-promote.mjs
 * @description VALIDATE-THEN-PROMOTE (epic #3383) — the one operation that moves the conveyor driver onto new
 *   code, and the only thing that ever writes the watchdog's last-known-good marker without a human typing it.
 *
 * ── THE GAP THIS CLOSES ─────────────────────────────────────────────────────────────────────────────────────
 *
 * {@link ./driver-watchdog.mjs} can roll a silently-stale driver back, but ONLY to a commit somebody recorded
 * as good first — `record-good` is explicit by design, never inferred. Nothing called it. A watchdog whose
 * fallback marker is never written is a watchdog that always refuses (`no-fallback`), which is a watchdog that
 * does nothing.
 *
 * The trigger was already sitting there, unautomated: the operator's own habit of live-fire testing a commit in
 * a disposable checkout before trusting the driver to it. That validation pass is EXACTLY the moment a commit
 * earns the right to be promoted, and the same moment the commit being left behind earns the right to be the
 * fallback. So this file fuses the three steps that were manual and separate — validate, record the fallback,
 * promote — into one operation with one verdict, and makes the promotion CONDITIONAL on the validation.
 *
 * ── WHICH SHA `record-good` NAMES, AND WHY IT IS THE OUTGOING ONE ───────────────────────────────────────────
 *
 * THE OUTGOING COMMIT — the one the driver is LEAVING — not the validated target. This is the single most
 * load-bearing decision in the file, it is the opposite of the naive reading ("we just validated the target,
 * so the target is good"), and it is forced by {@link ./driver-watchdog.mjs#decideRollback}:
 *
 *   Record the TARGET, and immediately after the promotion `HEAD === lastKnownGood`. The watchdog's
 *   `already-at-last-known-good` loop guard then fires on the very next stale verdict and REFUSES to roll back
 *   — forever, or until a human rewrites the marker. Recording the target does not arm the watchdog; it
 *   permanently disarms its only healing path and demotes it to an alarm.
 *
 *   Record the OUTGOING commit and the marker means what the watchdog's own header says it means: the code the
 *   driver was demonstrably RUNNING before this promotion. If the freshly-promoted code turns out to be
 *   silently stale, the rollback has somewhere real to go. If the outgoing commit was ALSO stale, the rollback
 *   happens once, is found stale at the marker, and `already-at-last-known-good` escalates to a human —
 *   bounded, not a loop. That is strictly better than never rolling back at all.
 *
 * This is also the zero-argument reading of the watchdog's own CLI: `record-good --checkout=DIR` with no
 * `--sha` defaults to that checkout's current HEAD, i.e. the outgoing commit, and its usage text says so
 * ("naming the commit it is LEAVING"). This file passes the sha EXPLICITLY anyway, resolved before the reset,
 * so the record can never be a race against the checkout it describes.
 *
 * ── WHAT "VALIDATED" CONCRETELY MEANS ───────────────────────────────────────────────────────────────────────
 *
 * Five checks, in order, ALL of which must pass; a validation that did not run all five is not `validated`
 * either ({@link classifyValidation} treats a missing check as a failure, never as a pass). Every one of them
 * runs inside a THROWAWAY CLONE pinned at the candidate sha — never in the driver's checkout, never in this
 * one — so a candidate that is broken enough to wreck a working tree wrecks only the throwaway:
 *
 *   1. `checkout`       — clone, detach at the candidate sha, and confirm the clone's HEAD IS that sha. A
 *                         clone that silently landed somewhere else would validate the wrong code.
 *   2. `deps`           — make `node_modules` present. `link` (symlink the source checkout's) when the
 *                         candidate's `package-lock.json` is byte-identical to the source's, `install`
 *                         (`npm ci`) when it differs or cannot be read. See {@link decideDeps}.
 *   3. `tests`          — `npm run test:unit` over the DRIVER SURFACE ({@link DRIVER_SURFACE}): the conveyor
 *                         passes, the readiness/planning modules, the operations engine, and the runner. That
 *                         is the code a promotion actually changes the behaviour of. `--full` runs the whole
 *                         suite instead, for a candidate that touches more than the driver.
 *   4. `standards`      — `npm run check:standards`, 0 errors. The repo's own gate; a candidate that fails it
 *                         would fail every downstream lane's gate too.
 *   5. `dispatch-probe` — THE CHECK THAT EXISTS FOR THIS BUG CLASS, and the reason a green suite alone is not
 *                         enough. The #3383 failure was a driver that was alive, healthy and dispatching
 *                         NOTHING. So the probe asks the candidate's OWN planner the dumbest possible version
 *                         of the only question that matters: handed two ready, scoped, non-overlapping items
 *                         and two free lanes, does `dispatchPlan` launch both? And, in the other direction,
 *                         does a blanket dispatch-pause still hold them? A planner stuck closed fails the
 *                         first; a pause lever stuck open fails the second. See {@link DISPATCH_PROBE_SRC}.
 *
 * NOT A LIVE `--once` TICK, deliberately. A real tick spawns real `claude` agents against real lanes and real
 * PRs from a checkout that has been validated by nothing yet — it would make the validation itself the most
 * dangerous thing in the pipeline, and it needs network, GitHub and a lane pool to mean anything. The probe
 * buys the specific signal a tick would have bought (the planner still dispatches) for none of that blast
 * radius. RESIDUAL, stated rather than hidden: the probe proves the planner launches on a SYNTHETIC fixture,
 * not on the real board. A candidate that dispatches the fixture and holds every real item would still pass
 * here — and would then be caught by the watchdog, which is exactly the layering these two files are for.
 *
 * THE PROBE'S CODE IS THIS FILE'S; THE MODULES IT EXERCISES ARE THE CANDIDATE'S. {@link DISPATCH_PROBE_SRC} is
 * a constant HERE and is written into the throwaway clone at validation time. Shipping it as a file in the repo
 * would mean validating a commit that predates the probe fails for the wrong reason, and would let a candidate
 * edit the very assertion meant to judge it. Control plane trusted, data plane under test — the same split
 * {@link ./driver-watchdog.mjs#healDriver} makes when it runs `restart-runner` from ITS checkout.
 *
 * ── ON FAILURE, NOTHING MOVES ───────────────────────────────────────────────────────────────────────────────
 *
 * No `record-good`, no reset, no restart — the driver keeps running whatever it was running and the marker
 * keeps pointing wherever it pointed. The failing check, its exit status and the tail of its output are
 * reported and logged, and the throwaway clone is KEPT (its path is printed) so a human can go look. On
 * success the clone is removed; `--keep` keeps it either way.
 *
 * ── PURITY: THE SAME CONCERN AS THE WATCHDOG'S, FOR A SHARPER REASON ────────────────────────────────────────
 *
 * This file decides whether a commit can be TRUSTED. If the bug class it is judging could reach it, it would be
 * judging with the defect in its own scope. So its import graph is asserted to be EXACTLY the watchdog's graph
 * plus itself (`__tests__/validate-and-promote.test.mjs`): no `tick-core.mjs`, no `dispatch-plan.mjs`, no
 * `dispatch-lane.mjs`, no operations registry. Every one of those is reached the safe way — as a SUBPROCESS, in
 * the throwaway clone or behind `run.mjs`, where a defect is an exit status this file reads rather than an
 * exception that takes it down. Shelling a command is a syscall; importing a planner is shared failure.
 *
 * PURE-CORE / IO-SHELL SPLIT, the house shape: every judgment ({@link decideDeps} … {@link decidePromotion})
 * takes plain objects and no fs/clock/process, so the whole decision table is unit-tested with no clone, no
 * npm, no driver and no runner.
 */

import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import { gitRun, notifyDesktop, defaultAppendLog } from './branch-sync.mjs';
import { SHA_RE, readHead, parseFlags } from './driver-watchdog.mjs';

// ── TUNING (exported so a caller/test can override) ────────────────────────────────────────────────────────

/** The paths `npm run test:unit` is narrowed to by default — the DRIVER SURFACE. Everything whose behaviour a
 *  driver promotion can actually change: the conveyor's own passes, the readiness/planning modules the tick
 *  reads, the operations engine every dispatch goes through, and the runner/supervisor themselves. `--full`
 *  drops the narrowing. Narrowed by DEFAULT because a promotion that has to wait out the entire repo suite is
 *  a promotion an operator does by hand instead, which is the habit this file exists to replace. */
export const DRIVER_SURFACE = Object.freeze([
  'scripts/conveyor',
  'scripts/readiness',
  'scripts/operations',
  'skills-src/conveyor',
]);

/** Every check that must be present AND passing before a promotion is allowed. A check missing from the run is
 *  a FAILURE ({@link classifyValidation}), so a future refactor that drops one cannot silently widen what
 *  counts as validated. */
export const REQUIRED_CHECKS = Object.freeze(['checkout', 'deps', 'tests', 'standards', 'dispatch-probe']);

/** Per-check wall clock. The suite over the driver surface is the long pole (minutes, not seconds); 30 is
 *  generous enough that a loaded host never fails for the wrong reason and short enough that a wedged check
 *  does not hold a promotion open all day. */
export const DEFAULT_CHECK_TIMEOUT_MS = 30 * 60_000;

/** `restart-runner` does its own bounded waiting (shutdown confirmation is 90 s, `--wait` up to 5 min), so
 *  this only has to be longer than its worst legitimate case. */
export const DEFAULT_PROMOTE_TIMEOUT_MS = 10 * 60_000;

/** How many trailing lines of a failing check's output are carried on the report. Enough to see the failing
 *  assertion or the standards error; short enough that a `--json` verdict stays readable. */
export const OUTPUT_TAIL_LINES = 20;

/** The generated probe's filename inside the throwaway clone. Dot-prefixed so it cannot collide with anything
 *  tracked, and removed with the clone. */
export const PROBE_FILENAME = '.validate-dispatch-probe.mjs';

/**
 * THE DISPATCH PROBE. Written into the throwaway clone and run by `node` there, so the `dispatchPlan` it
 * imports is the CANDIDATE's — see the file header for why this text lives here rather than in the repo.
 *
 * Two assertions, deliberately opposite, because "the driver dispatches nothing" and "the driver dispatches
 * everything regardless of the pause" are both catastrophic and a single-direction probe catches only one:
 *
 *   • STUCK CLOSED — two ready, scoped, mutually non-overlapping items and two free lanes must produce two
 *     launches. This is the dumbest possible shape that MUST dispatch: no blockers, no grouping kind, no
 *     decision, no missing scope, no overlap, no concurrency cap, no pause. A planner that holds this is
 *     holding everything, which is precisely the #3383 outage.
 *   • STUCK OPEN — the same fixture under a blanket `dispatchPaused` must produce zero launches. A pause lever
 *     that has silently stopped working promotes straight into a double-dispatch incident.
 *
 * Exits 0 with one line on success, 1 with the offending plan on failure.
 */
export const DISPATCH_PROBE_SRC = `import { dispatchPlan } from './scripts/readiness/dispatch-plan.mjs';

const fixture = () => ({
  queue: [
    { num: 'probe-a', kind: 'story', scope: ['src/__validate-probe-a__/'] },
    { num: 'probe-b', kind: 'story', scope: ['src/__validate-probe-b__/'] },
  ],
  leases: [],
  freeLanes: ['lane-9001', 'lane-9002'],
});

const open = dispatchPlan(fixture());
const launched = Array.isArray(open && open.launch) ? open.launch.map((l) => String(l && l.num)) : [];
if (launched.length !== 2) {
  process.stderr.write('dispatch-probe: STUCK CLOSED — two ready, scoped, non-overlapping items with two free '
    + 'lanes produced ' + launched.length + ' launch(es), expected 2. plan=' + JSON.stringify(open) + '\\n');
  process.exit(1);
}

const held = dispatchPlan({ ...fixture(), dispatchPaused: true });
const heldLaunch = Array.isArray(held && held.launch) ? held.launch : [];
if (heldLaunch.length !== 0) {
  process.stderr.write('dispatch-probe: STUCK OPEN — a blanket dispatch-pause still launched '
    + heldLaunch.length + ' item(s), expected 0. plan=' + JSON.stringify(held) + '\\n');
  process.exit(1);
}

process.stdout.write('dispatch-probe: ok — launches ' + launched.join(',') + ' when open, holds both when paused\\n');
`;

// ── PURE CORE (no fs / clock / process — every input is injected) ──────────────────────────────────────────

/**
 * The last {@link OUTPUT_TAIL_LINES} non-empty lines of a check's combined output. PURE.
 *
 * Non-empty only: vitest and the standards gate both pad with blank lines, and a tail of blanks is a tail that
 * tells an operator nothing about why the thing failed.
 *
 * @param {string} text
 * @param {number} [lines]
 * @returns {string}
 */
export function outputTail(text, lines = OUTPUT_TAIL_LINES) {
  return String(text ?? '')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.length > 0)
    .slice(-Math.max(1, lines))
    .join('\n');
}

/**
 * LINK THE SOURCE CHECKOUT'S `node_modules`, OR INSTALL FRESH? PURE over the two lockfiles' bytes.
 *
 * `link` is the fast path and the common one: a driver promotion is usually a code change, not a dependency
 * change, and `npm ci` costs minutes the operator will not wait for. It is only SAFE when the candidate's
 * `package-lock.json` is byte-identical to the checkout whose `node_modules` is being borrowed — anything else
 * means the candidate is validated against a dependency tree it does not describe, which is a green run that
 * proves nothing.
 *
 * An UNREADABLE lockfile on either side resolves to `install`, never to `link`: "I could not compare them" and
 * "they are the same" must not have the same consequence.
 *
 * @param {{sourceLock: string|null, candidateLock: string|null}} o
 * @returns {{mode: 'link'|'install', reason: string}}
 */
export function decideDeps({ sourceLock = null, candidateLock = null } = {}) {
  if (typeof sourceLock !== 'string' || typeof candidateLock !== 'string') {
    return { mode: 'install', reason: 'could not read both package-lock.json files — installing rather than borrowing a tree that may not match' };
  }
  if (sourceLock !== candidateLock) {
    return { mode: 'install', reason: 'the candidate\'s package-lock.json differs from the source checkout\'s — a borrowed node_modules would not describe it' };
  }
  return { mode: 'link', reason: 'the candidate\'s package-lock.json is byte-identical to the source checkout\'s — its node_modules is the same tree' };
}

/**
 * IS THIS CANDIDATE VALIDATED? PURE over the check results.
 *
 * A check that did not RUN is a failure, not a pass. That is the whole reason {@link REQUIRED_CHECKS} exists
 * as a list rather than as "whatever the runner happened to do": the failure mode of a validation gate is
 * silently checking less than it claims, and `missing` makes that a red verdict instead of a green one.
 *
 * @param {{name: string, ok: boolean, status?: number|null, detail?: string, output?: string}[]} checks
 * @param {{required?: readonly string[]}} [o]
 * @returns {{validated: boolean, ran: string[], missing: string[], failed: object[], reason: string}}
 */
export function classifyValidation(checks, { required = REQUIRED_CHECKS } = {}) {
  const rows = (Array.isArray(checks) ? checks : []).filter((c) => c && typeof c === 'object');
  const ran = rows.map((c) => String(c.name));
  const missing = required.filter((name) => !ran.includes(name));
  const failed = rows.filter((c) => c.ok !== true).map((c) => ({
    name: String(c.name),
    status: c.status ?? null,
    detail: String(c.detail ?? ''),
    output: String(c.output ?? ''),
  }));

  if (failed.length) {
    const first = failed[0];
    return {
      validated: false,
      ran,
      missing,
      failed,
      reason: `NOT VALIDATED — the \`${first.name}\` check failed (exit ${first.status ?? 'null'}): ${first.detail || 'no detail'}`
        + (failed.length > 1 ? ` (+${failed.length - 1} more: ${failed.slice(1).map((f) => f.name).join(', ')})` : ''),
    };
  }
  if (missing.length) {
    return {
      validated: false,
      ran,
      missing,
      failed: [],
      reason: `NOT VALIDATED — ${missing.length} required check(s) never ran (${missing.join(', ')}). `
        + 'A validation that checked less than it claims is not a pass.',
    };
  }
  return { validated: true, ran, missing: [], failed: [], reason: `validated: ${ran.join(', ')} all passed` };
}

/**
 * MAY THE DRIVER BE PROMOTED, AND WHAT DOES `record-good` NAME? PURE. Five refusals, then the answer.
 *
 * `recordSha` is the driver's CURRENT head — the outgoing commit — for the reason the file header gives at
 * length. It is resolved here, from the same read that judged the tree clean, so the caller can never end up
 * recording a sha the checkout has already moved off.
 *
 * @param {object} o
 * @param {{validated: boolean, reason: string}} o.verdict - from {@link classifyValidation}.
 * @param {string} o.target - the candidate sha (already resolved to a full sha by the caller).
 * @param {{sha: string|null, dirty: boolean|null}} o.driver - from `driver-watchdog.mjs#readHead`.
 * @returns {{promote: boolean, guard: string|null, reason: string, targetSha: string|null, recordSha: string|null}}
 */
export function decidePromotion({ verdict, target, driver = {} } = {}) {
  const targetSha = String(target ?? '').trim();
  const at = String(driver?.sha ?? '').trim();
  const no = (guard, reason) => ({ promote: false, guard, reason, targetSha: SHA_RE.test(targetSha) ? targetSha : null, recordSha: null });

  if (!verdict || verdict.validated !== true) {
    return no('validation-failed', `NOT PROMOTING — ${verdict?.reason || 'the candidate was not validated'}. `
      + 'The driver keeps running what it was running, and the last-known-good marker is untouched.');
  }
  if (!SHA_RE.test(targetSha)) {
    return no('unknown-target', `NOT PROMOTING — ${JSON.stringify(String(target ?? ''))} is not a commit id, so there is nothing to promote onto.`);
  }
  if (driver?.dirty === true) {
    return no('dirty-driver-checkout',
      'REFUSING TO PROMOTE — the driver checkout has uncommitted changes. A driver checkout only RUNS the runner, it never '
      + 'edits (memory rule 104: edit-work lands through a lane clone), so a dirty tree means something unexpected is happening '
      + 'there and the `git reset --hard` this promotion performs would destroy it. A human looks first.');
  }
  if (driver?.dirty !== false) {
    return no('unknown-tree',
      'REFUSING TO PROMOTE — could not read the driver checkout\'s working-tree state, so the reset cannot be proven non-destructive.');
  }
  if (!SHA_RE.test(at)) {
    return no('unknown-driver-head',
      'REFUSING TO PROMOTE — could not read the driver checkout\'s HEAD commit. That head IS the fallback this promotion is '
      + 'about to record, so promoting without it would leave the watchdog with a marker it cannot trust.');
  }
  if (at === targetSha || at.startsWith(targetSha) || targetSha.startsWith(at)) {
    return {
      promote: false,
      guard: 'already-at-target',
      reason: `NOTHING TO DO — the driver is already at ${targetSha.slice(0, 12)}. `
        + 'Recording it as last-known-good here would make the marker equal HEAD, which is exactly the state '
        + '`driver-watchdog.mjs#decideRollback` refuses to roll back from.',
      targetSha,
      recordSha: null,
    };
  }
  return {
    promote: true,
    guard: null,
    reason: `promoting the driver from ${at.slice(0, 12)} to validated ${targetSha.slice(0, 12)}, `
      + `recording ${at.slice(0, 12)} (the outgoing commit) as last-known-good first`,
    targetSha,
    recordSha: at,
  };
}

/**
 * The `record-good` argv, split out so the CLI contract it depends on is asserted by a test rather than
 * trusted. PURE. Matches `driver-watchdog.mjs`'s own usage: `record-good [--checkout=DIR] [--sha=COMMIT]
 * [--note=TEXT]`, plus `--json` so the caller reads a record rather than scraping prose.
 *
 * @param {{watchdogCli: string, driver: string, sha: string, note?: string}} o
 * @returns {string[]} argv for `process.execPath`.
 */
export function recordGoodArgv({ watchdogCli, driver, sha, note = '' }) {
  return [watchdogCli, 'record-good', `--checkout=${driver}`, `--sha=${sha}`, `--note=${note}`, '--json'];
}

/**
 * The `run.mjs restart-runner` argv. PURE. Byte-for-byte the shape
 * {@link ./driver-watchdog.mjs#healDriver} already uses, and for the same reason: the CONTROL plane is the
 * trusted checkout this file lives in, the DATA plane is the driver's freshly-reset one.
 *
 * NO `--force`, deliberately — `restart-runner`'s own refusals (a build agent spawned in the last 60 s, an
 * unreadable agent listing, an unconfirmed shutdown, a live lease) all stay in force. A promotion that
 * overrode the double-dispatch guard would be a worse hazard than running one commit behind for a minute.
 *
 * @param {{runnerCli: string, driver: string}} o
 * @returns {string[]} argv for `process.execPath`.
 */
export function restartRunnerArgv({ runnerCli, driver }) {
  return [runnerCli, 'restart-runner', `--checkout=${driver}`, `--supervisor=${join(driver, 'skills-src', 'conveyor', 'supervisor.mjs')}`];
}

/**
 * Should the throwaway clone be removed? PURE. Kept on failure so a human can reproduce the failing check in
 * the exact tree it failed in — the whole point of validating in a real checkout rather than in a sandbox.
 *
 * @param {{validated: boolean, keep: boolean}} o
 * @returns {{remove: boolean, reason: string}}
 */
export function decideCleanup({ validated, keep = false } = {}) {
  if (keep) return { remove: false, reason: '--keep was passed' };
  if (validated) return { remove: true, reason: 'validation passed — nothing left to inspect' };
  return { remove: false, reason: 'validation FAILED — the checkout is kept so the failing check can be reproduced in it' };
}

// ── IO SHELL (fs / git / subprocess / clock past this point) ───────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));

/** This checkout — the TRUSTED control plane. Resolved by script location, never CWD, for the reason
 *  `driver-watchdog.mjs#WATCHDOG_REPO_ROOT` gives. */
export const CONTROL_REPO_ROOT = resolve(HERE, '..', '..');

/** Where a promotion's durable trail goes, beside the watchdog's own log in the DRIVER's checkout. */
export const promoteLogPath = (checkout) => join(checkout, '.conveyor', 'promote.log');

const iso = (ms) => new Date(ms).toISOString();
const readText = (path) => { try { return readFileSync(path, 'utf8'); } catch { return null; } };

/** Add a pattern to a clone's LOCAL ignore list (`.git/info/exclude`) — never a tracked `.gitignore`, which
 *  would show up as a diff in the very tree being validated. Best-effort: a clone that cannot be written here
 *  still validates fine, it just reads dirty. */
function excludeLocally(dir, pattern) {
  try {
    const path = join(dir, '.git', 'info', 'exclude');
    writeFileSync(path, `${readText(path) ?? ''}\n${pattern}\n`);
  } catch { /* best-effort */ }
}

/**
 * Run one check and shape its result. The ONE place a subprocess's exit status becomes a check row, so every
 * check reports identically and {@link classifyValidation} never has to special-case one.
 *
 * `stdout` and `stderr` are BOTH captured and concatenated: vitest puts failures on stdout, the standards gate
 * and the probe put them on stderr, and a report that showed only one of them would be empty exactly half the
 * time. A timeout is reported as a failure with the reason named, not as an exception.
 */
export function runCheck({ name, cmd, args, cwd, env = undefined, timeoutMs = DEFAULT_CHECK_TIMEOUT_MS, run = spawnSync }) {
  const res = run(cmd, args, { cwd, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, env });
  const output = `${String(res?.stdout ?? '')}${String(res?.stderr ?? '')}`;
  const timedOut = res?.signal === 'SIGTERM' && res?.status !== 0;
  const ok = !!res && res.status === 0;
  return {
    name,
    ok,
    status: res?.status ?? null,
    argv: [cmd, ...args],
    detail: ok
      ? 'passed'
      : timedOut
        ? `timed out after ${Math.round(timeoutMs / 60_000)}min`
        : `exited ${res?.status ?? 'null'}${res?.error ? ` (${String(res.error.message || res.error).split('\n')[0]})` : ''}`,
    output: ok ? '' : outputTail(output),
  };
}

/**
 * Make the throwaway clone and pin it at the candidate sha. Returns a `checkout` check row.
 *
 * A LOCAL clone of the source checkout: git hardlinks the object store rather than copying it, so this costs a
 * couple of seconds and almost no disk even for a repo this size, and it needs no network at all.
 *
 * THE SECOND FETCH IS NOT REDUNDANT, AND IT IS NOT ONLY ABOUT REACHABILITY. `git clone` from a local path maps
 * the source's `refs/heads/*` onto the new clone's `refs/remotes/origin/*` — so the clone's `origin/main`
 * becomes whatever the SOURCE checkout happened to have checked out locally, which on a lane clone is the lane
 * branch. That silently reaims every main-relative gate at the wrong baseline: the first live run of this
 * operation failed `check:standards` with two "this backlog file is on main with a non-numeric id" errors that
 * existed only because the clone believed the lane branch WAS main. Re-fetching the source's own
 * `refs/remotes/origin/*` over the clone's restores the real upstream meaning of `origin/main`, and brings in
 * any candidate sha that lives on a remote-tracking ref rather than a local branch at the same time.
 *
 * Best-effort: a source with no remote-tracking refs at all (a bare driver checkout) simply keeps what the
 * clone gave it, and a fetch failure must not fail a validation by itself — the checks downstream still speak.
 *
 * The final `rev-parse HEAD` is not ceremony: it is the assertion that the tree about to be validated is the
 * sha that was asked for, and a clone that landed elsewhere fails HERE rather than producing a green verdict
 * for the wrong code.
 */
export function createScratchCheckout({ source, sha, dir, git = gitRun }) {
  const fail = (detail) => ({ name: 'checkout', ok: false, status: null, detail, output: '' });

  mkdirSync(dirname(dir), { recursive: true });
  const clone = git(['clone', '--quiet', '--no-checkout', source, dir], dirname(dir));
  if (!clone.ok) return fail(`git clone failed — ${String(clone.stderr).split('\n')[0]}`);

  git(['fetch', '--quiet', 'origin', '+refs/remotes/origin/*:refs/remotes/origin/*'], dir);

  // The repo's own `.gitignore` says `node_modules/` WITH a trailing slash, which matches a directory and not
  // the SYMLINK `ensureDeps` may put there — so a linked tree would leave the clone reading dirty and any
  // check that looks at the working tree would be judging the validation's own scaffolding. Excluded locally
  // (`.git/info/exclude`, never a tracked file) so the throwaway clone reads clean whichever deps route runs.
  excludeLocally(dir, 'node_modules');

  const co = git(['checkout', '--detach', '--quiet', sha], dir);
  if (!co.ok) return fail(`could not check out ${sha} in the scratch clone — ${String(co.stderr).split('\n')[0]}`);

  const head = git(['rev-parse', 'HEAD'], dir);
  const at = head.ok ? String(head.stdout).trim() : '';
  if (!SHA_RE.test(at) || !(at === sha || at.startsWith(sha) || sha.startsWith(at))) {
    return fail(`the scratch clone is at ${at || 'an unreadable commit'}, not the requested ${sha} — refusing to validate the wrong code`);
  }
  return { name: 'checkout', ok: true, status: 0, detail: `scratch clone at ${at.slice(0, 12)} → ${dir}`, output: '', dir, sha: at };
}

/**
 * Make `node_modules` present in the scratch clone, by the route {@link decideDeps} chose. Returns a `deps`
 * check row carrying the mode so the report says which route was taken — a green run on a BORROWED tree and a
 * green run on a freshly installed one are not the same evidence, and an operator reading the verdict has to
 * be able to tell them apart.
 */
export function ensureDeps({ source, dir, run = spawnSync, link = symlinkSync, readLock = readText, timeoutMs = DEFAULT_CHECK_TIMEOUT_MS }) {
  const choice = decideDeps({
    sourceLock: readLock(join(source, 'package-lock.json')),
    candidateLock: readLock(join(dir, 'package-lock.json')),
  });
  if (choice.mode === 'link') {
    try {
      link(join(source, 'node_modules'), join(dir, 'node_modules'));
      return { name: 'deps', ok: true, status: 0, mode: 'link', detail: `linked node_modules — ${choice.reason}`, output: '' };
    } catch (e) {
      // A failed link is not fatal: fall through to a real install rather than refusing a promotion over a
      // symlink. The slow path is always correct.
      const row = runCheck({ name: 'deps', cmd: 'npm', args: ['ci', '--silent'], cwd: dir, timeoutMs, run });
      return { ...row, mode: 'install', detail: `${row.detail} (fell back to npm ci: ${String(e?.message ?? e).split('\n')[0]})` };
    }
  }
  const row = runCheck({ name: 'deps', cmd: 'npm', args: ['ci', '--silent'], cwd: dir, timeoutMs, run });
  return { ...row, mode: 'install', detail: row.ok ? `npm ci — ${choice.reason}` : row.detail };
}

/**
 * THE VALIDATION PASS. Runs the five checks in order in the throwaway clone and STOPS AT THE FIRST FAILURE —
 * there is no value in spending twenty minutes of suite time on a candidate whose clone did not even land on
 * the right sha, and the report is clearer when it names one cause rather than a cascade.
 *
 * Returns `{sha, dir, checks}`; the verdict itself is {@link classifyValidation}'s, computed by the caller, so
 * that judgment stays pure and testable with no clone at all.
 */
export function runValidation({
  source = CONTROL_REPO_ROOT,
  sha,
  dir,
  full = false,
  timeoutMs = DEFAULT_CHECK_TIMEOUT_MS,
  git = gitRun,
  run = spawnSync,
  linkFn = symlinkSync,
  readLock = readText,
  writeProbe = writeFileSync,
} = {}) {
  const checks = [];
  const push = (row) => { checks.push(row); return row.ok; };

  if (!push(createScratchCheckout({ source, sha, dir, git }))) return { sha, dir, checks };
  if (!push(ensureDeps({ source, dir, run, link: linkFn, readLock, timeoutMs }))) return { sha, dir, checks };

  const testArgs = full ? ['run', 'test:unit'] : ['run', 'test:unit', '--', ...DRIVER_SURFACE];
  if (!push(runCheck({ name: 'tests', cmd: 'npm', args: testArgs, cwd: dir, timeoutMs, run }))) return { sha, dir, checks };
  if (!push(runCheck({ name: 'standards', cmd: 'npm', args: ['run', 'check:standards'], cwd: dir, timeoutMs, run }))) return { sha, dir, checks };

  try {
    writeProbe(join(dir, PROBE_FILENAME), DISPATCH_PROBE_SRC);
  } catch (e) {
    checks.push({ name: 'dispatch-probe', ok: false, status: null, detail: `could not write the probe into the scratch clone — ${String(e?.message ?? e).split('\n')[0]}`, output: '' });
    return { sha, dir, checks };
  }
  push(runCheck({ name: 'dispatch-probe', cmd: process.execPath, args: [join(dir, PROBE_FILENAME)], cwd: dir, timeoutMs, run }));
  return { sha, dir, checks };
}

/**
 * THE PROMOTION, in the only order that is safe to interrupt at any step.
 *
 *   1. `record-good <outgoing>` — FIRST, and through the watchdog's own CLI rather than by writing the marker
 *      here. Two reasons: the outgoing sha still IS the driver's HEAD at this moment (after step 3 it is not,
 *      and the marker would have to be reconstructed), and a second writer of that file would be a second,
 *      looser copy of a grammar whose whole job is to be right when everything else has gone wrong.
 *   2. FETCH, then verify the target is REACHABLE in the driver's own object database. A reset to a commit the
 *      driver does not have fails halfway through and leaves a checkout in a state nobody planned.
 *   3. `git reset --hard <target>` — the promotion itself.
 *   4. `run.mjs restart-runner` from the CONTROL root, pointed at the driver's now-updated tree.
 *
 * EVERY STEP GATES THE NEXT. A failure at 1 touches nothing. A failure at 2 or 3 leaves the driver running its
 * old code with a marker that (correctly) names that same code — no worse than before, and safe. A failure at
 * 4 leaves the checkout promoted but the old process still resident: the code is new, the marker names the
 * outgoing commit, so the watchdog's rollback stays armed and the next restart picks it up. That state is
 * reported as `promoted-not-restarted` rather than as a success, because an operator must not read "promoted"
 * as "running the new code".
 */
export function promoteDriver({
  driver,
  targetSha,
  recordSha,
  note = '',
  controlRoot = CONTROL_REPO_ROOT,
  watchdogCli = join(CONTROL_REPO_ROOT, 'scripts', 'conveyor', 'driver-watchdog.mjs'),
  runnerCli = join(CONTROL_REPO_ROOT, 'scripts', 'operations', 'run.mjs'),
  git = gitRun,
  run = spawnSync,
  timeoutMs = DEFAULT_PROMOTE_TIMEOUT_MS,
} = {}) {
  const root = resolve(driver);
  const steps = [];
  const out = { recorded: false, recordSha, reset: false, restarted: false, targetSha, steps, error: null };

  // 1. record the fallback
  const recordArgv = recordGoodArgv({ watchdogCli, driver: root, sha: recordSha, note });
  const rec = run(process.execPath, recordArgv, { cwd: controlRoot, encoding: 'utf8', timeout: timeoutMs });
  steps.push({ step: 'record-good', ok: rec?.status === 0, status: rec?.status ?? null, argv: recordArgv });
  if (rec?.status !== 0) {
    out.error = `record-good failed (exit ${rec?.status ?? 'null'}) — ${outputTail(String(rec?.stderr ?? ''), 3) || 'no output'}. `
      + 'NOTHING was promoted: without a fallback marker the watchdog could not roll this promotion back.';
    return out;
  }
  out.recorded = true;

  // 2. make the target reachable in the driver's own object database
  const fetch = git(['fetch', '--quiet', 'origin'], root);
  steps.push({ step: 'fetch', ok: fetch.ok, status: fetch.ok ? 0 : 1 });
  const have = git(['rev-parse', '--verify', `${targetSha}^{commit}`], root);
  steps.push({ step: 'verify-target', ok: have.ok, status: have.ok ? 0 : 1 });
  if (!have.ok) {
    out.error = `the driver checkout does not have commit ${targetSha} even after a fetch`
      + `${fetch.ok ? '' : ' (and the fetch itself failed)'} — refusing to reset onto a commit it cannot reach. `
      + 'The last-known-good marker was recorded; the driver was not moved.';
    return out;
  }

  // 3. the promotion
  const reset = git(['reset', '--hard', targetSha], root);
  steps.push({ step: 'reset', ok: reset.ok, status: reset.ok ? 0 : 1 });
  if (!reset.ok) {
    out.error = `git reset --hard ${targetSha} failed in ${root} — ${String(reset.stderr).split('\n')[0]}. `
      + 'The driver is still on its previous commit and still running it.';
    return out;
  }
  out.reset = true;

  // 4. bring the runner up on it
  const restartArgv = restartRunnerArgv({ runnerCli, driver: root });
  const res = run(process.execPath, restartArgv, { cwd: controlRoot, encoding: 'utf8', timeout: timeoutMs });
  out.restarted = res?.status === 0;
  steps.push({ step: 'restart-runner', ok: out.restarted, status: res?.status ?? null, argv: restartArgv });
  out.restartOutput = outputTail(`${String(res?.stdout ?? '')}${String(res?.stderr ?? '')}`, 6);
  if (!out.restarted) {
    out.error = `restart-runner exited ${res?.status ?? 'null'} — ${String(res?.stderr ?? '').split('\n')[0] || 'no output'}. `
      + 'The checkout IS promoted but the OLD process is still resident, so the conveyor is not running the new code yet. '
      + '`restart-runner` refuses on purpose during an active dispatch — re-run it once dispatch settles.';
  }
  return out;
}

/**
 * ONE validate-and-promote pass: validate the candidate in a throwaway clone, and — only if it passed —
 * record the outgoing commit as last-known-good and promote the driver onto the candidate. The only
 * caller-facing entry point.
 *
 * The outcome is ALWAYS logged into the driver's own `.conveyor/promote.log`, promoted or not, and notified
 * on the desktop, for `branch-sync.mjs`'s #3472 reason: a driver changing commits under an operator who did
 * not watch it happen is exactly the kind of event that must not live only in a return value.
 */
export function validateAndPromote({
  driver,
  sha,
  source = CONTROL_REPO_ROOT,
  scratchRoot = join(tmpdir(), 'we-validate-promote'),
  full = false,
  dryRun = false,
  keep = false,
  timeoutMs = DEFAULT_CHECK_TIMEOUT_MS,
  promoteTimeoutMs = DEFAULT_PROMOTE_TIMEOUT_MS,
  validate = runValidation,
  promote = promoteDriver,
  readDriverHead = readHead,
  resolveSha = (rev, root, git = gitRun) => { const r = git(['rev-parse', '--verify', `${rev}^{commit}`], root); return r.ok ? String(r.stdout).trim() : null; },
  cleanup = (dir) => { try { rmSync(dir, { recursive: true, force: true }); return true; } catch { return false; } },
  appendLog = defaultAppendLog,
  notify = notifyDesktop,
  now = () => Date.now(),
  git = gitRun,
} = {}) {
  // NO DRIVER IS A FIRST-CLASS MODE, not a missing argument. `validate --sha=…` with no `--driver` is a pure
  // question about a commit; reading some unrelated checkout's HEAD to produce a promotion refusal about it
  // would be answering a question nobody asked (and, on a working checkout, would report a scary-sounding
  // dirty-tree refusal for a run that was never going to promote anything). Nothing is logged or notified in
  // this mode either — there is no driver whose trail this belongs in.
  const driverRoot = driver ? resolve(driver) : null;
  const nowMs = now();
  const line = (state, msg) => { if (driverRoot) appendLog(promoteLogPath(driverRoot), `${iso(nowMs)} validate-and-promote[${state}]: ${msg}`); };

  const target = resolveSha(sha, source, git);
  if (!target || !SHA_RE.test(target)) {
    const reason = `REFUSING — ${JSON.stringify(String(sha ?? ''))} does not resolve to a commit in ${source}, so there is nothing to validate.`;
    line('unresolved', reason);
    return { driver: driverRoot, target: null, verdict: null, decision: { promote: false, guard: 'unknown-target', reason }, validation: null, promotion: null, scratch: null };
  }

  const dir = join(scratchRoot, `${target.slice(0, 12)}-${nowMs}`);
  const validation = validate({ source, sha: target, dir, full, timeoutMs, git });
  const verdict = classifyValidation(validation.checks);
  line(verdict.validated ? 'validated' : 'failed', `${target.slice(0, 12)}: ${verdict.reason}`);

  const decision = driverRoot
    ? decidePromotion({ verdict, target, driver: readDriverHead({ checkout: driverRoot, git }) })
    : {
      promote: false,
      guard: 'validate-only',
      reason: 'validate-only: no driver checkout was named, so no promotion was considered and nothing was touched.',
      targetSha: target,
      recordSha: null,
    };

  let promotion = null;
  if (decision.promote && !dryRun) {
    promotion = promote({
      driver: driverRoot,
      targetSha: decision.targetSha,
      recordSha: decision.recordSha,
      note: `outgoing commit, recorded by validate-and-promote before promoting to ${decision.targetSha.slice(0, 12)}`,
      timeoutMs: promoteTimeoutMs,
    });
  }

  const action = !verdict.validated ? 'validation-failed'
    : !decision.promote
      ? (decision.guard === 'already-at-target' ? 'no-op' : decision.guard === 'validate-only' ? 'validated' : 'refused')
      : dryRun ? 'dry-run'
        : promotion?.restarted ? 'promoted'
          : promotion?.reset ? 'promoted-not-restarted'
            : 'promote-failed';

  line(action, `${decision.reason}${promotion?.error ? ` — ${promotion.error}` : ''}`);

  const clean = decideCleanup({ validated: verdict.validated, keep });
  const removed = clean.remove ? cleanup(dir) : false;

  if (driverRoot) {
    notify({
      title: action === 'promoted' ? 'Conveyor driver PROMOTED' : `Conveyor promotion ${action}`,
      body: action === 'promoted'
        ? `${driverRoot}: validated ${target.slice(0, 12)} and restarted onto it (fallback = ${String(decision.recordSha).slice(0, 12)}).`
        : `${driverRoot}: ${decision.reason}`.slice(0, 300),
    });
  }

  return {
    driver: driverRoot,
    target,
    action,
    verdict,
    decision,
    validation,
    promotion,
    scratch: { dir, removed, kept: !removed, reason: clean.reason },
  };
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────────────────────────

export const USAGE = `validate-and-promote — live-fire validate a commit, then record it good and promote the driver onto it.

  validate --sha=COMMIT [--source=DIR] [--full] [--keep] [--json]
      Validate only. Runs the five checks in a throwaway clone and reports. Touches NO driver, writes NO marker.

  promote --sha=COMMIT --driver=DIR [--source=DIR] [--full] [--keep] [--dry-run] [--json]
      Validate, and on success: \`driver-watchdog.mjs record-good\` naming the commit the driver is LEAVING,
      then reset the driver checkout to --sha, then \`run.mjs restart-runner\` onto it.
      On failure NOTHING moves — no marker, no reset, no restart — and the failing check is reported.

  --source  the checkout the candidate sha is resolved and cloned from (default: this checkout).
  --driver  the conveyor driver's checkout. REQUIRED by \`promote\`; omitted from \`validate\`, which then reads
            no checkout at all and reports on the commit alone.
  --full    run the WHOLE unit suite instead of just the driver surface.
  --keep    keep the throwaway clone even when validation passed (it is always kept on failure).

  Exit 0 = validated (and promoted, for \`promote\`). 2 = not validated, or the promotion was refused. 1 = usage.`;

export function main(argv, { run = validateAndPromote, stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s) } = {}) {
  const { flags, rest } = parseFlags(argv);
  const verb = rest[0] || 'validate';
  if (flags.help || verb === 'help') { stdout(USAGE + '\n'); return 0; }
  if (verb !== 'validate' && verb !== 'promote') {
    stderr(`validate-and-promote: unknown verb "${verb}"\n\n${USAGE}\n`);
    return 1;
  }

  const sha = typeof flags.sha === 'string' ? flags.sha.trim() : '';
  if (!sha) { stderr(`validate-and-promote: --sha=COMMIT is required\n\n${USAGE}\n`); return 1; }

  const source = resolve(String(typeof flags.source === 'string' ? flags.source : CONTROL_REPO_ROOT));
  // `promote` defaults `--driver` to the cwd the way `driver-watchdog.mjs` does; `validate` leaves it NULL, so
  // the read-only verb genuinely reads no checkout rather than producing a promotion refusal about whichever
  // directory the operator happened to be standing in.
  const named = typeof flags.driver === 'string' ? resolve(flags.driver) : null;
  const driver = verb === 'promote' ? (named ?? resolve(process.cwd())) : named;
  if (verb === 'promote' && !existsSync(join(driver, '.git'))) {
    stderr(`validate-and-promote: ${driver} has no .git — that is not a driver checkout\n`);
    return 1;
  }

  const result = run({
    driver,
    sha,
    source,
    full: flags.full === true,
    keep: flags.keep === true,
    // `validate` NEVER promotes, and that promise does not rest on one flag: it takes the dry-run path AND is
    // handed a promoter that throws if anything ever reaches it. Same belt-and-braces `driver-watchdog.mjs`'s
    // read-only `check` verb uses.
    dryRun: verb === 'validate' || flags['dry-run'] === true,
    ...(verb === 'validate' ? { promote: () => { throw new Error('validate-and-promote: `validate` never promotes'); } } : {}),
  });

  if (flags.json) stdout(JSON.stringify(result) + '\n');
  else {
    const checks = (result.validation?.checks ?? []).map((c) => `  ${c.ok ? '✓' : '✗'} ${c.name}: ${c.detail}`).join('\n');
    const failed = (result.verdict?.failed ?? []).filter((f) => f.output)
      .map((f) => `\n  ── ${f.name} output (last ${OUTPUT_TAIL_LINES} lines) ──\n${f.output.split('\n').map((l) => `  ${l}`).join('\n')}`).join('\n');
    stdout(`validate-and-promote [${result.action ?? 'unresolved'}] ${result.driver ?? '(no driver — validate only)'}\n`
      + `  candidate: ${result.target ?? '(unresolved)'}\n`
      + (checks ? `${checks}\n` : '')
      + `  ${result.verdict?.reason ?? ''}\n`
      + `  ${result.decision?.reason ?? ''}\n`
      + (result.promotion?.error ? `  ${result.promotion.error}\n` : '')
      + (result.scratch ? `  scratch: ${result.scratch.kept ? `KEPT at ${result.scratch.dir} (${result.scratch.reason})` : 'removed'}\n` : '')
      + failed + (failed ? '\n' : ''));
  }

  if (!result.verdict?.validated) return 2;
  if (verb === 'promote' && result.action !== 'promoted' && result.action !== 'no-op' && result.action !== 'dry-run') return 2;
  return 0;
}

const IS_CLI = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (IS_CLI) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (e) { process.stderr.write(`validate-and-promote: ${String((e && e.stack) || e)}\n`); process.exitCode = 1; }
}
