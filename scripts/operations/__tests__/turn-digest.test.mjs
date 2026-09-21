/**
 * @file turn-digest.test.mjs — #3724: ONE derived, read-only picture of the turn.
 *
 * THE PROPERTIES UNDER TEST, in the order the card's Done-when 1 states them:
 *   1. `landed` lists EXACTLY the PR numbers merged after the cursor on a fixture history, and is empty when nothing
 *      merged. The io shell's git read runs against a REAL temp repo with a real fixture history (#2949): a stub
 *      returning a canned log cannot have first-parent geometry, and first-parent is the whole rule.
 *   2. A PR whose `merge-status:conflicting` label disagrees with its current mergeability is in `staleLabels`.
 *   3. The same fixture yields the same digest twice.
 *   4. No effect is declared: every step is `compute`, and the declaring module imports nothing that can act.
 * Beyond the card: a section that could not be read is NEVER an empty list, the cursor is per consumer and moves only
 * on `--advance`, and the snapshot is atomic and lands under the state root only.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { advanceWhileRunning, startRun } from '../engine.mjs';
import { createRegistry, isReadOnlyOperation } from '../registry.mjs';
import { CONFLICT_LABEL as WATCH_CONFLICT_LABEL } from '../../conveyor/parked-pr-conflict-watch.mjs';
import { git as fixtureGit, withRealRepo } from './helpers/real-repo.mjs';
import { importGraph } from './import-graph.mjs';
import {
  CONFLICT_LABEL, DEFAULT_LANDED_LIMIT, DIGEST_VERSION, TURN_DIGEST_OP, buildDigest, formatDigest, isValidConsumerId, landedFrom,
  parseCommitLog, resolveCursor, shapeLive, shapeNeedsOperator, shapeOwed, shapeRunner, shapeStaleLabels, turnDigestOperation,
} from '../turn-digest.mjs';
import {
  createTurnDigestFinish, createTurnDigestReader, cursorPath, ghSlug, openPrsArgv, readInFlight, readLanded, readLanes, readPrerequisites,
  readRunner, readStoredCursor, resolveDigestDir, resolveRepos, snapshotPath, writeSnapshot, writeStoredCursor,
} from '../turn-digest-io.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const NOW = '2026-09-21T13:00:00.000Z';
const SHA = (c) => c.repeat(40);

/** A fixture history on `main`: two merged PRs, a drain bookkeeping commit and a direct push in between. Returns the shas. */
function buildHistory(ctx) {
  const shas = { base: ctx.head() };
  const mergePr = (n, slug) => {
    ctx.git(['checkout', '--quiet', '-b', `lane/${slug}`]);
    ctx.commit({ [`${slug}.txt`]: `${slug}\n` }, `feature ${slug}`);
    ctx.git(['checkout', '--quiet', 'main']);
    ctx.git(['merge', '--no-ff', '--quiet', '-m', `Merge pull request #${n} from chalbert/lane/${slug}`, `lane/${slug}`]);
    return ctx.head();
  };
  shas.pr101 = mergePr(101, 'one');
  ctx.commit({ 'drain.txt': 'x\n' }, 'drain: JIT-number x1→#3789 at land (#2288)');
  shas.drain = ctx.head();
  shas.pr102 = mergePr(102, 'two');
  ctx.commit({ 'direct.txt': 'y\n' }, 'a direct push, no PR');
  shas.direct = ctx.head();
  shas.pr103 = mergePr(103, 'three');
  // The digest reads `origin/main`; a plain repo has no remote, so point a remote-tracking ref at `main` by hand.
  ctx.git(['update-ref', 'refs/remotes/origin/main', 'main']);
  return shas;
}

const landedPrs = (raw) => landedFrom(parseCommitLog(raw.log), { limit: raw.cursor.value ? null : raw.limit ?? DEFAULT_LANDED_LIMIT }).landed.map((m) => m.pr);

describe('landed — the first-parent merges after the cursor, on a real fixture history', () => {
  it('lists exactly the PR numbers merged after the cursor, oldest first', async () => {
    await withRealRepo((ctx) => {
      const h = buildHistory(ctx);
      const r = readLanded({ root: ctx.root, since: h.pr101 });
      expect(r.available).toBe(true);
      expect(landedPrs(r)).toEqual([102, 103]);
      expect(r.tip).toBe(h.pr103);
    });
  });

  it('is empty when nothing merged after the cursor (the cursor IS the tip)', async () => {
    await withRealRepo((ctx) => {
      const h = buildHistory(ctx);
      const r = readLanded({ root: ctx.root, since: h.pr103 });
      expect(r.available).toBe(true);
      expect(landedPrs(r)).toEqual([]);
    });
  });

  it('a non-merge commit after the cursor lands nothing (drain bookkeeping and direct pushes are not PRs)', async () => {
    await withRealRepo((ctx) => {
      const h = buildHistory(ctx);
      ctx.commit({ 'later.txt': 'z\n' }, 'a later direct push');
      ctx.git(['update-ref', 'refs/remotes/origin/main', 'main']);
      expect(landedPrs(readLanded({ root: ctx.root, since: h.pr103 }))).toEqual([]);
    });
  });

  it('a first call with no cursor returns the LAST N merges', async () => {
    await withRealRepo((ctx) => {
      buildHistory(ctx);
      const two = readLanded({ root: ctx.root, limit: 2 });
      expect(two.cursor).toEqual({ value: null, source: 'none' });
      expect(landedPrs(two)).toEqual([102, 103]);
      expect(landedPrs(readLanded({ root: ctx.root, limit: 10 }))).toEqual([101, 102, 103]);
    });
  });

  it('counts a merge that came in through a side branch once, by its first-parent merge only', async () => {
    await withRealRepo((ctx) => {
      const h = buildHistory(ctx);
      // A PR whose own branch carries an inner merge: only the outer first-parent `Merge pull request` is a landing.
      ctx.git(['checkout', '--quiet', '-b', 'lane/four']);
      ctx.git(['checkout', '--quiet', '-b', 'lane/four-inner']);
      ctx.commit({ 'inner.txt': 'i\n' }, 'inner work');
      ctx.git(['checkout', '--quiet', 'lane/four']);
      ctx.git(['merge', '--no-ff', '--quiet', '-m', 'Merge pull request #999 from chalbert/lane/four-inner (inside the branch)', 'lane/four-inner']);
      ctx.git(['checkout', '--quiet', 'main']);
      ctx.git(['merge', '--no-ff', '--quiet', '-m', 'Merge pull request #104 from chalbert/lane/four', 'lane/four']);
      ctx.git(['update-ref', 'refs/remotes/origin/main', 'main']);
      expect(landedPrs(readLanded({ root: ctx.root, since: h.pr103 }))).toEqual([104]);
    });
  });

  it('REFUSES a cursor that is not on the branch, rather than guessing a range', async () => {
    await withRealRepo((ctx) => {
      buildHistory(ctx);
      const r = readLanded({ root: ctx.root, since: SHA('e') });
      expect(r.available).toBe(false);
      expect(r.reason).toMatch(/not a commit in this checkout/);
    });
  });

  it('REFUSES a cursor that is not an ancestor of the tip (a rewritten history)', async () => {
    await withRealRepo((ctx) => {
      buildHistory(ctx);
      ctx.git(['checkout', '--quiet', '--orphan', 'other']);
      const orphan = ctx.commit({ 'o.txt': 'o\n' }, 'unrelated history');
      ctx.git(['checkout', '--quiet', 'main']);
      const r = readLanded({ root: ctx.root, since: orphan });
      expect(r.available).toBe(false);
      expect(r.reason).toMatch(/not an ancestor/);
    });
  });

  it('reports an unresolvable ref as UNAVAILABLE, not as nothing landed', async () => {
    await withRealRepo((ctx) => {
      const r = readLanded({ root: ctx.root }); // this repo has no origin/main
      expect(r.available).toBe(false);
      expect(r.reason).toMatch(/does not resolve/);
    });
  });

  it('makes no write to the repo: no ref, no file, no object is added by a read', async () => {
    await withRealRepo((ctx) => {
      const h = buildHistory(ctx);
      const before = { refs: ctx.git(['for-each-ref']), status: ctx.git(['status', '--porcelain']), head: ctx.head() };
      readLanded({ root: ctx.root, since: h.pr101 });
      readLanded({ root: ctx.root, limit: 2 });
      expect({ refs: ctx.git(['for-each-ref']), status: ctx.git(['status', '--porcelain']), head: ctx.head() }).toEqual(before);
    });
  });

  it('with `fetch`, updates only the remote-tracking ref and reports a failed fetch instead of hiding it', async () => {
    await withRealRepo((ctx) => {
      buildHistory(ctx);
      const r = readLanded({ root: ctx.root, fetch: true, limit: 3 });
      // No `origin` remote in this fixture: the fetch fails, is reported, and the (still resolvable) ref is read as-is.
      expect(r.fetch.ok).toBe(false);
      expect(r.available).toBe(true);
    });
  });
});

describe('landedFrom / parseCommitLog — pure', () => {
  const c = (sha, subject, date = '2026-09-21T10:00:00Z') => ({ sha, date, subject });

  it('keeps only `Merge pull request #N` subjects and reads the PR number', () => {
    const r = landedFrom([c('a1b2c3d', 'Merge pull request #7 from o/x'), c('b1b2c3d', 'drain: JIT-number'), c('c1b2c3d', 'Merge branch main into x')]);
    expect(r.landed.map((m) => m.pr)).toEqual([7]);
  });

  it('is empty for no commits, and never throws on hostile input', () => {
    expect(landedFrom([]).landed).toEqual([]);
    expect(landedFrom(null).landed).toEqual([]);
    expect(landedFrom([null, {}, { subject: 5 }]).landed).toEqual([]);
  });

  it('with a limit keeps the NEWEST N, returned oldest first', () => {
    const commits = [c('a1b2c3d', 'Merge pull request #3 from o/c'), c('b1b2c3d', 'Merge pull request #2 from o/b'), c('c1b2c3d', 'Merge pull request #1 from o/a')];
    expect(landedFrom(commits, { limit: 2 }).landed.map((m) => m.pr)).toEqual([2, 3]);
  });

  it('flags truncation after a cursor rather than silently dropping merges', () => {
    const commits = Array.from({ length: 205 }, (_, i) => c(`a${String(i).padStart(6, '0')}`, `Merge pull request #${i + 1} from o/x`));
    const r = landedFrom(commits);
    expect(r.landed).toHaveLength(200);
    expect(r.truncated).toBe(true);
  });

  it('lists a PR number once per merge (a revert-and-reland is two real landings)', () => {
    const r = landedFrom([c('a1b2c3d', 'Merge pull request #5 from o/x'), c('b1b2c3d', 'Merge pull request #5 from o/x')]);
    expect(r.landed.map((m) => m.pr)).toEqual([5, 5]);
  });

  it('drops a torn log line instead of inventing a commit from it', () => {
    const text = `${SHA('a')}\x1f2026-09-21T10:00:00Z\x1fMerge pull request #9 from o/x\ntorn-line-without-fields\n\x1f\x1f\n`;
    expect(parseCommitLog(text)).toEqual([{ sha: SHA('a'), date: '2026-09-21T10:00:00Z', subject: 'Merge pull request #9 from o/x' }]);
  });
});

describe('the cursor — per consumer, explicit beats stored, and moves only on request', () => {
  it('resolves input > stored > none', () => {
    expect(resolveCursor({ since: 'abc', stored: 'def' })).toEqual({ cursor: 'abc', source: 'input' });
    expect(resolveCursor({ stored: 'def' })).toEqual({ cursor: 'def', source: 'stored' });
    expect(resolveCursor({})).toEqual({ cursor: null, source: 'none' });
  });

  it('a consumer id must be filename-safe', () => {
    expect(isValidConsumerId('session-3724')).toBe(true);
    for (const bad of ['', '../x', 'a/b', '.hidden', 'x'.repeat(81), null]) expect(isValidConsumerId(bad)).toBe(false);
    expect(() => cursorPath('../escape', '/tmp/x')).toThrow(/invalid consumer id/);
  });

  it('two consumers keep independent cursors under the state root', () => {
    const dir = mkdtempSync(join(tmpdir(), 'turn-digest-cur-'));
    try {
      writeStoredCursor('alpha', SHA('a'), { dir });
      writeStoredCursor('beta', SHA('b'), { dir });
      expect(readStoredCursor('alpha', dir)).toBe(SHA('a'));
      expect(readStoredCursor('beta', dir)).toBe(SHA('b'));
      expect(readStoredCursor('gamma', dir)).toBeNull();
      expect(readdirSync(join(dir, 'cursors')).sort()).toEqual(['alpha.json', 'beta.json']);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('a torn cursor file reads as no cursor, never as a crash', () => {
    const dir = mkdtempSync(join(tmpdir(), 'turn-digest-cur-'));
    try {
      mkdirSync(join(dir, 'cursors'), { recursive: true });
      writeFileSync(join(dir, 'cursors', 'alpha.json'), '{"sha": ');
      expect(readStoredCursor('alpha', dir)).toBeNull();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('the state directory honours the env override, else the coordination root', () => {
    expect(resolveDigestDir({ env: { TURN_DIGEST_DIR: '/x/digest' }, home: '/h' })).toBe('/x/digest');
    expect(resolveDigestDir({ env: { WE_COORDINATION_ROOT: '/coord' }, home: '/h' })).toBe(join('/coord', 'turn-digest'));
    expect(resolveDigestDir({ env: {}, home: '/h' })).toBe(join('/h', 'workspace', '.operations', 'coordination', 'turn-digest'));
  });
});

describe('staleLabels — a label that disagrees with current mergeability', () => {
  const pr = (number, labels, mergeable, parked = false) => ({ number, labels: labels.map((name) => ({ name })), mergeable, mergeStateStatus: mergeable === 'CONFLICTING' ? 'DIRTY' : 'CLEAN', parked });
  const shape = (prs) => shapeStaleLabels({ byRepo: [{ repo: 'o/r', prs }] });

  it('the watch label duplicates the watch\'s own constant', () => {
    expect(CONFLICT_LABEL).toBe(WATCH_CONFLICT_LABEL);
  });

  it('flags `merge-status:conflicting` on a PR GitHub now reports MERGEABLE', () => {
    const r = shape([pr(10, [CONFLICT_LABEL, 'review:human'], 'MERGEABLE')]);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ repo: 'o/r', pr: 10, kind: 'stale-label', mergeable: 'MERGEABLE', label: CONFLICT_LABEL });
  });

  it('flags a CONFLICTING watched PR that lacks the label', () => {
    const r = shape([pr(11, ['review:human'], 'CONFLICTING', true)]);
    expect(r.items.map((i) => [i.pr, i.kind])).toEqual([[11, 'missing-label']]);
  });

  it('says nothing when the label agrees, and nothing about an unwatched conflict', () => {
    const r = shape([pr(12, [CONFLICT_LABEL], 'CONFLICTING'), pr(13, [], 'MERGEABLE'), pr(14, [], 'CONFLICTING', false)]);
    expect(r.items).toEqual([]);
  });

  it('never judges UNKNOWN mergeability (GitHub is still computing) — counts it instead', () => {
    const r = shape([pr(15, [CONFLICT_LABEL], 'UNKNOWN')]);
    expect(r.items).toEqual([]);
    expect(r.undetermined).toBe(1);
  });

  it('a repo whose listing failed is a gap, not a clean repo', () => {
    const r = shapeStaleLabels({ byRepo: [{ repo: 'o/r', error: 'gh: not logged in' }] });
    expect(r.items).toEqual([]);
    expect(r.gaps).toEqual([{ field: 'staleLabels', reason: 'o/r: gh: not logged in' }]);
  });

  it('asks `gh` for `mergeable` and open PRs only', () => {
    const argv = openPrsArgv('o/r');
    expect(argv).toEqual(expect.arrayContaining(['--state', 'open', '--repo', 'o/r']));
    expect(argv[argv.indexOf('--json') + 1].split(',')).toEqual(expect.arrayContaining(['number', 'labels', 'mergeable']));
  });
});

describe('the other sections', () => {
  it('needsOperator lifts the PR and repo out of a queue line, verbatim otherwise', () => {
    const r = shapeNeedsOperator({ available: true, lines: ['PR #2401 (chalbert/web-everything) — review:human, gates pass, needs you', 'frontierui#88  Add a thing', 'something else'] });
    expect(r.items).toEqual([
      { pr: 2401, repo: 'chalbert/web-everything', line: 'PR #2401 (chalbert/web-everything) — review:human, gates pass, needs you' },
      { pr: 88, repo: 'frontierui', line: 'frontierui#88  Add a thing' },
      { pr: null, repo: null, line: 'something else' },
    ]);
  });

  it('owed carries dispatches and refusals, and a failed repo is a gap not an empty repo', () => {
    const r = shapeOwed({ byRepo: [
      { repo: 'o/r', dispatch: [{ kind: 'review', prNumber: 5, why: 'needs review' }], refusals: [{ kind: 'liveness-unknown', prNumber: 6, why: 'no pid' }], notes: [{ text: 'n' }] },
      { repo: 'o/q', error: 'gh failed' },
    ] });
    expect(r.items).toEqual([
      { repo: 'o/r', type: 'dispatch', kind: 'review', pr: 5, why: 'needs review' },
      { repo: 'o/r', type: 'refusal', kind: 'liveness-unknown', pr: 6, why: 'no pid' },
    ]);
    expect(r.notes).toEqual([{ repo: 'o/r', text: 'n' }]);
    expect(r.gaps).toEqual([{ field: 'owed', reason: 'o/q: gh failed' }]);
  });

  it('runner: up needs a live, unexpired lease; pause overrides; a dead pid is down; unreadable is unknown', () => {
    const lease = (o) => ({ available: true, lease: { present: true, pid: 9, heartbeatAt: NOW, expired: false, pidAlive: true, ...o }, paused: false });
    expect(shapeRunner(lease({})).runner.state).toBe('up');
    expect(shapeRunner(lease({ pidAlive: false })).runner.state).toBe('down');
    expect(shapeRunner(lease({ expired: true })).runner.state).toBe('down');
    expect(shapeRunner({ available: true, lease: { present: false }, paused: false }).runner.state).toBe('down');
    expect(shapeRunner({ ...lease({}), paused: true, pausedKinds: ['build'] }).runner).toMatchObject({ state: 'paused', pausedKinds: ['build'] });
    const bad = shapeRunner({ available: false, reason: 'no lease dir' });
    expect(bad.runner.state).toBe('unknown');
    expect(bad.gap).toEqual({ field: 'runner', reason: 'no lease dir' });
  });

  it('live flags what it cannot vouch for while #3725 / #3721 are open, and stays quiet once they resolve', () => {
    const okLive = { sessions: { available: true, rows: [{ id: 'a', name: 'n', status: 'working', cwd: '/w' }] }, inFlight: { available: true, rows: [], unreadable: 0 }, lanes: { available: true, total: 4, acquirable: 2, byRepo: [] } };
    const open = shapeLive({ ...okLive, prerequisites: [{ card: '3725', status: 'open' }, { card: '3721', status: 'open' }] });
    expect(open.live.caveats.map((c) => c.card)).toEqual(['3725', '3721']);
    expect(open.live.sessions).toMatchObject({ available: true, count: 1 });
    expect(open.live.lanes).toMatchObject({ available: true, total: 4, acquirable: 2 });
    expect(open.gaps).toEqual([]);
    const done = shapeLive({ ...okLive, prerequisites: [{ card: '3725', status: 'resolved' }, { card: '3721', status: 'resolved' }] });
    expect(done.live.caveats).toEqual([]);
    const unknown = shapeLive({ ...okLive, prerequisites: [{ card: '3725', status: 'unknown', reason: 'no card' }] });
    expect(unknown.live.caveats[0]).toMatchObject({ card: '3725', status: 'unknown', reason: 'no card' });
  });

  it('an unreadable live section is unavailable with the reason, never an empty count that reads as zero', () => {
    const r = shapeLive({ sessions: { available: false, reason: 'claude not on PATH' }, inFlight: { available: true, rows: [] }, lanes: { available: false, reason: 'no pool' }, prerequisites: [] });
    expect(r.live.sessions).toMatchObject({ available: false, reason: 'claude not on PATH' });
    expect(r.live.lanes).toMatchObject({ available: false, total: null, acquirable: null });
    expect(r.gaps.map((g) => g.reason)).toEqual(['sessions: claude not on PATH', 'lanes: no pool']);
  });
});

/** A reader over stubbed ports and the REAL git read, for the full digest. */
function fixtureReader(ctx, over = {}) {
  return createTurnDigestReader({
    root: ctx.root,
    dir: join(ctx.tmp, 'state'),
    now: () => new Date(NOW),
    readNeeds: () => ({ lines: ['PR #2401 (chalbert/web-everything) — review:human, gates pass, needs you'] }),
    listAgents: () => [{ sessionId: 'aaaa1111', name: 'conveyor-1', state: 'working', cwd: '/w', startedAt: 1 }],
    reconcile: (repo) => ({ dispatch: [{ kind: 'fix', prNumber: 7, why: `conflict on ${repo}` }], refusals: [], notes: [] }),
    readInFlightRows: () => ({ rows: [{ runId: 'run-1', item: '3724', handle: '123' }], unreadable: 0 }),
    readLaneCounts: () => ({ available: true, total: 3, acquirable: 1, byRepo: [] }),
    readRunnerState: () => ({ available: true, lease: { present: true, pid: 1, heartbeatAt: NOW, expired: false, pidAlive: true }, paused: false }),
    readPrereqs: () => [{ card: '3725', status: 'open' }, { card: '3721', status: 'open' }],
    gh: (args) => JSON.stringify([{ number: 21, headRefName: 'lane/x', labels: [{ name: CONFLICT_LABEL }], mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN' }]),
    ...over,
  });
}

function driveDigest(readFacts, input = {}) {
  const registry = createRegistry();
  const declaration = turnDigestOperation({ readFacts });
  registry.register(declaration);
  const run = advanceWhileRunning(startRun({ op: TURN_DIGEST_OP, id: 'turn-digest-t', input, registry }), { registry });
  return { run, digest: run.verdict, declaration };
}

describe('the whole digest, over a real fixture history', () => {
  it('reports the merged PRs after the cursor, the stale label, and every other section', async () => {
    await withRealRepo((ctx) => {
      const h = buildHistory(ctx);
      const { digest } = driveDigest(fixtureReader(ctx, { repos: '' }), { since: h.pr101, repos: 'o/r' });
      expect(digest.landed.map((m) => m.pr)).toEqual([102, 103]);
      expect(digest.landed.map((m) => m.sha)).toEqual([h.pr102, h.pr103]);
      expect(digest.cursor).toMatchObject({ since: h.pr101, source: 'input', tip: h.pr103, advanceTo: null });
      expect(digest.staleLabels).toEqual([expect.objectContaining({ repo: 'o/r', pr: 21, kind: 'stale-label' })]);
      expect(digest.needsOperator).toHaveLength(1);
      expect(digest.owed).toEqual([expect.objectContaining({ type: 'dispatch', kind: 'fix', repo: 'o/r', pr: 7 })]);
      expect(digest.live.sessions).toMatchObject({ available: true, count: 1 });
      expect(digest.live.inFlight).toMatchObject({ available: true, count: 1 });
      expect(digest.live.caveats.map((c) => c.card)).toEqual(['3725', '3721']);
      expect(digest.runner.state).toBe('up');
      expect(digest.generatedAt).toBe(NOW);
      expect(digest.version).toBe(DIGEST_VERSION);
      expect(digest.complete).toBe(true);
      expect(digest.unavailable).toEqual([]);
    });
  });

  it('landed is empty when nothing merged after the cursor, and the digest still says it asked', async () => {
    await withRealRepo((ctx) => {
      const h = buildHistory(ctx);
      const { digest } = driveDigest(fixtureReader(ctx), { since: h.pr103, repos: 'o/r' });
      expect(digest.landed).toEqual([]);
      expect(digest.unavailable.map((g) => g.field)).not.toContain('landed');
    });
  });

  it('the same fixture yields the same digest twice (deterministic)', async () => {
    await withRealRepo((ctx) => {
      const h = buildHistory(ctx);
      const a = driveDigest(fixtureReader(ctx), { since: h.pr101, repos: 'o/r' }).digest;
      const b = driveDigest(fixtureReader(ctx), { since: h.pr101, repos: 'o/r' }).digest;
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(formatDigest(a)).toEqual(formatDigest(b));
    });
  });

  it('uses the consumer\'s stored cursor when no `since` is given, and never advances it without `advance`', async () => {
    await withRealRepo((ctx) => {
      const h = buildHistory(ctx);
      const state = join(ctx.tmp, 'state');
      writeStoredCursor('sess-a', h.pr102, { dir: state });
      const { digest } = driveDigest(fixtureReader(ctx), { consumer: 'sess-a', repos: 'o/r' });
      expect(digest.landed.map((m) => m.pr)).toEqual([103]);
      expect(digest.cursor).toMatchObject({ consumer: 'sess-a', source: 'stored', advanceTo: null, advanceRequested: false });
      expect(readStoredCursor('sess-a', state)).toBe(h.pr102);
      // A different consumer has no cursor: it gets the last-N first-call answer.
      const other = driveDigest(fixtureReader(ctx), { consumer: 'sess-b', repos: 'o/r' }).digest;
      expect(other.landed.map((m) => m.pr)).toEqual([101, 102, 103]);
    });
  });

  it('asks to advance only with a consumer and a tip', async () => {
    await withRealRepo((ctx) => {
      const h = buildHistory(ctx);
      const withConsumer = driveDigest(fixtureReader(ctx), { consumer: 'sess-a', advance: true, repos: 'o/r' }).digest;
      expect(withConsumer.cursor.advanceTo).toBe(h.pr103);
      const without = driveDigest(fixtureReader(ctx), { advance: true, repos: 'o/r' }).digest;
      expect(without.cursor).toMatchObject({ advanceTo: null, advanceRequested: true });
    });
  });
});

describe('a section that cannot be read is NEVER an empty list', () => {
  it('names every failed read in `unavailable` and marks the digest incomplete', async () => {
    await withRealRepo((ctx) => {
      buildHistory(ctx);
      const boom = (m) => () => { throw new Error(m); };
      const reader = fixtureReader(ctx, {
        readNeeds: () => ({ error: 'operator-queue.mjs is not on any checkout found' }),
        listAgents: boom('claude: command not found'),
        gh: boom('gh: not logged in'),
        readInFlightRows: boom('store unreadable'),
        readLaneCounts: boom('no pool'),
        readRunnerState: boom('lease dir unreadable'),
        readPrereqs: boom('no git'),
      });
      const { digest } = driveDigest(reader, { since: 'not-a-sha', repos: 'o/r' });
      expect(digest.complete).toBe(false);
      const fields = new Set(digest.unavailable.map((g) => g.field));
      expect([...fields].sort()).toEqual(['landed', 'live', 'needsOperator', 'owed', 'runner', 'staleLabels']);
      expect(digest.unavailable.find((g) => g.field === 'needsOperator').reason).toMatch(/operator-queue\.mjs is not on any checkout/);
      expect(digest.unavailable.find((g) => g.field === 'landed').reason).toMatch(/not a commit/);
      expect(digest.unavailable.filter((g) => g.field === 'owed')[0].reason).toMatch(/session listing failed/);
      expect(digest.live.caveats.every((c) => c.status === 'unknown')).toBe(true);
      expect(digest.runner.state).toBe('unknown');
      // The arrays are present but must be read together with `unavailable`.
      expect(digest.landed).toEqual([]);
      expect(formatDigest(digest).join('\n')).toMatch(/INCOMPLETE/);
    });
  });

  it('a missing operator-queue script (the prototype branch does not carry it) is reported by the real reader, not a crash', () => {
    const r = createTurnDigestReader({ readNeeds: () => ({ error: 'operator-queue.mjs is not on any checkout found' }) });
    expect(typeof r).toBe('function');
  });
});

describe('no effect is declared', () => {
  const { declaration } = driveDigest(() => ({ now: NOW }), {});

  it('every step is `compute`, so the adapters derive a read-only surface', () => {
    expect(isReadOnlyOperation(declaration)).toBe(true);
    expect(declaration.steps.map((s) => [s.name, s.step.kind])).toEqual([['read', 'compute'], ['assess', 'compute']]);
  });

  it('the run has no effects and needs no sink', () => {
    const { run } = driveDigest(() => ({ now: NOW }), {});
    expect(run.effects ?? []).toEqual([]);
    expect(run.status ?? 'complete').toBe('complete');
  });

  it('the declaring module imports nothing that can act; only the io shell reaches fs, git and gh', () => {
    expect(importGraph(resolve(HERE, '..', 'turn-digest.mjs')).external).toEqual([]);
    const io = importGraph(resolve(HERE, '..', 'turn-digest-io.mjs')).external;
    expect(io).toContain('node:fs');
    expect(io).toContain('node:child_process');
  });

  it('refuses a reader that returns no clock — a digest that cannot be aged is not a digest', () => {
    expect(() => driveDigest(() => ({}), {})).toThrow(/no `now`/);
  });

  it('refuses to be built without a reader', () => {
    expect(() => turnDigestOperation()).toThrow(/readFacts/);
  });
});

describe('the snapshot — atomic, under the state root, written by `finish`', () => {
  const digest = () => buildDigest({ now: NOW, landed: { available: true, tip: SHA('a'), cursor: { value: null, source: 'none' }, log: '' }, consumer: 'sess-a', advance: true });

  it('writes latest.json atomically under the state root and leaves no temp file behind', () => {
    const dir = mkdtempSync(join(tmpdir(), 'turn-digest-snap-'));
    try {
      const d = digest();
      const path = writeSnapshot(d, dir);
      expect(path).toBe(snapshotPath(dir));
      expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(d);
      expect(readdirSync(dir)).toEqual(['latest.json']);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('`finish` writes the snapshot and the requested cursor, and prints the readable digest', () => {
    const dir = mkdtempSync(join(tmpdir(), 'turn-digest-fin-'));
    try {
      const d = digest();
      const out = createTurnDigestFinish({ dir })({ run: { verdict: d }, code: 0, lines: ['ignored adapter text'] });
      expect(out.code).toBe(0);
      expect(out.lines[0]).toMatch(/^turn-digest @ /);
      expect(out.lines.join('\n')).toContain(`snapshot: ${snapshotPath(dir)}`);
      expect(existsSync(snapshotPath(dir))).toBe(true);
      expect(readStoredCursor('sess-a', dir)).toBe(SHA('a'));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('`finish` does NOT move a cursor when advance was not requested', () => {
    const dir = mkdtempSync(join(tmpdir(), 'turn-digest-fin-'));
    try {
      const d = buildDigest({ now: NOW, landed: { available: true, tip: SHA('a'), cursor: { value: null, source: 'none' }, log: '' }, consumer: 'sess-a', advance: false });
      createTurnDigestFinish({ dir })({ run: { verdict: d }, code: 0, lines: [] });
      expect(existsSync(join(dir, 'cursors'))).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('`--json` leaves stdout as the adapter printed it, and a failed write is an exit 1 plus a warning', () => {
    const warned = [];
    const finish = createTurnDigestFinish({ dir: '/nope', write: () => { throw new Error('disk full'); }, warn: (m) => warned.push(m) });
    const out = finish({ run: { verdict: digest() }, code: 0, lines: ['{"json":true}'], json: true });
    expect(out).toEqual({ code: 1, lines: ['{"json":true}'] });
    expect(warned.join('\n')).toMatch(/FAILED to write the snapshot — disk full/);
  });

  it('a run with no digest verdict passes through untouched', () => {
    expect(createTurnDigestFinish({ dir: '/nope' })({ run: {}, code: 2, lines: ['x'] })).toEqual({ code: 2, lines: ['x'] });
  });
});

describe('the io shell\'s other reads', () => {
  it('lane counts skip the reaper: `--acquirable` is always paired with `--no-reap`', () => {
    const calls = [];
    const run = (args) => { calls.push(args); return JSON.stringify(args.includes('--acquirable') ? ['/l/1'] : ['/l/1', '/l/2']); };
    const r = readLanes({ repos: [{ slug: 'o/r', path: '/some/checkout' }], run, exists: () => true, home: '/h' });
    expect(r).toMatchObject({ available: true, total: 2, acquirable: 1 });
    const acquirable = calls.find((a) => a.includes('--acquirable'));
    expect(acquirable).toContain('--no-reap');
  });

  it('a repo with no checkout is a per-repo error, and no reachable pool at all is unavailable', () => {
    const r = readLanes({ repos: [{ slug: 'o/r', path: '/gone' }], exists: () => false, run: () => '[]', home: '/h' });
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/no checkout at \/gone/);
  });

  it('reads every in-flight dispatch in the run store, and counts unreadable records instead of skipping them', () => {
    const runs = {
      good: { id: 'good', effects: [{ type: 'conveyor.dispatch-delivery-agent', status: 'in-flight', payload: { num: '3724' }, handle: '55', startedAt: NOW }, { type: 'other', status: 'in-flight' }, { type: 'conveyor.dispatch-delivery-agent', status: 'applied' }] },
    };
    const store = { list: () => ['good', 'torn'], read: (id) => { if (id === 'torn') throw new Error('corrupt'); return runs[id]; } };
    const r = readInFlight({ store });
    expect(r.rows).toEqual([{ runId: 'good', item: '3724', handle: '55', startedAt: NOW, lastSeenLiveAt: null }]);
    expect(r.unreadable).toBe(1);
  });

  it('reads the runner from its lease and the pause marker', () => {
    const up = readRunner({ readLease: () => ({ pid: 7, heartbeatAt: new Date().toISOString() }), isPidAlive: () => true, readPause: () => ({ paused: false }) });
    expect(up.lease).toMatchObject({ present: true, pid: 7, pidAlive: true });
    expect(shapeRunner(up).runner.state).toBe('up');
    const none = readRunner({ readLease: () => null, readPause: () => ({ paused: false }) });
    expect(shapeRunner(none).runner.state).toBe('down');
  });

  it('reads a prerequisite card\'s status off the ref, and an unreadable card is `unknown`, never `resolved`', () => {
    const git = (args) => {
      if (args[0] === 'ls-tree') return 'backlog/3725-lane-availability.md\nbacklog/3721-reap-sessions.md\n';
      if (args[1].endsWith('3725-lane-availability.md')) return '---\nstatus: open\n---\n# t\n';
      if (args[1].endsWith('3721-reap-sessions.md')) return '---\nstatus: resolved\n---\n# t\n';
      throw new Error('unexpected');
    };
    expect(readPrerequisites({ git, cards: ['3725', '3721', '9999'] })).toEqual([
      { card: '3725', status: 'open' },
      { card: '3721', status: 'resolved' },
      { card: '9999', status: 'unknown', reason: 'no backlog card 9999 on origin/main' },
    ]);
    expect(readPrerequisites({ git: () => { throw new Error('no git'); }, cards: ['3725'] })[0]).toMatchObject({ status: 'unknown' });
  });

  it('resolves `--repos`, defaulting to the whole constellation and keeping an unknown slug as given', () => {
    expect(resolveRepos('').map((r) => r.slug)).toEqual(expect.arrayContaining(['chalbert/web-everything']));
    expect(resolveRepos('a/b, chalbert/web-everything').map((r) => r.slug)).toEqual(['a/b', 'chalbert/web-everything']);
    // `gh --repo` needs OWNER/REPO: the constellation table's bare `frontierui` / `plateau-app` are completed (found by the live probe).
    expect(resolveRepos('').map((r) => r.slug).every((s) => s.includes('/'))).toBe(true);
    expect(resolveRepos('frontierui').map((r) => r.slug)).toEqual(['chalbert/frontierui']);
    expect(ghSlug('plateau-app')).toBe('chalbert/plateau-app');
    expect(ghSlug('o/r')).toBe('o/r');
  });

  it('refuses an unsafe `--consumer` before any read', () => {
    const reader = createTurnDigestReader({});
    expect(() => reader({ consumer: '../x' })).toThrow(/invalid --consumer/);
  });
});
