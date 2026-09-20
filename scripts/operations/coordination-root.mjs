/** #3383 — All checkouts coordinate through one operator-owned sidecar, never checkout-local state. */
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
export const COORDINATION_ROOT_ENV = 'WE_COORDINATION_ROOT';
export function resolveCoordinationRoot({ env = process.env, home = homedir() } = {}) {
  return resolve(env[COORDINATION_ROOT_ENV]?.trim() || join(home, 'workspace', '.operations', 'coordination'));
}
export function coordinationPaths(root = resolveCoordinationRoot()) {
  return { root, runs: join(root, 'runs'), actions: join(root, 'actions'),
    tickMutex: join(root, 'tick-mutex'), bookkeeping: join(root, 'tick-bookkeeping.json'),
    status: join(root, 'status'), trace: join(root, 'trace') };
}
