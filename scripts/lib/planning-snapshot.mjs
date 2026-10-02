/** A private, single-planning-round snapshot of successful read-only collector results.
 * The owner creates/removes the directory. Never pass this environment into a launch or reuse next round.
 * Failed reads are not cached: callers retain their existing fail-closed/degraded behavior.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { basename, join } from 'node:path';
export const PLANNING_SNAPSHOT_ENV = 'WE_PLANNING_SNAPSHOT_DIR';

export function planningRead(args, read, { env = process.env } = {}) {
  const [script, ...flags] = args;
  const name = basename(script ?? '');
  const eligible = (name === 'lane-pool.mjs' && ['status', 'list'].includes(flags[0]))
    || (name === 'backlog.mjs' && flags[0] === 'build-queue')
    || (name === 'scope-lease-collect.mjs' && flags.includes('--no-track-attempts'));
  const dir = env[PLANNING_SNAPSHOT_ENV];
  if (!dir || !eligible) return read();
  const key = createHash('sha256').update(JSON.stringify([script, ...flags])).digest('hex');
  const path = join(dir, key + '.json');
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { /* first observation */ }
  const save = value => {
    // Only parsed, successful JSON reaches here. Cache failure affects performance, not decisions.
    try {
      const tmp = `${path}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(value));
      renameSync(tmp, path);
    } catch { /* use the real read */ }
    return value;
  };
  const value = read();
  return value && typeof value.then === 'function' ? value.then(save) : save(value);
}
