#!/usr/bin/env node
/**
 * @file scripts/conveyor/branch-sync.mjs
 * @description The ACTIVE reconciliation loop for a scratch checkout that must keep advancing against
 *   `origin/<base>` (#3472) — the tested, bounded-retry-and-escalate replacement for an ad hoc bash sync loop.
 *
 * THE BUG THIS REPLACES. `~/workspace/wev-scratch-dispatcher-4` ran (confirmed LIVE, pid 24624, started
 *   2026-09-02, still running unchanged as of 2026-09-04 20:17 EDT — the incident this file fixes):
 *     bash -c 'while true; do sleep 180
 *       git fetch origin main:refs/remotes/origin/main-fresh --quiet
 *       if ! git merge origin/main-fresh --no-edit --quiet; then
 *         echo "$(date): merge conflict, aborting to keep tree clean" >> sync.log
 *         git merge --abort
 *       fi
 *     done'
 *   The fetch side worked (confirmed against the incident's own live `sync.log`); the merge side did not:
 *   the very first real conflict (in `skills-src/conveyor/runner.mjs` et al.) repeated, byte-for-byte
 *   identical, every 180s for hours — no retry policy beyond "try the same doomed merge again," no
 *   escalation past one line in a log nobody was tailing. The checkout drifted 53 commits behind while the
 *   loop kept reporting "fetch succeeded" as if nothing were wrong.
 *
 * THE FIX, in three parts:
 *   1. A pre-flight, WORKING-TREE-FREE conflict probe (`git merge-tree --write-tree` — the exact plumbing
 *      `branch-drift.mjs` (#3464) already uses for the same reason) decides whether a real merge would even
 *      succeed BEFORE attempting one. A known-conflicting tick never touches the index/working tree and never
 *      needs a `merge --abort` — strictly safer than the old loop's attempt-then-abort dance.
 *   2. On conflict, a BOUNDED exponential backoff — reusing {@link backoffMs}/{@link retryDecision} from
 *      `infra-blocked.mjs` (the SAME primitives the drain's infra-block retry already uses; not a
 *      reinvented formula) — retries a few times on the chance a later `origin/<base>` state no longer
 *      conflicts, then STOPS retrying at full cadence once the attempt cap is hit.
 *   3. Once capped, the loop ESCALATES instead of silently repeating: a durable JSON alert-state file
 *      (checkable by any tooling or a human, not just a tailed log — {@link DEFAULT_RENAG_MS}-deduped so it
 *      doesn't re-fire every tick), a best-effort macOS desktop notification (mirrors the unlanded
 *      `skills-src/conveyor/supervisor.mjs`'s own `notifyDesktop`, #3398), a loud banner in the human log, and
 *      a best-effort `branch-drift.mjs sweep` so the git-notes report `dispatch-plan.mjs` gates dispatch on is
 *      refreshed the moment a real conflict is found, not just on the next scheduled sweep. It keeps CHECKING
 *      every tick after that (a fetch is cheap and the conflict may resolve as `origin/<base>` evolves) and
 *      auto-clears + re-syncs the moment a clean merge becomes possible — this is "resolve automatically
 *      within a declared retry policy, or surface durably," never "give up forever silently."
 *
 * PURE-CORE / IO-SHELL SPLIT (mirrors `branch-drift.mjs` / `infra-blocked.mjs`): {@link conflictSignature} and
 *   {@link decideEscalation} take no fs/git/clock, so the escalation dedup/re-nag logic is unit-tested with
 *   plain objects. `backoffMs`/`retryDecision` (imported, not copied) are already proven in
 *   `infra-blocked.test.mjs`. The IO shell ({@link runSyncOnce}, the `once`/`loop` CLI) owns every git call and
 *   fs write, and is exercised in `branch-sync.test.mjs` against REAL throwaway git fixtures (mirrors
 *   `branch-drift.test.mjs`'s own `buildFixture`) — including the item's own Done-when shape: two branches
 *   whose commits are each individually in-scope but collide once merged, run through several real ticks.
 */

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync, appendFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { backoffMs, retryDecision } from './infra-blocked.mjs';
import { parseLeftRightCount } from './branch-drift.mjs';

// ── TUNING (exported so a caller/test can override) ────────────────────────────────────────────────────────

/** Backoff base after the FIRST conflicting attempt (1 min) — a conflict rarely resolves itself in seconds,
 *  so this starts slower than `infra-blocked.mjs`'s 30s (a different failure class — outside-dependency
 *  outages, which often clear within seconds). */
export const DEFAULT_BASE_MS = 60_000;
export const DEFAULT_FACTOR = 2;
/** Ceiling of 20 min — long enough that a stuck loop stops hammering `git merge-tree` every tick, short
 *  enough that a resolved-upstream conflict is still picked back up well within a normal check-in cadence. */
export const DEFAULT_CAP_MS = 20 * 60_000;
/** After this many FAILED conflict attempts, stop growing the backoff and ESCALATE (the loop keeps polling —
 *  see the file header — it just stops treating each tick as a fresh "attempt" once nothing more is learned
 *  from repeating it). */
export const DEFAULT_MAX_ATTEMPTS = 5;
/** How long a still-standing (same-conflict) escalation stays quiet before re-nagging — 30 min, the same
 *  value the unlanded `supervisor.mjs`'s own `ALERT_RENAG_MS` uses for the identical reason (#3398): don't
 *  re-notify a still-stuck process every tick. */
export const DEFAULT_RENAG_MS = 30 * 60_000;
/** Default fetch target / local tracking-ref name — matches the incident loop's own naming so this is a
 *  drop-in replacement for it. */
export const DEFAULT_BASE = 'main';
export const DEFAULT_REF_NAME = 'main-fresh';

// ── PURE CORE (no fs / git / clock — every input is injected) ─────────────────────────────────────────────

/** A short, stable fingerprint of a conflict probe's output — used only to tell "the SAME conflict as last
 *  tick" from "something changed" for escalation dedup (never to identify which files conflicted; the human
 *  log line + the alert record carry that). Pure. Returns `null` for empty/blank input (nothing to fingerprint). */
export function conflictSignature(text) {
  const t = String(text ?? '').trim();
  if (!t) return null;
  return createHash('sha1').update(t).digest('hex').slice(0, 12);
}

/**
 * Decide whether a stuck conflict warrants firing the escalation THIS tick, given the last-persisted alert
 * (cross-restart de-dup — `lastAlert` is read from disk, not memory, because a restarted loop must not re-fire
 * on every relaunch). Fires on a CHANGED signature (a materially different conflict) or once the previous
 * alert has gone stale past `renagMs` (still the same conflict, but it's been quiet long enough to re-nag).
 * Mirrors the unlanded `supervisor.mjs`'s own `decideAlert` shape exactly (#3398) — same reasoning, applied to
 * a conflict signature instead of a health string. Pure.
 * @param {{signature?:(string|null), lastAlert?:(object|null), nowMs?:number, renagMs?:number}} o
 * @returns {{fire:boolean, record:(object|null)}}
 */
export function decideEscalation({ signature = null, lastAlert = null, nowMs = Date.now(), renagMs = DEFAULT_RENAG_MS } = {}) {
  if (!signature) return { fire: false, record: null };
  const prev = lastAlert && typeof lastAlert === 'object' ? lastAlert : null;
  const changed = !prev || prev.signature !== signature;
  const prevAtMs = prev ? Date.parse(prev.at) : NaN;
  const stale = !!prev && Number.isFinite(prevAtMs) && nowMs - prevAtMs >= renagMs;
  if (!(changed || stale)) return { fire: false, record: null };
  return { fire: true, record: { at: new Date(nowMs).toISOString(), signature } };
}

// ── IO SHELL (git / fs / notifications past this point) ────────────────────────────────────────────────────

const iso = (ms) => new Date(ms).toISOString();
const firstLine = (s) => String(s || '').split('\n').find((l) => l.trim()) || '';

/** Run a git command, never throwing — returns `{ok, stdout, stderr}`. The default `git` effect every IO
 *  function below takes, so tests can inject a fake. */
export function gitRun(args, cwd) {
  try {
    const stdout = execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, stdout, stderr: '' };
  } catch (e) {
    return { ok: false, stdout: e.stdout != null ? String(e.stdout) : '', stderr: e.stderr != null ? String(e.stderr) : String(e.message || e) };
  }
}

function loadJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}
function saveJson(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n');
}
function clearFile(path) {
  try { unlinkSync(path); } catch { /* already gone — fine */ }
}

/** Append one human-readable line to the log — best-effort (a logging failure must never break the loop). */
export function defaultAppendLog(logPath, line) {
  try { mkdirSync(dirname(logPath), { recursive: true }); appendFileSync(logPath, line + '\n'); }
  catch { /* observability only */ }
}

/** Wrap a string as a double-quoted AppleScript literal (same escaping as the unlanded `supervisor.mjs`'s `q`). */
function q(s) { return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`; }

/** Best-effort desktop notification (mirrors `supervisor.mjs`'s own `notifyDesktop`, #3398). macOS-only; a
 *  no-op elsewhere, and a spawn failure must never break the sync loop. */
export function notifyDesktop({ title, body }) {
  if (process.platform !== 'darwin') return;
  try { spawn('osascript', ['-e', `display notification ${q(body)} with title ${q(title)}`], { stdio: 'ignore', detached: true }).unref(); }
  catch { /* best-effort */ }
}

/** Best-effort refresh of the `branch-drift.mjs` git-notes report the moment a real conflict is found here —
 *  so `dispatch-plan.mjs`'s `branch-drift-blocked` hold reflects it immediately rather than waiting for the
 *  next scheduled sweep. Never throws; a missing/failing sweep must never break this loop. */
export function runDriftSweepBestEffort({ cwd, branch }) {
  try {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const driftCli = resolve(HERE, 'branch-drift.mjs');
    const args = [driftCli, 'sweep'];
    if (branch) args.push(`--branch=${branch}`);
    spawnSync(process.execPath, args, { cwd, stdio: 'ignore', timeout: 30_000 });
  } catch { /* best-effort only */ }
}

/**
 * One sync tick: fetch `origin/<base>`, and either merge cleanly, back off on a real conflict, or escalate
 * once the attempt cap is reached. Every effect is injected so this is fully testable without a real network
 * and (for the pure decision logic) without a real repo at all.
 * @param {object} o
 * @param {string} [o.cwd]              the checkout to sync (defaults to CWD)
 * @param {(args:string[], cwd:string)=>{ok:boolean,stdout:string,stderr:string}} [o.git]
 * @param {number} [o.now]              epoch ms (injected for determinism)
 * @param {string} [o.base]             the upstream branch to sync from (default `main`)
 * @param {string} [o.refName]          the local tracking-ref name the fetch writes to (default `main-fresh`)
 * @param {string} [o.statePath]        retry-state JSON path (default `<cwd>/.git/branch-sync-state.json`)
 * @param {string} [o.alertPath]        escalation-record JSON path (default `<cwd>/.git/branch-sync-alert.json`)
 * @param {string} [o.logPath]          human-readable log path (default `<cwd>/sync.log`)
 * @param {(e:{title:string,body:string})=>void} [o.notify]
 * @param {(logPath:string, line:string)=>void} [o.appendLog]
 * @param {number} [o.maxAttempts]
 * @param {{baseMs?:number, factor?:number, capMs?:number}} [o.backoff]
 * @param {number} [o.renagMs]
 * @param {(a:{cwd:string, branch?:string})=>void} [o.driftSweep]
 * @returns {{status:string, [k:string]:*}}
 */
export function runSyncOnce({
  cwd = process.cwd(),
  git = gitRun,
  now = Date.now(),
  base = DEFAULT_BASE,
  refName = DEFAULT_REF_NAME,
  statePath,
  alertPath,
  logPath,
  notify = notifyDesktop,
  appendLog = defaultAppendLog,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  backoff = {},
  renagMs = DEFAULT_RENAG_MS,
  driftSweep = runDriftSweepBestEffort,
} = {}) {
  const paths = {
    state: statePath || join(cwd, '.git', 'branch-sync-state.json'),
    alert: alertPath || join(cwd, '.git', 'branch-sync-alert.json'),
    log: logPath || join(cwd, 'sync.log'),
  };
  const log = (line) => appendLog(paths.log, line);
  const backoffCfg = { baseMs: DEFAULT_BASE_MS, factor: DEFAULT_FACTOR, capMs: DEFAULT_CAP_MS, ...backoff };

  // 1. fetch — best-effort. An explicit destination refspec (never a bare source) so the subsequent
  //    `origin/<refName>` reads are reliable regardless of the checkout's own fetch-refspec config (the SAME
  //    reasoning `branch-drift.mjs`'s own `computeDrift` gives for its destination refspecs).
  const fetched = git(['fetch', 'origin', `${base}:refs/remotes/origin/${refName}`, '--quiet'], cwd);
  if (!fetched.ok) {
    log(`${iso(now)} sync: fetch failed (offline or network issue) — skipping this tick: ${firstLine(fetched.stderr)}`);
    return { status: 'offline' };
  }

  // 2. is there anything to merge at all?
  const cmp = git(['rev-list', '--left-right', '--count', `HEAD...origin/${refName}`], cwd);
  const { behind, ahead } = cmp.ok ? parseLeftRightCount(cmp.stdout) : { behind: 0, ahead: 0 };
  if (behind === 0) {
    // Up to date. Clear any stale conflict/escalation state — whatever drift it tracked is resolved (by this
    // loop's own earlier merge, or by HEAD advancing some other way).
    if (existsSync(paths.state) || existsSync(paths.alert)) {
      clearFile(paths.state);
      clearFile(paths.alert);
      log(`${iso(now)} sync: up to date with origin/${base} — cleared prior conflict/escalation state`);
    }
    return { status: 'fresh', ahead, behind };
  }

  // 3. pre-flight, WORKING-TREE-FREE conflict probe. Only a CLEAN result ever touches the working tree.
  const probe = git(['merge-tree', '--write-tree', 'HEAD', `origin/${refName}`], cwd);
  if (probe.ok) {
    const merge = git(['merge', `origin/${refName}`, '--no-edit', '--quiet'], cwd);
    if (merge.ok) {
      clearFile(paths.state);
      clearFile(paths.alert);
      log(`${iso(now)} sync: merged ${behind} commit(s) from origin/${base} cleanly`);
      return { status: 'synced', behind };
    }
    // Race: the dry-run probe said clean but the real merge disagreed (e.g. origin/<refName> moved between the
    // two calls). Abort defensively (this is the ONE path that can leave a MERGE_HEAD behind) and fall through
    // to the conflict handling below so the incident is tracked/retried like any other conflict.
    git(['merge', '--abort'], cwd);
    log(`${iso(now)} sync: dry-run probe reported clean but the real merge failed (${firstLine(merge.stderr)}) — treating as a conflict this tick`);
  }

  // 4. conflict path — bounded retry, then escalate. The working tree was never touched (unless the race above
  //    fired, which already aborted cleanly).
  const signature = conflictSignature(probe.ok ? '' : (probe.stdout || probe.stderr));
  let store = loadJson(paths.state);

  if (!store || typeof store !== 'object' || !Number.isFinite(Number(store.attempt))) {
    store = { attempt: 1, firstFailedAt: iso(now), lastAttemptAt: iso(now), nextRetryAt: iso(now + backoffMs(1, backoffCfg)), signature };
    saveJson(paths.state, store);
    log(`${iso(now)} sync: merge conflict detected, ${behind} commit(s) behind (attempt 1/${maxAttempts}) — next retry in ${Math.round(backoffMs(1, backoffCfg) / 1000)}s`);
    return { status: 'conflict', attempt: 1, behind };
  }

  const decision = retryDecision(store, { now, maxAttempts });

  if (decision.action === 'wait') {
    return { status: 'waiting', attempt: store.attempt, waitMs: decision.waitMs, behind };
  }

  if (decision.action === 'retry') {
    const attempt = store.attempt + 1;
    store = { ...store, attempt, lastAttemptAt: iso(now), nextRetryAt: iso(now + backoffMs(attempt, backoffCfg)), signature };
    saveJson(paths.state, store);
    log(`${iso(now)} sync: merge conflict persists, ${behind} commit(s) behind (attempt ${attempt}/${maxAttempts}) — retrying, next in ${Math.round(backoffMs(attempt, backoffCfg) / 1000)}s`);
    return { status: 'conflict', attempt, behind };
  }

  // decision.action === 'surface' — the attempt cap is hit. Stop growing the backoff; escalate (deduped).
  const lastAlert = loadJson(paths.alert);
  const escalation = decideEscalation({ signature, lastAlert, nowMs: now, renagMs });
  // Keep `attempt` frozen at the cap (never grows past maxAttempts) but refresh `lastAttemptAt` so the record
  // shows this is still being checked, not abandoned.
  saveJson(paths.state, { ...store, lastAttemptAt: iso(now), signature });
  if (escalation.fire) {
    saveJson(paths.alert, escalation.record);
    notify({
      title: 'wev sync loop stuck',
      body: `${basename(cwd)}: ${behind} commit(s) behind origin/${base}, merge conflict unresolved after ${store.attempt} attempt(s)`,
    });
    log(
      `${iso(now)} sync: ⚠ ESCALATED — ${behind} commit(s) behind origin/${base}, merge conflict unresolved after ` +
        `${store.attempt} attempt(s). Durable record: ${paths.alert}. A human/session should reconcile this checkout by hand. ` +
        `(still polling every tick — will auto-resync the moment origin/${base} no longer conflicts)`,
    );
    driftSweep({ cwd, branch: undefined });
  }
  return { status: 'escalated', attempt: store.attempt, alerted: escalation.fire, behind };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────────────────

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

function finiteOr(val, fallback) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function optionsFromFlags(flags, cwd) {
  return {
    cwd,
    base: typeof flags.base === 'string' ? flags.base : DEFAULT_BASE,
    refName: typeof flags['ref-name'] === 'string' ? flags['ref-name'] : DEFAULT_REF_NAME,
    statePath: typeof flags.state === 'string' ? flags.state : undefined,
    alertPath: typeof flags.alert === 'string' ? flags.alert : undefined,
    logPath: typeof flags.log === 'string' ? flags.log : undefined,
    maxAttempts: finiteOr(flags['max-attempts'], DEFAULT_MAX_ATTEMPTS),
    backoff: {
      baseMs: finiteOr(flags['base-ms'], DEFAULT_BASE_MS),
      factor: finiteOr(flags.factor, DEFAULT_FACTOR),
      capMs: finiteOr(flags['cap-ms'], DEFAULT_CAP_MS),
    },
    renagMs: finiteOr(flags['renag-ms'], DEFAULT_RENAG_MS),
  };
}

async function main(argv) {
  // A leading token that is itself a `--flag` means no verb was given at all (e.g. `branch-sync.mjs --json`) —
  // treat the whole argv as flags rather than misreading the flag as an unknown verb.
  let verb = argv[0];
  let rest = argv.slice(1);
  if (verb && verb.startsWith('--')) { rest = argv; verb = undefined; }
  const flags = parseFlags(rest);
  const cwd = typeof flags['repo-dir'] === 'string' && flags['repo-dir'] ? flags['repo-dir'] : process.cwd();
  const opts = optionsFromFlags(flags, cwd);

  if (!verb || verb === 'once') {
    const result = runSyncOnce(opts);
    if (flags.json) process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = 0;
    return;
  }

  if (verb === 'loop') {
    const intervalMs = finiteOr(flags['interval-ms'], 180_000);
    let stop = false;
    const onSignal = () => { stop = true; };
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);
    process.stderr.write(`branch-sync: loop starting (every ${Math.round(intervalMs / 1000)}s) against origin/${opts.base} in ${cwd}\n`);
    while (!stop) {
      try {
        runSyncOnce(opts);
      } catch (e) {
        // A tick must never take the whole loop down — the old bash loop's `if ! ...; then ...; fi` shape was
        // already this forgiving of a single failed command; keep that property.
        process.stderr.write(`branch-sync: tick error — ${String((e && e.stack) || e)}\n`);
      }
      if (stop) break;
      await sleep(intervalMs);
    }
    process.stderr.write('branch-sync: loop stopped\n');
    return;
  }

  process.stderr.write(`branch-sync: unknown verb "${verb}" (expected: once | loop)\n`);
  process.exitCode = 1;
}

const IS_CLI = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (IS_CLI) {
  main(process.argv.slice(2)).catch((e) => {
    process.stderr.write(`branch-sync: ${String((e && e.stack) || e)}\n`);
    process.exit(1);
  });
}
