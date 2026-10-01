// @vitest-environment node
import { it, expect } from 'vitest';
import { bootstrapRepos } from '../bootstrap.mjs';
import { createEventLog, createMemoryStorage, handleRequest, validateBootstrap } from '../core.mjs';
const options = { url: 'https://local', repos: ['o/r', 'o/s'], importId: 'attempt', readToken: 'read', bootstrapToken: 'write' };
function harness() {
  const log = createEventLog(createMemoryStorage());
  const env = { PR_EVENTS_READ_TOKEN: 'read', PR_EVENTS_BOOTSTRAP_TOKEN: 'write' };
  const fetchImpl = (url, init) => handleRequest(new Request(url, init), env, { getLog: () => log });
  return { log, fetchImpl };
}
const row = { number: 1, headRefOid: 'a', isDraft: false, labels: [{ name: 'one' }], state: 'OPEN', title: 'SECRET' };
it('lists exactly once per repo, strips noncompact fields and records saturated coverage', async () => {
  const h = harness(), calls = [];
  await bootstrapRepos({ ...options, ...h, limit: 1, run: (cmd, args) => { calls.push([cmd, args]); return JSON.stringify([row]); } });
  expect(calls).toEqual(options.repos.map((repo) => ['gh', ['pr', 'list', '--repo', repo, '--state', 'open', '--limit', '1', '--json', 'number,headRefOid,isDraft,labels,state']]));
  expect(h.log.readPrs().coverage.bootstrap.map((s) => s.status)).toEqual(['truncated', 'truncated']);
  expect(JSON.stringify(h.log.readPrs())).not.toContain('SECRET');
  expect(h.log.readPrs().prs).toHaveLength(2);
});
it('records command failures and permits deliberate retries with a new import ID', async () => {
  const h = harness();
  await expect(bootstrapRepos({ ...options, ...h, run: () => { throw new Error('gh failed'); } })).rejects.toThrow('incomplete coverage recorded');
  expect(h.log.readPrs().coverage.bootstrap).toMatchObject([{ status: 'failed' }]);
  await bootstrapRepos({ ...options, ...h, importId: 'retry', run: () => '[]' });
  expect(h.log.readPrs().coverage.bootstrap.map((s) => s.status)).toEqual(['complete', 'complete']);
  await expect(bootstrapRepos({ ...options, ...h, bootstrapToken: 'read', run: () => '[]' })).rejects.toThrow('HTTP 401');
  await expect(bootstrapRepos({ ...options, ...h, readToken: 'bad', run: () => { throw new Error('must not list'); } })).rejects.toThrow('cursor read failed');
});
it('validates repo identity and compact fields; idempotency survives pruning and conflicts reject atomically', () => {
  const h = harness();
  const input = { repo: 'o/r', importId: 'seed', baseCursor: 0, status: 'complete', prs: [{ number: 1, sha: 'a', draft: false, labels: [], state: 'open' }] };
  for (const invalid of [{ ...input, repo: '../wrong' }, { ...input, baseCursor: -1 }, { ...input, prs: [{ ...input.prs[0], draft: null }] }, { ...input, prs: [input.prs[0], input.prs[0]] }]) expect(() => validateBootstrap(invalid)).toThrow();
  expect(h.log.bootstrap(input)).toMatchObject({ cursor: 0, duplicate: false });
  expect(h.log.bootstrap(input)).toMatchObject({ cursor: 0, duplicate: true });
  expect(() => h.log.bootstrap({ ...input, baseCursor: 1 })).toThrow('conflict');
  expect(() => h.log.bootstrap({ ...input, importId: 'future', baseCursor: 9 })).toThrow('future');
  expect(h.log.readPrs().stateCursor).toBe(0);
});
it('field clocks preserve concurrent head, close and labels while filling unobserved fields', async () => {
  const h = harness();
  await bootstrapRepos({ ...options, ...h, repos: ['o/r'], run: () => {
    h.log.append({ repo: 'o/r', prs: [1], type: 'pull_request', action: 'synchronize', sha: 'new' });
    h.log.append({ repo: 'o/r', prs: [1], type: 'pull_request', action: 'labeled', label: 'new-label' });
    h.log.append({ repo: 'o/r', prs: [1], type: 'pull_request', action: 'closed', merged: false });
    return JSON.stringify([row]);
  } });
  expect(h.log.readPrs().prs[0]).toMatchObject({ sha: 'new', state: 'closed', merged: false, labels: null, labelChanges: { 'new-label': true }, draft: false });
});
const seed = { repo: 'o/r', importId: 'seed', baseCursor: 0, status: 'complete', prs: [{ number: 1, sha: 'a', draft: false, labels: [], state: 'open' }] };
it('never opens a storage transaction inside another one (Durable Object transactionSync cannot nest)', () => {
  const storage = createMemoryStorage(), open = storage.transaction;
  let depth = 0;
  storage.transaction = (fn) => { if (depth) throw new Error('nested storage transaction'); depth++; try { return open(fn); } finally { depth--; } };
  const log = createEventLog(storage);
  expect(log.bootstrap(seed)).toMatchObject({ duplicate: false });
  expect(log.readPrs().prs).toHaveLength(1);
});
it('seeds the projection without touching the replay ring or the feed-health clocks', () => {
  const log = createEventLog(createMemoryStorage());
  log.append({ repo: 'o/r', prs: [2], type: 'pull_request', action: 'opened', sha: 'x' }, 1000);
  const before = log.read(0);
  log.bootstrap({ ...seed, baseCursor: 1 }, 5000);
  expect(log.read(0)).toEqual(before);
  expect(log.read(0)).toMatchObject({ head: 1, lastEventAt: 1000, lastDeliveryAt: 1000 });
  expect(log.readPrs().prs.map((p) => p.number).sort()).toEqual([1, 2]);
});
it('unifies bootstrap and webhook repository casing', () => {
  const log = createEventLog(createMemoryStorage());
  log.bootstrap({ ...seed, repo: 'Owner/Repo' });
  log.append({ repo: 'owner/repo', prs: [1], type: 'pull_request', action: 'closed', merged: true, sha: 'a' });
  const { prs } = log.readPrs();
  expect(prs).toHaveLength(1);
  expect(prs[0]).toMatchObject({ repo: 'owner/repo', number: 1, state: 'closed', merged: true });
});
