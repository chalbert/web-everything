/**
 * @file scripts/conveyor/queue-target.mjs
 * @description WE #3478 — resolves which checkout's `.conveyor/queue.json` sidecar the LIVE conveyor
 *   runner (its singleton lease, {@link ../../skills-src/conveyor/runner-lock.mjs}, #2702) is actually
 *   rooted in. `queue.mjs`'s `resolveQueuePath` ties the sidecar to the SCRIPT's own checkout, not to
 *   whichever checkout the live runner process happens to be running from — so `queue.mjs add` run from a
 *   DIFFERENT checkout than the live runner silently clears an item in a sidecar nobody reads (caught live,
 *   #3478). This module answers "which checkout is the live runner actually in?" so a caller (here,
 *   {@link ./queue-work.mjs}) can write into THAT checkout's sidecar instead of guessing from its own cwd.
 *
 * METHOD: read the runner-singleton lock dir(s) under the lock root, keep only entries whose lease is still
 *   LIVE (not stale), require exactly one, then shell `lsof -a -p <pid> -d cwd -Fn` to derive that process's
 *   real working directory (confirmed live, #3478's own incident write-up). Any ambiguity — no live lock, more
 *   than one, no recorded pid, or an unresolvable cwd — is a REFUSAL (`ok:false`, a `reason`), never a guess.
 *
 * PURE-CORE / IO-SHELL SPLIT (mirrors queue-store.mjs, #2613): {@link liveRunnerLockEntries} and
 *   {@link resolveRunnerLockVerdict} and {@link parseLsofCwd} take plain values and do no fs/process work, so
 *   the classification logic is unit-tested without a real lock dir or a real `lsof`. {@link readRawLockEntries}
 *   and {@link resolvePidCwd} are the thin impure shell; {@link resolveLiveRunnerCwd} wires the two together and
 *   accepts injected `lockRoot`/`nowMs`/`lsof` for a fully offline end-to-end test.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { parseLockEntry, isLeaseExpired } from '../readiness/file-locks.mjs';
import { RUNNER_LOCK_ROOT, RUNNER_LEASE_MINUTES } from '../../skills-src/conveyor/runner-lock.mjs';

/** `CONVEYOR_RUNNER_LOCK_ROOT` overrides the lock root (tests / an out-of-tree fixture); otherwise the real,
 *  machine-global runner-lock home ({@link RUNNER_LOCK_ROOT}). */
export function defaultLockRoot() {
  const env = process.env.CONVEYOR_RUNNER_LOCK_ROOT;
  return env && env.trim() ? env.trim() : RUNNER_LOCK_ROOT;
}

// ── PURE CORE (no fs / process — every input is injected) ──────────────────────────────────────────────

/**
 * Filter raw `{dir, text}` lock-dir reads down to the LIVE ones at `nowMs` — parseable AND lease not expired.
 * A corrupt or unparseable entry is dropped silently (mirrors {@link parseLockEntry}'s own tolerance: a torn
 * lock file must never wedge the read, only fail to count as live). Pure.
 * @param {Array<{dir:string, text:string}>} rawEntries
 * @param {number} nowMs
 * @param {number} [leaseMinutes]
 * @returns {Array<{dir:string, owner:string, pid:(number|null), heartbeatAt:string}>}
 */
export function liveRunnerLockEntries(rawEntries, nowMs, leaseMinutes = RUNNER_LEASE_MINUTES) {
  const out = [];
  for (const { dir, text } of Array.isArray(rawEntries) ? rawEntries : []) {
    const entry = parseLockEntry(text);
    if (!entry) continue;
    if (isLeaseExpired(entry, nowMs, leaseMinutes)) continue;
    out.push({ dir, ...entry });
  }
  return out;
}

/**
 * Classify a set of LIVE lock entries into a resolution verdict. Zero ⇒ no runner running right now;
 * more than one ⇒ genuinely ambiguous (never guess which is "the" runner); exactly one but no recorded `pid`
 * ⇒ can't derive a cwd from it. Pure.
 * @param {Array<{dir:string, owner:string, pid:(number|null)}>} liveEntries
 * @returns {{ok:true, pid:number, owner:string}|{ok:false, reason:string, candidates?:Array}}
 */
export function resolveRunnerLockVerdict(liveEntries) {
  const entries = Array.isArray(liveEntries) ? liveEntries : [];
  if (entries.length === 0) return { ok: false, reason: 'no-live-runner' };
  if (entries.length > 1) return { ok: false, reason: 'ambiguous-runner-lock', candidates: entries };
  const [entry] = entries;
  if (!Number.isInteger(entry.pid) || entry.pid <= 0) return { ok: false, reason: 'no-pid-recorded', candidate: entry };
  return { ok: true, pid: entry.pid, owner: entry.owner };
}

/**
 * Extract the cwd path from `lsof -a -p <pid> -d cwd -Fn` output — a `n`-prefixed field line per open fd,
 * exactly one for `-d cwd`. Returns `null` when no such line is present (pid gone / lsof produced nothing).
 * Pure string parsing.
 * @param {string} stdout
 * @returns {string|null}
 */
export function parseLsofCwd(stdout) {
  for (const line of String(stdout || '').split('\n')) {
    if (line.startsWith('n') && line.length > 1) return line.slice(1);
  }
  return null;
}

// ── IO SHELL (impure — fs / child_process) ──────────────────────────────────────────────────────────────

/** Read every lock dir under `lockRoot` as raw `{dir, text}` pairs (unparsed) — never throws on a missing
 *  root or an individual unreadable entry (skipped, not fatal). */
export function readRawLockEntries(lockRoot = defaultLockRoot()) {
  if (!existsSync(lockRoot)) return [];
  let names;
  try { names = readdirSync(lockRoot); } catch { return []; } // unreadable root (perms, raced away) — degrade, never throw
  const out = [];
  for (const name of names) {
    const file = join(lockRoot, name, 'lock.json');
    if (!existsSync(file)) continue;
    try { out.push({ dir: name, text: readFileSync(file, 'utf8') }); } catch { /* unreadable — skip */ }
  }
  return out;
}

/** Shell `lsof` to derive `pid`'s current working directory, or `null` if it can't be resolved (pid dead,
 *  `lsof` missing, permission denied — any failure degrades to null, never throws). */
export function resolvePidCwd(pid) {
  try {
    const out = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    return parseLsofCwd(out);
  } catch { return null; }
}

/**
 * The end-to-end resolution a caller actually wants: which checkout is the LIVE conveyor runner rooted in
 * right now? `ok:true` ⇒ `cwd` is that checkout's absolute path. `ok:false` ⇒ refuse — `reason` names why
 * (`no-live-runner` / `ambiguous-runner-lock` / `no-pid-recorded` / `runner-cwd-unresolvable`), never a guess.
 * @param {{lockRoot?:string, nowMs?:number, lsof?:(pid:number)=>(string|null)}} [opts]
 */
export function resolveLiveRunnerCwd({ lockRoot = defaultLockRoot(), nowMs = Date.now(), lsof = resolvePidCwd } = {}) {
  const raw = readRawLockEntries(lockRoot);
  const live = liveRunnerLockEntries(raw, nowMs);
  const verdict = resolveRunnerLockVerdict(live);
  if (!verdict.ok) return verdict;
  const cwd = lsof(verdict.pid);
  if (!cwd) return { ok: false, reason: 'runner-cwd-unresolvable', pid: verdict.pid };
  return { ok: true, pid: verdict.pid, owner: verdict.owner, cwd };
}
