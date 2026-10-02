/**
 * @file run.test.mjs — the REAL `run.mjs dispatch-lane` CLI refuses a stale checkout (#4329, the prevention
 * guard owed by chalbert/web-everything#2815's review).
 *
 * `dispatch-path-isolation-and-executor.test.mjs` proves `cliPreflight` with injected `arm`/`assertFresh`, so
 * deleting the `cliPreflight(name)` call from `run.mjs`'s CLI block broke no test. This runs the actual CLI as a
 * child process against a real stale checkout (real git, real origin), so that wiring is pinned.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { withBareOrigin } from './helpers/real-repo.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TOP_FILES = ['package.json'];
const TREES = ['scripts', 'skills-src'];

/** Copy the parts of this repo the CLI imports into the fixture clone, commit on main and push. */
function seedCheckout(ctx) {
  for (const tree of TREES) {
    if (!existsSync(join(REPO, tree))) continue;
    cpSync(join(REPO, tree), join(ctx.clone, tree), {
      recursive: true,
      filter: (src) => !/(^|\/)(__tests__|node_modules)(\/|$)/.test(src.slice(REPO.length)),
    });
  }
  for (const f of TOP_FILES) if (existsSync(join(REPO, f))) cpSync(join(REPO, f), join(ctx.clone, f));
  writeFileSync(join(ctx.clone, '.gitignore'), 'node_modules\n');
  symlinkSync(join(REPO, 'node_modules'), join(ctx.clone, 'node_modules'));
  ctx.git(['add', '-A']);
  ctx.git(['commit', '--quiet', '-m', 'fixture: repo tree']);
  ctx.git(['push', '--quiet', 'origin', 'main']);
  return ctx.git(['rev-parse', 'HEAD']).trim();
}

/** Run the real CLI from the fixture clone, with run/call stores redirected into the fixture. */
function runCli(ctx, args) {
  const runsDir = join(ctx.tmp, 'runs');
  const callsDir = join(ctx.tmp, 'calls');
  mkdirSync(runsDir, { recursive: true });
  mkdirSync(callsDir, { recursive: true });
  const r = spawnSync(process.execPath, [join(ctx.clone, 'scripts/operations/run.mjs'), ...args], {
    cwd: ctx.clone,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, OPERATION_RUNS_DIR: runsDir, OPERATION_CALLS_DIR: callsDir },
  });
  const records = readdirSync(runsDir).filter((f) => f.endsWith('.json'));
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', records };
}

describe('run.mjs dispatch-lane CLI preflight (real child process, real git)', () => {
  it('a fresh checkout on main is not refused by the preflight', async () => {
    await withBareOrigin(async (ctx) => {
      seedCheckout(ctx);
      const r = runCli(ctx, ['dispatch-lane', '--help']);
      expect(r.stderr + r.stdout).not.toMatch(/refusing to dispatch/i);
      expect(r.status).toBe(0);
      expect(r.records).toEqual([]);
    });
  }, 120_000);

  it('dispatch-lane CLI refuses a stale checkout and writes no run record', async () => {
    await withBareOrigin(async (ctx) => {
      const first = seedCheckout(ctx);
      // origin/main moves a CODE file past the checkout under test.
      ctx.seedOriginBranch('main', { 'scripts/stale-fixture.mjs': 'export const moved = true;\n' });
      ctx.git(['fetch', '--quiet', 'origin']);
      // The #3604 case: a DETACHED HEAD at the first commit.
      ctx.git(['checkout', '--quiet', '--detach', first]);

      const r = runCli(ctx, ['dispatch-lane', '--num=1']);
      expect(r.stderr).toMatch(/refusing to dispatch|stale/i);
      expect(r.status).toBe(1);
      expect(r.records).toEqual([]);
    });
  }, 120_000);
});

// Item activity uses the real registration/parser/envelope, with external reads injected.
import { resolveOperation } from '../run.mjs';
import { itemActivityOperation } from '../item-activity.mjs';
import { createItemActivityReader } from '../item-activity-io.mjs';
import { createRegistry, isReadOnlyOperation } from '../registry.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import { runOperationCli } from '../cli-adapter.mjs';

describe('item-activity CLI', () => {
  it('is registered without effect sinks', () => {
    const { declaration, sinks } = resolveOperation('item-activity');
    expect(declaration.name).toBe('item-activity');
    expect(isReadOnlyOperation(declaration)).toBe(true);
    expect(sinks).toEqual({});
  });
  it('the real CLI can query read-only evidence stores without writing a cursor', () => {
    const result = spawnSync(process.execPath, [join(REPO, 'scripts/operations/run.mjs'), 'item-activity', '--pr=0', '--json'], {
      cwd: REPO, encoding: 'utf8', timeout: 30_000,
      env: { ...process.env, OPERATION_RUNS_DIR: '/dev/null/item-activity-forbidden', OPERATION_CALLS_DIR: '/dev/null/item-activity-forbidden' },
    });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('pr must be a positive integer');
    expect(result.stdout + result.stderr).not.toMatch(/ENOTDIR|EPERM|EACCES/);
  });
  async function query(argv, options = {}) {
    const declaration = itemActivityOperation({ readActivity: createItemActivityReader({
      readSources: () => ({ rows: [] }), listCompletions: () => [], prToCard: {}, ...options,
    }) });
    const registry = createRegistry();
    registry.register(declaration);
    return runOperationCli({ declaration, argv: [...argv, '--json'], registry,
      store: createMemoryRunStore(), sinks: {}, newRunId: () => 'item-query-test' });
  }
  it('parses PR/card selectors and prints the actual JSON envelope', async () => {
    for (const argv of [['--pr=42', '--repo=frontierui'], ['--card=xabc123']]) {
      const result = await query(argv);
      expect(result.code).toBe(0);
      expect(JSON.parse(result.lines.join('\n')).verdict).toEqual({ runs: [], gaps: [] });
    }
  });
  it('refuses invalid input before reading and distinguishes metadata failure from no match', async () => {
    for (const argv of [[], ['--pr=0'], ['--pr=1', '--card=42'], ['--card=bad']]) {
      const result = await query(argv, { readSources: () => { throw new Error('must not read'); } });
      expect(result.code).not.toBe(0);
      expect(result.lines.join('\n')).not.toContain('must not read');
    }
    const result = await query(['--pr=42'], { prToCard: undefined, viewPr: () => { throw new Error('offline'); } });
    const verdict = JSON.parse(result.lines.join('\n')).verdict;
    expect(verdict.runs).toEqual([]);
    expect(verdict.gaps.join(' ')).toContain('metadata unavailable');
  });
});
