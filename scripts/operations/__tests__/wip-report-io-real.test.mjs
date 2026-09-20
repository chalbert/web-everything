/**
 * @file scripts/operations/__tests__/wip-report-io-real.test.mjs
 * @description THE REAL-MECHANISM half of `wip-report-io.mjs` (#2949's fidelity qualifier, motivated by
 *   #3264). Its sibling `wip-report-io.test.mjs` drives the snapshot through injected ports, and those stay:
 *   they pin decisions. This file exists because this module's own job is three filesystem and process
 *   effects that a port double has no way to fake:
 *
 *   • the ONLY write, `stampLastWip` — a tmp file plus `renameSync` into a directory that may not exist yet,
 *     read back by `readLastWip` off the disk;
 *   • root discovery — `findRoot` asks a real directory tree which checkout carries a file, and `readRaw`
 *     then runs a real `node` child there and `import()`s the runner modules out of that tree (that import
 *     is run in a real `node` child too: vitest's own module graph refuses a file outside the repo root, so
 *     only a plain `node` process can say whether the module the operator's checkout carries really loads);
 *   • `readCompletions` over a real directory holding a torn record beside good ones.
 *
 * The tree comes from `withRealRepo`, a real git checkout, because the root a report reads from IS a
 * checkout. No `gh`, no `claude`, no network: the merged-PR list is the empty swept-repos file, and the land
 * and agent-session readers are injected (their own real-mechanism coverage is `land-advance-io-real.test.mjs`).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { withRealRepo } from './helpers/real-repo.mjs';
import { createWipReportReader, findRoot, lastWipPath, readCompletions, readLastWip, stampLastWip, stateDir } from '../wip-report-io.mjs';

const IO_MODULE = resolve(dirname(fileURLToPath(import.meta.url)), '../wip-report-io.mjs');

/** Real `node`/`git` children; anything else (`gh`, `claude`) throws so a live call cannot slip in. */
const realExec = (program, args, opts = {}) => {
  if (program !== 'node' && program !== 'git') throw new Error(`unexpected external call in a real-mechanism test: ${program}`);
  return String(execFileSync(program, args, { encoding: 'utf8', stdio: 'pipe', ...opts }));
};

/** Commit a set of files into the fixture checkout so the tree is a real repo with real history. */
function seed(ctx, files) { ctx.commit(files, 'fixture: wip-report checkout'); }

describe('stampLastWip / readLastWip — the only write, on a real disk', () => {
  it('creates the missing directory, leaves no temp file, and reads back the exact stamp', async () => {
    await withRealRepo(async ({ root }) => {
      const path = lastWipPath(root, { WIP_STATE_DIR: join(root, 'state', 'nested') });
      expect(existsSync(join(root, 'state'))).toBe(false);
      stampLastWip(path, '2026-09-20T12:00:00.000Z');
      expect(readLastWip(path)).toBe('2026-09-20T12:00:00.000Z');
      expect(readFileSync(path, 'utf8')).toBe('{"at":"2026-09-20T12:00:00.000Z"}\n');
      expect(readdirSync(join(root, 'state', 'nested'))).toEqual(['last-wip.json']);
      stampLastWip(path, '2026-09-20T13:00:00.000Z');
      expect(readLastWip(path)).toBe('2026-09-20T13:00:00.000Z');
    });
  });

  it('reads null for an absent, torn or non-time stamp, never throws', async () => {
    await withRealRepo(async ({ root }) => {
      const path = join(root, 'last-wip.json');
      expect(readLastWip(path)).toBeNull();
      writeFileSync(path, '{"at": "2026-09');
      expect(readLastWip(path)).toBeNull();
      writeFileSync(path, '{"at":"not a time"}');
      expect(readLastWip(path)).toBeNull();
    });
  });

  it('resolves the state directory from a real override, else under the home directory', () => {
    expect(stateDir('/home/x', { WIP_STATE_DIR: '/elsewhere' })).toBe('/elsewhere');
    expect(stateDir('/home/x', {})).toBe('/home/x/workspace/.operations/state');
  });
});

describe('readCompletions — a real directory with a torn record', () => {
  it('keeps every readable record and skips the torn one and the non-json file', async () => {
    await withRealRepo(async ({ root }) => {
      const dir = join(root, 'completions');
      mkdirSync(dir);
      writeFileSync(join(dir, 'a.json'), JSON.stringify({ session: 'a', kind: 'review', status: 'done', pr: 7, startedAt: '2026-09-20T01:00:00Z' }));
      writeFileSync(join(dir, 'torn.json'), '{"session": "b", "kind"');
      writeFileSync(join(dir, 'notes.txt'), 'not a record');
      writeFileSync(join(dir, 'c.json'), JSON.stringify({ session: 'c', status: 'started' }));
      const got = readCompletions(dir);
      expect(got.map((c) => c.session).sort()).toEqual(['a', 'c']);
      expect(got.find((c) => c.session === 'a')).toMatchObject({ kind: 'review', pr: 7, status: 'done', updatedAt: '2026-09-20T01:00:00Z' });
    });
  });
});

describe('findRoot and createWipReportReader — real tree, real dynamic import, real node child', () => {
  it('findRoot answers from the real tree: first root that has the file, null when none does', async () => {
    await withRealRepo(async (ctx) => {
      seed(ctx, { 'scripts/operations/operator-queue.mjs': 'console.log("q");\n' });
      const empty = join(ctx.tmp, 'empty-root');
      mkdirSync(empty);
      expect(findRoot('scripts/operations/operator-queue.mjs', { roots: [undefined, empty, ctx.root] })).toBe(ctx.root);
      expect(findRoot('scripts/operations/absent.mjs', { roots: [empty, ctx.root] })).toBeNull();
    });
  });

  it('readRaw reads the queue from a child process and the docket, completions and stamp from disk', async () => {
    await withRealRepo(async (ctx) => {
      seed(ctx, {
        'scripts/operations/operator-queue.mjs': 'console.log("QUEUE FROM A REAL CHILD");\n',
        'reports/decision-docket-data.json': JSON.stringify({ open: 3 }),
        '.operations/completions/one.json': JSON.stringify({ session: 'one', kind: 'fix', status: 'done', outcome: 'ok' }),
      });
      const home = join(ctx.tmp, 'home');
      const stateDirPath = join(home, 'state');
      const sweptReposPath = join(home, 'swept-repos.json');
      mkdirSync(home, { recursive: true });
      writeFileSync(sweptReposPath, '[]');
      // `OPERATION_COMPLETIONS_DIR` is set explicitly so `readRaw` does not write it into this process's env.
      const env = { WIP_STATE_DIR: stateDirPath, OPERATION_COMPLETIONS_DIR: join(ctx.root, '.operations/completions') };
      stampLastWip(lastWipPath(home, env), '2026-09-19T20:00:00.000Z');
      const raw = await createWipReportReader({
        home, env, roots: [ctx.root], exec: realExec, sweptReposPath, now: () => 1_000,
        readLand: () => ({ errors: [] }), readWip: () => ({ agents: [] }), readLoad: () => ({ load: 0.5, cores: 8 }),
        readRunner: () => ({ state: 'alive' }), // the real import is the next test
      })();
      expect(raw.errors).toEqual([]);
      expect(raw.operatorQueueText.trim()).toBe('QUEUE FROM A REAL CHILD');
      expect(raw.docket).toEqual({ open: 3 });
      expect(raw.completions).toEqual([expect.objectContaining({ session: 'one', kind: 'fix', status: 'done', outcome: 'ok' })]);
      expect(raw.lastWip).toBe('2026-09-19T20:00:00.000Z');
      expect(raw.merged).toEqual([]);
      expect(raw).toMatchObject({ now: 1_000, load: 0.5, cores: 8 });
    });
  });

  it('a real node process imports the runner modules out of the found root and assesses what they collect', async () => {
    await withRealRepo(async (ctx) => {
      seed(ctx, {
        'scripts/operations/runner-activity-io.mjs': 'export const collectRunnerActivity = (o) => ({ limit: o.limit, seen: "io" });\n',
        'scripts/operations/runner-activity.mjs': 'export const assessRunnerActivity = (a) => ({ state: "alive", stalledReason: null, echoed: a });\n',
      });
      const script = join(ctx.tmp, 'read-raw.mjs');
      writeFileSync(script, `import { createWipReportReader } from ${JSON.stringify(pathToFileURL(IO_MODULE).href)};
const raw = await createWipReportReader({ roots: [process.argv[2]], sweptReposPath: process.argv[3],
  readLand: () => ({ errors: [] }), readWip: () => ({ agents: [] }), readLoad: () => ({ load: 0, cores: 1 }),
  readQueue: () => '', readDocket: () => null, readDone: () => [], readStamp: () => null,
  env: { OPERATION_COMPLETIONS_DIR: process.argv[4] } })();
process.stdout.write(JSON.stringify({ runner: raw.runner, errors: raw.errors }));
`);
      const swept = join(ctx.tmp, 'swept.json');
      writeFileSync(swept, '[]');
      const out = JSON.parse(execFileSync(process.execPath, [script, ctx.root, swept, join(ctx.tmp, 'completions')], { encoding: 'utf8', stdio: 'pipe' }));
      expect(out.errors).toEqual([]);
      expect(out.runner).toMatchObject({ state: 'alive', echoed: { limit: 0, seen: 'io' } });
    });
  });

  it('a checkout with none of the optional sources records the queue as an error and the runner as unknown, not assumed', async () => {
    await withRealRepo(async (ctx) => {
      const home = join(ctx.tmp, 'home');
      mkdirSync(home, { recursive: true });
      const sweptReposPath = join(home, 'swept-repos.json');
      writeFileSync(sweptReposPath, '[]');
      const completionsDir = join(ctx.root, '.operations/completions');
      mkdirSync(completionsDir, { recursive: true });
      const raw = await createWipReportReader({
        home, env: { WIP_STATE_DIR: join(home, 'state'), OPERATION_COMPLETIONS_DIR: completionsDir }, roots: [ctx.root], exec: realExec, sweptReposPath,
        readLand: () => ({ errors: [] }), readWip: () => ({ agents: [] }), readLoad: () => ({ load: 0, cores: 1 }),
      })();
      expect(raw.runner).toMatchObject({ state: 'unknown' });
      expect(raw.operatorQueueText).toBeNull();
      expect(raw.errors.map((e) => e.source)).toEqual(['operator-queue']);
      expect(raw.runner.stalledReason).toMatch(/not on any checkout/);
      expect(raw.docket).toBeNull();
      expect(raw.completions).toEqual([]);
      expect(raw.lastWip).toBeNull();
    });
  });
});
