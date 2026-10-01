/** Real CLI checks: one local snapshot, two background searches maximum, and durable verdict replay. */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { withFakeGh } from '../../conveyor/__tests__/helpers/fake-gh.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const PLAN_CLI = join(ROOT, 'scripts', 'readiness', 'dispatch-plan.mjs');

/** One fixture backlog item — frontmatter (JSON values are valid YAML) + a one-line body. */
function writeItem(dir, filename, frontmatter, title) {
  const fm = Object.entries(frontmatter).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
  writeFileSync(join(dir, filename), `---\n${fm}\n---\n\n# ${title}\n`, 'utf8');
}

/** The production fallback is now a metered GraphQL search, with the same PR inputs. */
const searchCalls = (fakeGh) => fakeGh.calls().filter((c) => c.argv[0] === 'api' && c.argv[1] === 'graphql');
function withAlreadyDoneHost(fixture) {
  const fakeGh = withFakeGh(fixture);
  writeFileSync(join(dirname(fakeGh.env.FAKE_GH_FIXTURE), 'gh'), `#!/usr/bin/env node
const { readFileSync, appendFileSync } = require('node:fs');
const argv = process.argv.slice(2);
appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify({ argv }) + '\\n');
if (argv[0] !== 'api' || argv[1] !== 'graphql' ||
    !argv.some(a => a.startsWith('query=') && a.includes('rateLimit { cost }') && a.includes('files(first:100)')) ||
    !argv.some(a => /^search=repo:fixture\\/dispatch is:pr is:merged [0-9]+ in:title$/.test(a)) ||
    argv[argv.indexOf('--jq') + 1] !== '[.data.search.nodes[] | .files = .files.nodes]') {
  process.stderr.write('fake-gh: unexpected already-done lookup');
  process.exitCode = 1;
} else {
  process.stdout.write(JSON.stringify(JSON.parse(readFileSync(process.env.FAKE_GH_FIXTURE, 'utf8')).prs));
}
`);
  // This suite measures call counts, not throttle pacing; isolate its budget from other tests.
  fakeGh.env.WE_GH_THROTTLE_LOCK_ROOT = join(dirname(fakeGh.env.FAKE_GH_FIXTURE), 'throttle');
  fakeGh.env.WE_GH_THROTTLE_POINTS_BUDGET_PER_MIN = '100000';
  // The conservative transport classifier treats api payloads as writes, even GraphQL queries.
  fakeGh.env.WE_GH_THROTTLE_WRITE_BUDGET_PER_MIN = '100000';
  return fakeGh;
}

const N_READY = 60; // ready, cleared, stale queue items
const N_NOT_READY = 10; // cleared-but-blocked (notReady) stale items — the OTHER stale-id population
const N_FILLER_PRS = 300; // unrelated PRs the fake `gh` already "knows about" — must not multiply the spawn count

function buildFixture({ completeHistory = false } = {}) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'dispatch-plan-bound-spawn-'));
  const backlogDir = join(fixtureRoot, 'backlog');
  mkdirSync(backlogDir, { recursive: true });
  const queueFile = join(fixtureRoot, 'queue.json');

  const cleared = [];
  // Ready, unblocked, disjoint-scope items — old enough (`dateOpened` far in the past) to clear
  // `ALREADY_DONE_AGE_GATE_MS` deterministically (never relying on the missing-date fallback).
  for (let i = 0; i < N_READY; i++) {
    const num = String(8000 + i);
    writeItem(backlogDir, `${num}-fixture-ready-${i}.md`, {
      bornAs: `x${num}fix`, kind: 'story', size: 1, status: 'open',
      scope: [`we:scripts/fixture-ready-${i}.mjs`], dateOpened: '2020-01-01', tags: [],
    }, `Ready fixture item ${i}`);
    cleared.push({ num, addedAt: new Date().toISOString() });
  }
  // Cleared-but-blocked items — land in `notReady` (a ready-queue row never exists for them), the SECOND
  // stale-id population `dispatch-plan.mjs` checks separately (`staleNotReadyIds`).
  for (let i = 0; i < N_NOT_READY; i++) {
    const num = String(8100 + i);
    writeItem(backlogDir, `${num}-fixture-blocked-${i}.md`, {
      bornAs: `x${num}fix`, kind: 'story', size: 1, status: 'open',
      scope: [`we:scripts/fixture-blocked-${i}.mjs`], blockedBy: ['9999'], dateOpened: '2020-01-01', tags: [],
    }, `Blocked fixture item ${i}`);
    cleared.push({ num, addedAt: new Date().toISOString() });
  }
  writeFileSync(queueFile, JSON.stringify(cleared, null, 2), 'utf8');

  const fillerPrs = Array.from({ length: N_FILLER_PRS }, (_, i) => ({
    number: 20000 + i, state: 'MERGED', headRefName: `lane/unrelated-${i}`,
    statusCheckRollup: [], labels: [], mergeStateStatus: 'CLEAN',
  }));

  const git = (...args) => execFileSync('git', args, { cwd: fixtureRoot, encoding: 'utf8', stdio: 'pipe' });
  git('init', '-b', 'main');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  git('add', 'backlog');
  git('commit', '-m', 'Create fixture items');
  // A local bare origin with a GitHub-shaped suffix exercises slug parsing and real fetches.
  const origin = join(fixtureRoot, 'github.com', 'fixture', 'dispatch');
  git('clone', '--bare', fixtureRoot, origin);
  git('remote', 'add', 'origin', origin);
  git('fetch', 'origin');
  if (!completeHistory) writeFileSync(join(fixtureRoot, '.git', 'shallow'), git('rev-parse', 'HEAD'));
  return { fixtureRoot, backlogDir, queueFile, fillerPrs };
}

async function waitRefresh(cacheFile) {
  const deadline = Date.now() + 20000;
  while (existsSync(`${cacheFile}.refresh-lock`)) {
    if (Date.now() > deadline) throw new Error('refresh did not settle');
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}
function fixtureRun(f, fakeGh, cacheFile, extra = [], extraEnv = {}) {
  return JSON.parse(execFileSync('node', [PLAN_CLI, '--json', `--backlog-dir=${f.backlogDir}`, '--free-lanes=1',
    '--no-drift-check', '--no-pause-check', '--no-pr-limit-check', ...extra], {
    cwd: f.fixtureRoot, timeout: 10000, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, ...fakeGh.env, CONVEYOR_QUEUE_FILE: f.queueFile,
      WE_DISPATCH_PLAN_ALREADY_DONE_CACHE_FILE: cacheFile, ...extraEnv },
  }));
}

describe('dispatch-plan bounded enrichment', () => {
  it('uses complete local history with zero GitHub calls and no network fetch', () => {
    const f = buildFixture({ completeHistory: true });
    const gh = withAlreadyDoneHost({ prs: [] });
    try {
      const plan = fixtureRun(f, gh, join(f.fixtureRoot, 'cache'));
      expect(plan.groundTruth.checkedLocally).toBe(N_READY + N_NOT_READY);
      expect(plan.groundTruth.pending).toBe(0);
      expect(gh.calls()).toEqual([]);
    } finally { gh.cleanup(); rmSync(f.fixtureRoot, { recursive: true, force: true }); }
  });
  it('cold queues refresh only two ids; later ticks rotate and respect cached verdicts', async () => {
    const f = buildFixture(); const gh = withAlreadyDoneHost({ prs: [] });
    const cacheFile = join(f.fixtureRoot, 'cache');
    try {
      const first = fixtureRun(f, gh, cacheFile);
      expect(first.groundTruth.pending).toBe(70);
      expect(first.groundTruth.refresh.ids).toHaveLength(2);
      await waitRefresh(cacheFile);
      expect(searchCalls(gh)).toHaveLength(2);
      const second = fixtureRun(f, gh, cacheFile);
      expect(second.groundTruth.cached).toBe(2);
      expect(second.groundTruth.refresh.ids.some(id => first.groundTruth.refresh.ids.includes(id))).toBe(false);
      await waitRefresh(cacheFile);
      expect(searchCalls(gh)).toHaveLength(4);
    } finally { await waitRefresh(cacheFile); gh.cleanup(); rmSync(f.fixtureRoot, { recursive: true, force: true }); }
  });
  it.each([['--no-already-done-cache'], []])('cache bypass/zero cooldown retain the two-check ceiling: %j', async extra => {
    const f = buildFixture(); const gh = withAlreadyDoneHost({ prs: [] }); const cacheFile = join(f.fixtureRoot, 'cache');
    try {
      for (let i = 0; i < 2; i++) {
        const plan = fixtureRun(f, gh, cacheFile, extra, { WE_DISPATCH_PLAN_ALREADY_DONE_NOT_DONE_COOLDOWN_MS: '0' });
        expect(plan.groundTruth.cached).toBe(0);
        expect(plan.groundTruth.refresh.ids).toHaveLength(2);
        await waitRefresh(cacheFile);
      }
      expect(searchCalls(gh)).toHaveLength(4);
    } finally { await waitRefresh(cacheFile); gh.cleanup(); rmSync(f.fixtureRoot, { recursive: true, force: true }); }
  });
  it('replays confirmed positives for ready AND not-ready rows without rechecking either', async () => {
    const f = buildFixture(); const gh = withAlreadyDoneHost({ prs: [] }); const cacheFile = join(f.fixtureRoot, 'cache');
    try {
      const pr = { number: 30000, url: 'https://github.com/fixture/dispatch/pull/30000' };
      writeFileSync(cacheFile, JSON.stringify({ items: Object.fromEntries(['8000', '8105'].map(id => [id, { done: true, pr, checkedAt: new Date().toISOString() }])) }));
      const plan = fixtureRun(f, gh, cacheFile);
      for (const id of ['8000', '8105']) expect(plan.held.find(h => String(h.num) === id)?.reason).toBe('already-done');
      expect(plan.held.find(h => String(h.num) === '8105').alreadyDonePr).toEqual(pr);
      expect(plan.groundTruth.refresh.ids).not.toContain('8000');
      expect(plan.groundTruth.refresh.ids).not.toContain('8105');
    } finally { await waitRefresh(cacheFile); gh.cleanup(); rmSync(f.fixtureRoot, { recursive: true, force: true }); }
  });
  it('unwritable cache exposes pending checks without crashing or doing inline network IO', () => {
    const f = buildFixture(); const gh = withAlreadyDoneHost({ prs: [] });
    try {
      const blocker = join(f.fixtureRoot, 'blocker'); writeFileSync(blocker, 'file');
      const plan = fixtureRun(f, gh, join(blocker, 'cache'));
      expect(plan.groundTruth.refresh.started).toBe(false);
      expect(plan.groundTruth.refresh.error).toBeTruthy();
      expect(plan.groundTruth.pending).toBe(70);
      expect(gh.calls()).toEqual([]);
    } finally { gh.cleanup(); rmSync(f.fixtureRoot, { recursive: true, force: true }); }
  });
});
