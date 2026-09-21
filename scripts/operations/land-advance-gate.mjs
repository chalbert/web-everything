/**
 * @file land-advance-gate.mjs
 * Where land-advance reads its permission to act, and its single-flight lease (#3720).
 * CANONICAL CHECKOUT: the live runner's checkout (`resolve-runner-checkout`), else the primary checkout, never the
 * caller's own lane clone, whose empty `.conveyor/` would read "not paused" (dispatch-pause fails open on a missing
 * file). Both the pause marker (`.conveyor/dispatch-pause.json`, dispatch-pause's own path) and the operator opt-in
 * (`.conveyor/land-advance-opt-in.json`, `{ "prs": bool, "items": bool }`, written by the operator, never by this code)
 * are read there. A missing opt-in is no opt-in; an unreadable one is an error, which means plan only.
 * SINGLE FLIGHT: the file-locks TTL lease (the primitive runner-lock and drain-lock are built on), under its own
 * machine-global root so resolve-runner-checkout never mistakes it for a runner lock. One owner per call, so two
 * calls in one process contend too. A second caller exits `busy`; a crashed holder is reclaimed after the TTL.
 */
import * as fs from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir, hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { reserve, readLockEntry, releaseLockDir, isLeaseExpired } from '../readiness/file-locks.mjs';
import { readPauseState, pauseStorePath } from '../readiness/dispatch-pause.mjs';
import { resolveRunnerCheckout } from '../conveyor/resolve-runner-checkout.mjs';
import { primaryCheckout } from '../bootstrap-session.mjs';
import { CONSTELLATION_REPOS } from '../lib/constellation-repos.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const OPT_IN_FILE = 'land-advance-opt-in.json';
export const LAND_ADVANCE_LOCK_ROOT = join(homedir(), '.claude', 'land-advance-locks');
export const SINGLE_FLIGHT_PATH = '<land-advance:single-flight>';
export const SINGLE_FLIGHT_LEASE_MINUTES = 10;
export const optInPath = (root) => join(root, '.conveyor', OPT_IN_FILE);
/**
 * The primary checkouts that exist beside this one: every known `we` directory name under the workspace. More than
 * one (this laptop has both `web-everything` and `webeverything`) means "the primary" is ambiguous; the caller then
 * reads the first but may only plan (decideMode refuses dispatch) until the operator rules which one is canonical.
 */
export function primaryCandidates({ root = ROOT, exists = fs.existsSync, primary = primaryCheckout } = {}) {
  const workspace = dirname(primary(root));
  return (CONSTELLATION_REPOS.we?.dirs ?? []).map((d) => join(workspace, d)).filter((p) => exists(join(p, '.git')));
}
export function canonicalRoot({ resolveRunner = resolveRunnerCheckout, primary = null, candidates = () => primaryCandidates() } = {}) {
  let runner = null;
  try { runner = resolveRunner(); } catch { runner = null; }
  if (runner?.status === 'resolved' && runner.cwd) return { root: runner.cwd, source: 'runner' };
  if (primary) return { root: primary(), source: 'primary' };
  const found = candidates();
  if (found.length > 1) return { root: found[0], source: 'primary', ambiguous: found };
  return { root: found[0] ?? primaryCheckout(ROOT), source: 'primary' };
}
export function readGate(root, { fs: io = fs } = {}) {
  const pausePath = pauseStorePath(root), path = optInPath(root), pause = readPauseState(pausePath);
  let optIn = {}, error;
  try {
    const raw = JSON.parse(io.readFileSync(path, 'utf8'));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('expected an object');
    optIn = { prs: raw.prs === true, items: raw.items === true };
  } catch (e) { if (e.code !== 'ENOENT') error = `${path}: ${e.message ?? e}`; }
  return { root, pausePath, optInPath: path, paused: pause.paused === true, pause, optIn, ...(error ? { error } : {}) };
}
export const newOwner = () => `${hostname()}:${process.pid}:land-advance:${randomUUID()}`;
export function tryAcquireSingleFlight({ lockRoot = LAND_ADVANCE_LOCK_ROOT, owner = newOwner(), nowMs = Date.now(), pid = process.pid, leaseMinutes = SINGLE_FLIGHT_LEASE_MINUTES } = {}) {
  fs.mkdirSync(lockRoot, { recursive: true });
  return { ...reserve(lockRoot, SINGLE_FLIGHT_PATH, owner, nowMs, new Date(nowMs).toISOString(), pid, 'unknown', leaseMinutes), owner };
}
export function releaseSingleFlight({ lockRoot = LAND_ADVANCE_LOCK_ROOT, owner } = {}) {
  if (readLockEntry(lockRoot, SINGLE_FLIGHT_PATH)?.owner === owner) releaseLockDir(lockRoot, SINGLE_FLIGHT_PATH);
}
export function singleFlightHeld({ lockRoot = LAND_ADVANCE_LOCK_ROOT, nowMs = Date.now(), leaseMinutes = SINGLE_FLIGHT_LEASE_MINUTES } = {}) {
  const entry = readLockEntry(lockRoot, SINGLE_FLIGHT_PATH);
  return Boolean(entry) && !isLeaseExpired(entry, nowMs, leaseMinutes);
}
