#!/usr/bin/env node
/**
 * @file scripts/conveyor/queue-work.mjs
 * @description Queue an item for the conveyor into the checkout the LIVE runner actually reads (WE #3478).
 *
 *   `queue.mjs`/`queue-store.mjs` (#2613) resolve `.conveyor/queue.json` by SCRIPT LOCATION — whichever
 *   checkout's copy of the CLI you invoke is the checkout you write into. A caller who `cd`s (or types a
 *   relative path) into the wrong checkout gets a clean, unconditional "✓ cleared" against a sidecar the
 *   live `we:skills-src/conveyor/runner.mjs` process never reads (see #3478's incident writeup: three items
 *   queued from the primary checkout while the real runner was rooted in an unrelated scratch clone).
 *
 *   This CLI instead resolves the target from the runner's own singleton lock
 *   ({@link ../../skills-src/conveyor/runner-lock.mjs}): it finds the live runner's pid, confirms that pid's
 *   command line still looks like the runner invocation (a fresh heartbeat proves someone held the lease
 *   recently — it does not prove pid `N` right now is still that same process, since an OS can reuse a
 *   crashed runner's pid inside the lease window; #3478 review, correctness+security findings), derives its
 *   actual working directory via `lsof` (the runner's documented launch convention is `node
 *   skills-src/conveyor/runner.mjs` from the checkout root, per `skills-src/conveyor/SKILL.md`, which is why
 *   its cwd doubles as its checkout root), and writes into THAT checkout's sidecar via the existing pure/IO
 *   core ({@link ./queue-store.mjs}) — reporting back which checkout it queued into so a caller can never
 *   again walk away believing an add landed somewhere the runner reads when it didn't. It REFUSES — rather
 *   than silently succeeding — when: no live runner lock is found (`no-lock`); the lock is stale (`stale`);
 *   more than one lock reads live at once (`ambiguous`); the live lock names no pid (`lock-missing-pid`); the
 *   live pid no longer looks like the runner (`pid-identity-mismatch`); its cwd can't be resolved
 *   (`cwd-unresolvable`); or the resolved cwd has no `.git` marker (`checkout-unverifiable`).
 *
 * USAGE:
 *   node scripts/conveyor/queue-work.mjs add <NNN> [--json]
 *   node scripts/conveyor/queue-work.mjs remove <NNN> [--json]
 *   node scripts/conveyor/queue-work.mjs list [--json]
 *
 * `CONVEYOR_RUNNER_LOCK_ROOT` overrides the lock-scan root (tests / an out-of-tree lock home); otherwise the
 * runner's real machine-global lock root ({@link RUNNER_LOCK_ROOT}) is used.
 *
 * PURE-CORE / IO-SHELL SPLIT: the decision logic ({@link classifyRunnerLocks}/{@link resolveQueueTarget}) is
 * pure and lives in {@link ./queue-work-core.mjs}, unit-tested directly; this file is the thin IO shell —
 * the lock-dir scan and the `lsof` probe — wired to the same `add`/`remove`/`list` shape as `queue.mjs`.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { parseLockEntry } from '../readiness/file-locks.mjs';
import { RUNNER_LOCK_ROOT } from '../../skills-src/conveyor/runner-lock.mjs';
import { readQueueFile, writeQueueFile, addToQueue, removeFromQueue, queueHas } from './queue-store.mjs';
import { classifyRunnerLocks, resolveQueueTarget, describeRefusal } from './queue-work-core.mjs';
import { writeAllSync } from '../lib/write-all-sync.mjs';

const GRN = '\x1b[32m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const RST = '\x1b[0m';

// ── IO SHELL ─────────────────────────────────────────────────────────────────

function lockRoot() {
  const env = process.env.CONVEYOR_RUNNER_LOCK_ROOT;
  return env && env.trim() ? env.trim() : RUNNER_LOCK_ROOT;
}

/** Every lock dir under the runner-lock root, each read as `{ dir, entry }` (`entry` null if the dir has no
 *  readable/valid `lock.json` — a corrupt lock must never wedge the scan). Fail-soft: a missing root reads
 *  as no locks at all, never an error. */
function scanLockEntries(root) {
  let names;
  try { names = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); }
  catch { return []; }
  return names.map((dir) => {
    const file = join(root, dir, 'lock.json');
    if (!existsSync(file)) return { dir, entry: null };
    try { return { dir, entry: parseLockEntry(readFileSync(file, 'utf8')) }; }
    catch { return { dir, entry: null }; }
  });
}

/** pid → its working directory via `lsof`, or null on any failure (dead pid, no `lsof`, no permission) —
 *  never throws (mirrors `we:scripts/pr-status.mjs`'s `sh()` fail-soft probe convention). */
function cwdForPid(pid) {
  let out;
  try {
    out = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch { return null; }
  const line = out.split('\n').find((l) => l.startsWith('n'));
  return line ? line.slice(1) : null;
}

/** pid → its full command line via `ps`, or '' on any failure. Never throws. */
function commandForPid(pid) {
  try {
    return execFileSync('ps', ['-o', 'command=', '-p', String(pid)], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch { return ''; }
}

/** Does `pid`'s command line still look like the conveyor runner invocation (#3478 review — a lease heartbeat
 *  proves someone held the lease recently, not that this pid, right now, is still that same process)? Matched
 *  on the runner's own repo-relative PATH (`skills-src/conveyor/runner.mjs`), not a bare `runner.mjs` — a loose
 *  match on the filename alone (#3478 review round 2) would pass for any process whose argv happens to contain
 *  that word, including one launched to deliberately spoof it; the fuller path is far harder to collide with by
 *  accident while still tolerant of the caller's exact invocation spelling (relative/absolute, `node` shebang). */
function isRunnerProcess(pid) {
  return /skills-src\/conveyor\/runner\.mjs/.test(commandForPid(pid));
}

/** Does `cwd` look like a real git checkout — cheaply, via a `.git` entry — rather than some arbitrary
 *  directory the runner process happened to be launched from (#3478 review round 2, correctness)? */
function looksLikeCheckout(cwd) {
  try { return existsSync(join(cwd, '.git')); } catch { return false; }
}

function resolveTargetNow() {
  return resolveQueueTarget(classifyRunnerLocks(scanLockEntries(lockRoot()), Date.now()), cwdForPid, isRunnerProcess, looksLikeCheckout);
}

function main(argv) {
  const args = argv.filter((a) => !a.startsWith('--'));
  const flags = new Set(argv.filter((a) => a.startsWith('--')).map((a) => a.slice(2)));
  const json = flags.has('json');
  const [action, rawNum] = args;
  const num = rawNum == null ? rawNum : String(rawNum).trim().replace(/^#+/, '').trim();

  const emit = (payload, human) => { writeAllSync(1, json ? JSON.stringify(payload) + '\n' : human + '\n'); process.exit(0); };
  const fail = (payload, msg) => {
    if (json) writeAllSync(1, JSON.stringify(payload) + '\n');
    else process.stderr.write(`${RED}✗${RST} ${msg}\n`);
    process.exit(1);
  };

  if (!['add', 'remove', 'list'].includes(action)) {
    return fail({ ok: false, error: 'bad-usage' }, 'usage: queue-work.mjs {add|remove|list} <NNN> [--json]');
  }
  if (action !== 'list' && (num == null || !num)) {
    return fail({ ok: false, error: 'missing-num' }, `${action} needs an item id — e.g. queue-work.mjs ${action} 2613`);
  }

  const target = resolveTargetNow();
  if (!target.ok) {
    const msg = describeRefusal(target);
    return fail({ ok: false, reason: target.reason, error: msg }, msg);
  }

  const path = join(target.checkoutRoot, '.conveyor', 'queue.json');
  const before = readQueueFile(path);
  const where = `resolved runner checkout: ${target.checkoutRoot}`;

  if (action === 'list') {
    return emit(
      { ok: true, verb: 'queue-work', action: 'list', checkoutRoot: target.checkoutRoot, queue: before },
      before.length === 0
        ? `${DIM}conveyor queue is empty${RST} ${DIM}(${where})${RST}`
        : `conveyor queue (${before.length}) ${DIM}— ${where}${RST}\n${before.map((e) => `  ${GRN}✓${RST} #${e.num}`).join('\n')}`,
    );
  }

  if (action === 'add') {
    const already = queueHas(before, num);
    const after = addToQueue(before, num, new Date().toISOString());
    if (!already) writeQueueFile(after, path);
    return emit(
      { ok: true, verb: 'queue-work', action: 'add', num, already, checkoutRoot: target.checkoutRoot, queue: after },
      already
        ? `${DIM}#${num} was already cleared — no change (${after.length} in queue, ${where})${RST}`
        : `${GRN}✓ cleared${RST} #${num} for the conveyor ${DIM}→ ${where} (${after.length} in queue)${RST}`,
    );
  }

  // remove
  const had = queueHas(before, num);
  const after = removeFromQueue(before, num);
  if (had) writeQueueFile(after, path);
  return emit(
    { ok: true, verb: 'queue-work', action: 'remove', num, removed: had, checkoutRoot: target.checkoutRoot, queue: after },
    had
      ? `${GRN}✓ un-cleared${RST} #${num} ${DIM}→ ${where} (${after.length} in queue)${RST}`
      : `${DIM}#${num} was not in the queue — no change (${where})${RST}`,
  );
}

main(process.argv.slice(2));
