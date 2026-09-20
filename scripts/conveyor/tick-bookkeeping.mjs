/** #3383 — Persist tick-core's own history unchanged so a new driver cannot forget guards or retry budgets. */
import * as nativeFs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { coordinationPaths, resolveCoordinationRoot } from '../operations/coordination-root.mjs';
import { milliseconds, actionResource, normalizeRepo } from '../operations/action-record.mjs';
export const BOOKKEEPING_FIELDS = ['tick', 'buildGuards', 'prepareGuards', 'fixGuards', 'fixAttempts', 'ciHealGuards', 'ciHealAttempts', 'watched', 'launchedNums', 'heldStall'];
/** Pure projection: reject damaged history instead of silently normalizing it away. */
export function projectBookkeeping(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new TypeError('Invalid bookkeeping');
  const result = {};
  for (const key of BOOKKEEPING_FIELDS) {
    if (state[key] === undefined) continue;
    const value = state[key];
    const array = key.endsWith('Guards') || ['watched', 'launchedNums'].includes(key);
    if (key === 'tick' ? !Number.isInteger(value) || value < 0
      : array ? !Array.isArray(value) : !value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Invalid bookkeeping ${key}`);
    if (key.endsWith('Guards') && value.some((g) => !g || typeof g !== 'object' || g.num === undefined)) throw new TypeError(`Invalid ${key}`);
    result[key] = value;
  }
  return result;
}
export function createTickBookkeeping({ root = resolveCoordinationRoot(), fs = nativeFs, now = Date.now, actions, repo = 'we', resourceForGuard } = {}) {
  const path = coordinationPaths(root).bookkeeping;
  const linkedAction = (list, guard, records) => {
    const resource = resourceForGuard?.(list, guard) ?? (['buildGuards', 'prepareGuards'].includes(list)
      ? actionResource(repo, { type: 'item', id: guard.num })
      : guard.pr ? actionResource(repo, { type: 'pr', id: guard.pr })
        : records.find((r) => r.repo === normalizeRepo(repo) && String(r.evidence?.num) === String(guard.num)
          && r.kind === (list === 'fixGuards' ? 'fix' : 'ci-heal'))?.resource);
    return records.filter((r) => r.resource === resource).sort((a, b) => b.attempt - a.attempt)[0];
  };
  const loadBookkeeping = () => {
    try {
      const body = JSON.parse(fs.readFileSync(path, 'utf8'));
      if (body.version !== 1 || !body.bookkeeping || typeof body.bookkeeping !== 'object' || Array.isArray(body.bookkeeping)
        || !body.guardMeta || typeof body.guardMeta !== 'object') throw new Error('Invalid bookkeeping version or shape');
      const records = actions?.list();
      const guardMeta = Object.fromEntries(Object.entries(body.guardMeta).map(([key, value]) => {
        if (!Number.isFinite(value.firstSeenAt)) throw new Error('Invalid guard metadata');
        const [list, num] = key.split(':');
        const guard = body.bookkeeping[list]?.find((g) => String(g.num) === num);
        const claimStatus = records && guard ? linkedAction(list, guard, records)?.state ?? 'none' : value.claimStatus;
        return [key, { ...value, claimStatus, spawnAgeMs: Math.max(0, milliseconds(now()) - value.firstSeenAt) }];
      }));
      return { ok: true, bookkeeping: projectBookkeeping(body.bookkeeping), guardMeta, fresh: false };
    } catch (error) {
      if (error.code === 'ENOENT') return { ok: true, bookkeeping: {}, guardMeta: {}, fresh: true };
      return { ok: false, error: `Bookkeeping unavailable at ${path}: ${error.message}` };
    }
  };
  const saveBookkeeping = ({ nextState, driverId, tickId, now: saveNow = now, guardMeta = {} }) => {
    const previous = loadBookkeeping();
    if (!previous.ok) throw new Error(previous.error);
    const at = milliseconds(typeof saveNow === 'function' ? saveNow() : saveNow);
    const bookkeeping = projectBookkeeping(nextState);
    const records = actions?.list() ?? [];
    const sidecar = {};
    for (const list of ['buildGuards', 'prepareGuards', 'fixGuards', 'ciHealGuards']) {
      for (const guard of nextState[list] ?? []) {
        const key = `${list}:${guard.num}`;
        const prior = previous.guardMeta[key] ?? guardMeta[key];
        // Fix guards are item-keyed in tick-core. Their PR identity must come from the caller's mapping;
        // never mistake the item's number for a PR number.
        const record = linkedAction(list, guard, records);
        sidecar[key] = { firstSeenAt: prior?.firstSeenAt ?? at, claimStatus: record?.state ?? 'none' };
      }
    }
    const body = { version: 1, savedAt: at, savedBy: driverId, tickId, bookkeeping, guardMeta: sidecar };
    fs.mkdirSync(root, { recursive: true });
    const tmp = `${path}.${randomUUID()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(body)); fs.renameSync(tmp, path);
    return body;
  };
  return { loadBookkeeping, saveBookkeeping };
}
export function loadBookkeeping(options) { return createTickBookkeeping(options).loadBookkeeping(); }
export function saveBookkeeping(options) { return createTickBookkeeping(options).saveBookkeeping(options); }
