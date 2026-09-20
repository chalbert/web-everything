/** The IO shell and CLI of the `/wip` report: what is read, what is written (only `--stamp`), and isolation of failures. */
import { it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { main } from '../wip-report-cli.mjs';
import { createWipReportReader, readLastWip, stampLastWip, lastWipPath, findRoot, readCompletions, stateDir } from '../wip-report-io.mjs';

const RAW = JSON.parse(readFileSync(resolve('scripts/operations/__fixtures__/wip-report/raw-2026-09-20.json'), 'utf8'));
const dirs = [];
const tmp = () => { const d = mkdtempSync(join(tmpdir(), 'wip-report-')); dirs.push(d); return d; };
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const capture = () => { const out = { stdout: '', stderr: '' }; return { out, stdout: (s) => { out.stdout += s; }, stderr: (s) => { out.stderr += s; } }; };

it('a default run prints the report and writes nothing (no stamp, no state dir)', async () => {
  const state = tmp(), c = capture(), stamps = [];
  const before = readdirSync(state);
  const code = await main({ argv: [], readRaw: async () => structuredClone(RAW), stamp: (iso) => stamps.push(iso), stdout: c.stdout, stderr: c.stderr });
  expect(code).toBe(0);
  expect(stamps).toEqual([]);
  expect(readdirSync(state)).toEqual(before);
  expect(c.out.stdout).toContain('## Attention');
  expect(c.out.stdout.endsWith('\n')).toBe(true);
});
it('--json is a default run too: structured output, still no write', async () => {
  const c = capture(), stamps = [];
  expect(await main({ argv: ['--json'], readRaw: async () => structuredClone(RAW), stamp: (i) => stamps.push(i), stdout: c.stdout, stderr: c.stderr })).toBe(0);
  const report = JSON.parse(c.out.stdout);
  expect(Object.keys(report)).toEqual(expect.arrayContaining(['header', 'attention', 'workItems', 'done', 'next', 'needsYou']));
  expect(stamps).toEqual([]);
});
it('--stamp is the only write: it persists the run time to last-wip.json after printing', async () => {
  const state = tmp(), c = capture(), file = join(state, 'nested', 'last-wip.json');
  const code = await main({ argv: ['--stamp'], readRaw: async () => structuredClone(RAW), stamp: (iso) => stampLastWip(file, iso), stdout: c.stdout, stderr: c.stderr });
  expect(code).toBe(0);
  expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ at: new Date(RAW.now).toISOString() });
  expect(readdirSync(join(state, 'nested'))).toEqual(['last-wip.json']);
  expect(readLastWip(file)).toBe(new Date(RAW.now).toISOString());
});
it('the next run reads the stamp back and scopes Done to it', async () => {
  const state = tmp(), file = join(state, 'last-wip.json');
  stampLastWip(file, '2026-09-20T14:30:00.000Z');
  const c = capture();
  const reader = async () => ({ ...structuredClone(RAW), lastWip: readLastWip(file) });
  await main({ argv: [], readRaw: reader, stdout: c.stdout, stderr: c.stderr });
  expect(c.out.stdout).toContain('## Done since 2026-09-20 10:30 EDT\n');
});
it('a failed --stamp write is an error (exit 1) rather than a silent loss', async () => {
  const c = capture();
  const code = await main({ argv: ['--stamp'], readRaw: async () => structuredClone(RAW), stamp: () => { throw new Error('disk full'); }, stdout: c.stdout, stderr: c.stderr });
  expect(code).toBe(1);
  expect(c.out.stderr).toContain('disk full');
});
it('--sessions prints the raw wip-agents dump unchanged and reads none of the report sources', async () => {
  const c = capture(), seen = [];
  const code = await main({ argv: ['--sessions'], readRaw: async () => { throw new Error('must not be called'); },
    sessionsMain: async (o) => { seen.push(o.argv); o.stdout('| Item | Detail | Supervisor | Executor |\n'); return 0; }, stdout: c.stdout, stderr: c.stderr });
  expect(code).toBe(0);
  expect(seen).toEqual([[]]);
  expect(c.out.stdout).toBe('| Item | Detail | Supervisor | Executor |\n');
});
it('rejects an unknown flag before reading anything', async () => {
  const c = capture();
  expect(await main({ argv: ['--frobnicate'], readRaw: async () => { throw new Error('no'); }, stdout: c.stdout, stderr: c.stderr })).toBe(1);
  expect(c.out.stderr).toContain('Unknown argument: --frobnicate');
});

it('the last-wip path honours WIP_STATE_DIR, and a missing or garbled stamp reads as null', () => {
  expect(lastWipPath('/h', { WIP_STATE_DIR: '/s' })).toBe('/s/last-wip.json');
  expect(stateDir('/h', {})).toBe('/h/workspace/.operations/state');
  const d = tmp();
  expect(readLastWip(join(d, 'nope.json'))).toBeNull();
  writeFileSync(join(d, 'bad.json'), '{"at":"not a date"}');
  expect(readLastWip(join(d, 'bad.json'))).toBeNull();
});
it('findRoot picks the first checkout that has the file', () => {
  expect(findRoot('a/b', { roots: ['/x', undefined, '/y', '/z'], exists: (p) => p === '/y/a/b' || p === '/z/a/b' })).toBe('/y');
  expect(findRoot('a/b', { roots: ['/x'], exists: () => false })).toBeNull();
});
it('readCompletions keeps every good record and skips a torn one', () => {
  const d = tmp();
  writeFileSync(join(d, 'fix-1.json'), JSON.stringify({ session: 'fix-1', kind: 'fix', pr: 1, status: 'done', outcome: 'ok', updatedAt: '2026-09-20T14:00:00Z' }));
  writeFileSync(join(d, 'fix-2.json'), '{torn');
  writeFileSync(join(d, 'notes.txt'), 'x');
  expect(readCompletions(d)).toEqual([{ session: 'fix-1', kind: 'fix', pr: 1, item: null, status: 'done', outcome: 'ok', updatedAt: '2026-09-20T14:00:00Z' }]);
});

it('the reader isolates every failing source: it records them, never throws, and leaves the field unknown', async () => {
  const boom = (m) => () => { throw new Error(`${m}\nsecond line`); };
  const state = tmp();
  const read = createWipReportReader({ env: { OPERATION_COMPLETIONS_DIR: '/nowhere', WIP_STATE_DIR: state }, home: state, now: () => 123, sweptReposPath: join(state, 'none.json'),
    readLand: boom('land'), readWip: boom('wip'), readLoad: boom('load'), readRunner: boom('runner'), readQueue: boom('queue'),
    readDone: boom('done'), readDocket: boom('docket'), readStamp: () => null });
  const raw = await read();
  expect(raw.now).toBe(123);
  expect(raw.errors.map((e) => e.source)).toEqual(['land-advance', 'sessions', 'merged-prs', 'load', 'runner', 'operator-queue', 'completions', 'docket']);
  expect(raw.errors.every((e) => !e.message.includes('\n'))).toBe(true);
  expect(raw).toMatchObject({ landInputs: null, wipData: null, merged: null, operatorQueueText: null, completions: null, docket: null, runner: { state: 'unknown' }, load: null });
  expect(readdirSync(state)).toEqual([]);
});
it('the reader gathers the merged PRs of all three swept repos with owner-qualified slugs, and passes the stamp through', async () => {
  const state = tmp(), swept = join(state, 'swept.json'), calls = [];
  writeFileSync(swept, JSON.stringify(['chalbert/web-everything', 'chalbert/frontierui', 'chalbert/plateau-app']));
  const read = createWipReportReader({ env: { OPERATION_COMPLETIONS_DIR: '/nowhere' }, home: state, now: () => 5, sweptReposPath: swept,
    readLand: () => ({ prs: [], errors: [{ source: 'x', message: 'first\nsecond' }] }), readWip: () => ({ agents: [], facts: {} }), readLoad: () => ({ load: 2, cores: 12 }),
    readRunner: () => ({ state: 'alive-and-idle' }), readQueue: () => 'NEEDS YOU (x):\n(none)\n', readDone: () => [], readDocket: () => null, readStamp: () => '2026-09-20T14:00:00.000Z',
    readMerged: (slug) => { calls.push(slug); return [{ number: 1, title: 't', mergedAt: '2026-09-20T14:30:00Z', slug }]; } });
  const raw = await read();
  expect(calls).toEqual(['chalbert/web-everything', 'chalbert/frontierui', 'chalbert/plateau-app']);
  expect(raw.merged).toHaveLength(3);
  expect(raw).toMatchObject({ load: 2, cores: 12, lastWip: '2026-09-20T14:00:00.000Z', runner: { state: 'alive-and-idle' } });
  expect(raw.errors).toEqual([{ source: 'land-advance:x', message: 'first' }]);
  expect(existsSync(join(state, 'workspace'))).toBe(false);
});
