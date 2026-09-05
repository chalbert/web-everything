#!/usr/bin/env node
/**
 * @file scripts/conveyor/queue-work.mjs
 * @description WE #3478 — resolves WHICH checkout's `.conveyor/queue.json` sidecar the LIVE conveyor
 *   runner actually reads before writing into one, instead of trusting the caller's own cwd/script
 *   location the way {@link ./queue.mjs} does. Caught live (2026-09-04): a session ran `queue.mjs add`
 *   three times from the primary checkout, each time printing a clean `✓ cleared`, while the real
 *   `skills-src/conveyor/runner.mjs` process was rooted in a completely different scratch clone — the
 *   three adds landed in a sidecar nobody was reading, with no signal anything was wrong.
 *
 * HOW IT RESOLVES THE LIVE CHECKOUT: reads the runner's singleton lease
 * ({@link ../../skills-src/conveyor/runner-lock.mjs}) — the SAME lock a live runner holds for its whole
 * lifetime — for the `pid` it recorded, then shells `lsof -a -p <pid> -d cwd -Fn` (the exact recipe the
 * #3478 incident confirmed works, and the one already load-bearing in `we:scripts/pr-status.mjs`'s lane
 * liveness probe) to find that pid's real working directory. It REFUSES rather than guesses whenever the
 * lease is absent, stale (the runner crashed), ambiguous (more lock entries than the one singleton key
 * expects), or its pid's cwd can't be resolved — never silently falling back to the caller's own cwd.
 *
 * Deliberately NOT a `queue.mjs` replacement: it reuses that file's pure core
 * ({@link ./queue-store.mjs}) for the actual add/remove/list, and leaves `queue.mjs` itself untouched —
 * a caller who already knows which checkout to target (or is doing a one-off queue edit with no live
 * runner) still has that door open. This is the checkout-aware entry point for everyone else.
 *
 * USAGE:
 *   node scripts/conveyor/queue-work.mjs add <NNN> [--json]
 *   node scripts/conveyor/queue-work.mjs remove <NNN> [--json]
 *   node scripts/conveyor/queue-work.mjs list [--json]
 *
 * Every verb resolves the live runner's checkout FIRST (including `list` — reading the wrong sidecar is
 * just as misleading as writing to one) and reports which checkout it targeted, so a caller can never
 * again walk away believing a `queue add` succeeded against a sidecar nobody is reading.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  RUNNER_LOCK_ROOT, RUNNER_LEASE_PATH, RUNNER_LEASE_MINUTES,
} from '../../skills-src/conveyor/runner-lock.mjs';
import { readLockEntry, isLeaseExpired, lockIdFor } from '../readiness/file-locks.mjs';
import {
  readQueueFile, writeQueueFile, addToQueue, removeFromQueue, queueHas,
} from './queue-store.mjs';
import { writeAllSync } from '../lib/write-all-sync.mjs';

const GRN = '\x1b[32m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const RST = '\x1b[0m';

// ── lock resolution (thin shell over the runner's own singleton-lease primitives) ──────────────────────────

/**
 * Read the runner-singleton lock dir and decide whether it names a LIVE runner. Never guesses: an absent
 * lease, a STALE one (heartbeat past the TTL — the runner crashed), an AMBIGUOUS lock root (more entries
 * than the one fixed sentinel key the runner ever reserves — {@link RUNNER_LEASE_PATH}), or a live entry
 * with no usable `pid` all return `ok:false` with a `reason` a caller can report verbatim.
 * @param {{lockRoot?:string, nowMs?:number, leaseMinutes?:number}} [opts]
 * @returns {{ok:boolean, reason?:string, pid?:number, owner?:string, heartbeatAt?:string, total?:number, detail?:string[]}}
 */
export function resolveLiveRunnerLock({
  lockRoot = RUNNER_LOCK_ROOT, nowMs = Date.now(), leaseMinutes = RUNNER_LEASE_MINUTES,
} = {}) {
  let entries = [];
  try { entries = readdirSync(lockRoot); } catch { entries = []; }
  const expectedId = lockIdFor(RUNNER_LEASE_PATH);
  const unexpected = entries.filter((e) => e !== expectedId);
  if (unexpected.length > 0) return { ok: false, reason: 'ambiguous', total: entries.length, detail: unexpected };

  const entry = readLockEntry(lockRoot, RUNNER_LEASE_PATH);
  if (!entry) return { ok: false, reason: 'absent' };
  if (isLeaseExpired(entry, nowMs, leaseMinutes)) {
    return { ok: false, reason: 'stale', owner: entry.owner, heartbeatAt: entry.heartbeatAt };
  }
  if (!Number.isInteger(entry.pid)) return { ok: false, reason: 'no-pid', owner: entry.owner };
  return { ok: true, pid: entry.pid, owner: entry.owner, heartbeatAt: entry.heartbeatAt };
}

/**
 * A `pid`'s current working directory via `lsof -a -p <pid> -d cwd -Fn` (the recipe confirmed live in the
 * #3478 incident, already relied on in `we:scripts/pr-status.mjs`'s lane-liveness probe). Fail-soft: a
 * missing/dead pid, or a host with no `lsof`, both resolve to `null` — never throws.
 * @param {number} pid
 * @returns {string|null}
 */
export function pidCwd(pid) {
  let out;
  try {
    out = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch { return null; }
  const line = out.split('\n').find((l) => l.startsWith('n'));
  return line ? line.slice(1) : null;
}

/**
 * The full resolution: a live runner lease → its pid → that pid's real cwd. `pidCwdFn` is injectable
 * (tests fake it instead of shelling a real `lsof`); everything else threads through
 * {@link resolveLiveRunnerLock}'s options. `ok:false, reason:'cwd-unresolved'` covers a live pid whose
 * cwd `lsof` could not report, or that no longer exists on disk (the pid was reused).
 * @param {{lockRoot?:string, nowMs?:number, leaseMinutes?:number, pidCwdFn?:(pid:number)=>string|null}} [opts]
 * @returns {{ok:boolean, reason?:string, cwd?:string, pid?:number, owner?:string, detail?:string[]}}
 */
export function resolveLiveRunnerCheckout(opts = {}) {
  const lock = resolveLiveRunnerLock(opts);
  if (!lock.ok) return lock;
  const cwd = (opts.pidCwdFn || pidCwd)(lock.pid);
  if (!cwd || !existsSync(cwd)) return { ok: false, reason: 'cwd-unresolved', pid: lock.pid, owner: lock.owner };
  return { ok: true, cwd, pid: lock.pid, owner: lock.owner };
}

const REFUSAL_MESSAGE = {
  absent: () => 'no live conveyor runner lock found — refusing to guess a checkout. Start the runner, or if you already know exactly which checkout to target, use queue.mjs there directly.',
  stale: (r) => `the conveyor runner lock is present but STALE (heartbeat ${r.heartbeatAt} is past the lease — the runner likely crashed) — refusing to queue into a checkout nobody is actively running from.`,
  ambiguous: (r) => `found ${r.total} lock entr${r.total === 1 ? 'y' : 'ies'} under the runner lock root (expected exactly one singleton lease), including ${r.detail.length} unexpected one${r.detail.length === 1 ? '' : 's'}: ${r.detail.join(', ')} — refusing to guess which is live.`,
  'no-pid': () => 'the live runner\'s lock entry has no pid recorded — cannot resolve its checkout.',
  'cwd-unresolved': (r) => `found a live runner lock (pid=${r.pid}) but could not resolve its working directory via \`lsof\` — is it installed, and is the pid still alive?`,
};

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────────────

function main(argv) {
  const args = argv.filter((a) => !a.startsWith('--'));
  const flags = new Set(argv.filter((a) => a.startsWith('--')).map((a) => a.slice(2)));
  const json = flags.has('json');
  const [action, rawNum] = args;
  const num = rawNum == null ? rawNum : String(rawNum).trim().replace(/^#+/, '').trim();

  const emit = (payload, human) => {
    writeAllSync(1, json ? JSON.stringify(payload) + '\n' : human + '\n');
    process.exit(0);
  };
  const fail = (payload, msg) => {
    if (json) writeAllSync(1, JSON.stringify({ ok: false, ...payload }) + '\n');
    else process.stderr.write(`${RED}✗${RST} ${msg}\n`);
    process.exit(1);
  };

  if (action !== 'add' && action !== 'remove' && action !== 'list') {
    fail({ error: 'usage' }, 'usage: queue-work.mjs {add|remove|list} <NNN> [--json]');
  }
  if (action !== 'list' && (num == null || !num)) {
    fail({ error: 'missing-id' }, `${action} needs an item id — e.g. queue-work.mjs ${action} 2613`);
  }

  const resolved = resolveLiveRunnerCheckout(
    process.env.CONVEYOR_RUNNER_LOCK_ROOT ? { lockRoot: process.env.CONVEYOR_RUNNER_LOCK_ROOT } : {},
  );
  if (!resolved.ok) {
    fail(
      { reason: resolved.reason, total: resolved.total ?? null, detail: resolved.detail ?? null },
      REFUSAL_MESSAGE[resolved.reason](resolved),
    );
  }

  const path = join(resolved.cwd, '.conveyor', 'queue.json');

  if (action === 'list') {
    const queue = readQueueFile(path);
    if (json) return emit({ ok: true, verb: 'queue-work', action: 'list', checkout: resolved.cwd, queue });
    if (queue.length === 0) return emit({ ok: true }, `${DIM}conveyor queue is empty ${RST}${DIM}(${resolved.cwd})${RST}`);
    const lines = queue
      .map((e) => `  ${GRN}✓${RST} #${e.num}${e.addedAt ? ` ${DIM}(cleared ${e.addedAt})${RST}` : ''}`)
      .join('\n');
    return emit({ ok: true }, `conveyor queue (${queue.length}) ${DIM}— live runner checkout ${resolved.cwd}${RST}\n${lines}`);
  }

  const before = readQueueFile(path);
  if (action === 'add') {
    const already = queueHas(before, num);
    const after = addToQueue(before, num, new Date().toISOString());
    if (!already) writeQueueFile(after, path);
    return emit(
      { ok: true, verb: 'queue-work', action: 'add', num, already, checkout: resolved.cwd, queue: after },
      already
        ? `${DIM}#${num} was already cleared — no change (${after.length} in queue)${RST}`
        : `${GRN}✓ cleared${RST} #${num} for the conveyor ${DIM}→ ${after.length} in queue (live runner checkout: ${resolved.cwd})${RST}`,
    );
  }

  // remove
  const had = queueHas(before, num);
  const after = removeFromQueue(before, num);
  if (had) writeQueueFile(after, path);
  return emit(
    { ok: true, verb: 'queue-work', action: 'remove', num, removed: had, checkout: resolved.cwd, queue: after },
    had
      ? `${GRN}✓ un-cleared${RST} #${num} ${DIM}→ ${after.length} in queue (live runner checkout: ${resolved.cwd})${RST}`
      : `${DIM}#${num} was not in the queue — no change${RST}`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
