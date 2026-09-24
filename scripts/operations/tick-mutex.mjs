/** #3383 — One short shared tick mutex complements durable actions; the runner singleton is separate. */
import { hostname } from 'node:os';
import { randomBytes } from 'node:crypto';
import { coordinationPaths, resolveCoordinationRoot } from './coordination-root.mjs';
import { tryLease } from './coordination-lock.mjs';
export const DRIVER_ID = `${hostname()}:${process.pid}:${randomBytes(3).toString('hex')}`;
export function tryAcquireTickMutex({ root = resolveCoordinationRoot(), owner = { driverId: DRIVER_ID, pid: process.pid, host: hostname() }, tickId,
  now = Date.now, staleMs = 3 * 60_000, maxHoldMs = 30 * 60_000, isPidAlive, fs, wait } = {}) {
  return tryLease({ path: coordinationPaths(root).tickMutex, owner: { ...owner, tickId }, now, staleMs, maxHoldMs, isPidAlive, fs, wait });
}
export async function withTickMutex(opts, fn) {
  const acquired = tryAcquireTickMutex(opts);
  if (!acquired.ok) return acquired;
  try { return await fn(acquired.handle); } finally { acquired.handle.release(); }
}
