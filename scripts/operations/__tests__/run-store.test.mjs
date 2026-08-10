/**
 * @file run-store.test.mjs — the run record and its store (#3032).
 *
 * THE LOAD-BEARING TEST IN HERE is `a corrupt record is REFUSED, never read as absent`. It is the one place
 * this store deliberately behaves UNLIKE `we:scripts/conveyor/queue-store.mjs`, whose `parseQueue` degrades
 * a corrupt file to `[]` so a dispatch tick is never wedged. The nature of the state is different: a run
 * record read as "absent" would restart a run whose effects may already be half-applied, so it follows the
 * `we:scripts/lib/lane-verify.mjs` precedent (#2833) and refuses instead.
 */

import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';

import {
  RUN_RECORD_VERSION,
  assertRunRecord,
  effectKey,
  isValidRunId,
  newRunRecord,
  parseRunRecord,
  serializeRunRecord,
  validateRunRecord,
} from '../run-record.mjs';
import {
  createFileRunStore,
  createMemoryRunStore,
  deleteRun,
  listRunIds,
  newRunId,
  readRun,
  resolveRunsDir,
  runPath,
  runsDir,
  tryReadRun,
  writeRun,
} from '../run-store.mjs';

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'we-op-runs-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const sample = () => newRunRecord({ id: 'run-sample', op: 'fixture-review', input: { pr: 1 } });

describe('the pure core', () => {
  it('newRunRecord produces exactly the documented shape', () => {
    expect(sample()).toEqual({
      v: RUN_RECORD_VERSION, id: 'run-sample', op: 'fixture-review',
      input: { pr: 1 }, cursor: 0, findings: {}, verdict: null, effects: [], pending: null,
    });
  });

  it('round-trips through serialize/parse', () => {
    const parsed = parseRunRecord(serializeRunRecord(sample()));
    expect(parsed.ok).toBe(true);
    expect(parsed.record).toEqual(sample());
  });

  it('refuses an id that could escape the runs directory', () => {
    for (const bad of ['../escape', 'a/b', '', '.', '..', 'x'.repeat(200)]) expect(isValidRunId(bad)).toBe(false);
    expect(isValidRunId('run-8f14e45f')).toBe(true);
    expect(() => newRunRecord({ id: '../escape', op: 'x' })).toThrow(/invalid run id/);
    expect(() => runPath('../escape', dir)).toThrow(/invalid run id/);
  });

  it('reports EVERY validation error, not just the first', () => {
    const { ok, errors } = validateRunRecord({ v: 1, id: 'r', op: '', cursor: -1, findings: null, effects: 'no', pending: 3 });
    expect(ok).toBe(false);
    expect(errors).toEqual(expect.arrayContaining([
      'missing operation name', '`input` must be an object', '`cursor` must be a non-negative integer',
      '`findings` must be an object', '`effects` must be an array', '`pending` must be null or an object',
    ]));
  });

  it('refuses a duplicate effect key — the idempotency key must be unique within a run', () => {
    const record = { ...sample(), effects: [0, 1].map(() => ({ key: 'run-sample#0#0', stepIndex: 0, index: 0, type: 't', status: 'declared' })) };
    expect(validateRunRecord(record).errors).toContain('duplicate effect key "run-sample#0#0" — the idempotency key must be unique within a run');
  });

  it('effectKey is (run, step, ordinal) — the ordinal is what makes a PARTIAL replay exact (#2964)', () => {
    expect(effectKey('run-1', 3, 0)).toBe('run-1#3#0');
    expect(effectKey('run-1', 3, 1)).toBe('run-1#3#1');
  });

  it('assertRunRecord throws carrying the errors', () => {
    expect(() => assertRunRecord({}, 'thing')).toThrow(/operations: thing is invalid — /);
  });
});

describe('a corrupt record is REFUSED, never read as absent', () => {
  it.each([
    ['empty', '', /is empty/],
    ['whitespace', '   \n', /is empty/],
    ['torn json', '{"v":1,"id":"run-x","op":"a","inp', /not parseable JSON/],
    ['valid json, wrong shape', '{"hello":"world"}', /unsupported run record version/],
    ['a JSON array', '[]', /run record must be an object/],
    ['a future schema version', '{"v":2,"id":"run-x","op":"a","input":{},"cursor":0,"findings":{},"verdict":null,"effects":[],"pending":null}', /unsupported run record version 2/],
  ])('%s → corrupt', (_label, text, pattern) => {
    const parsed = parseRunRecord(text);
    expect(parsed.ok).toBe(false);
    expect(parsed.corrupt).toBe(true);
    expect(parsed.reason).toMatch(pattern);
  });

  it('tryReadRun THROWS on a corrupt file rather than returning null (which would restart the run)', () => {
    writeFileSync(join(dir, 'run-torn.json'), '{"v":1,"id":"run-torn"');
    expect(() => tryReadRun('run-torn', dir)).toThrow(/refusing to read run run-torn[\s\S]*never treated as a run that does not exist/);
  });

  it('tryReadRun returns null ONLY when the file genuinely does not exist', () => {
    expect(tryReadRun('run-missing', dir)).toBeNull();
    expect(() => readRun('run-missing', dir)).toThrow(/no run record for "run-missing"/);
  });

  it('the in-memory store refuses a corrupt record just as the file store does', () => {
    const store = createMemoryRunStore();
    expect(() => store.write({ id: 'bad' })).toThrow(/is invalid/);
  });
});

describe('the fs shell', () => {
  it('writes atomically and leaves no temp file behind', () => {
    writeRun(sample(), dir);
    expect(readdirSync(dir)).toEqual(['run-sample.json']);
    expect(JSON.parse(readFileSync(join(dir, 'run-sample.json'), 'utf8'))).toEqual(sample());
  });

  it('round-trips through the file store handle', () => {
    const store = createFileRunStore(dir);
    store.write(sample());
    expect(store.read('run-sample')).toEqual(sample());
    expect(store.list()).toEqual(['run-sample']);
    store.delete('run-sample');
    expect(store.read('run-sample')).toBeNull();
    expect(() => store.delete('run-sample')).not.toThrow();
  });

  it('lists only well-formed run files, ignoring temp and stray names', () => {
    writeRun(sample(), dir);
    writeFileSync(join(dir, 'run-sample.json.123.tmp'), 'x');
    writeFileSync(join(dir, 'notes.txt'), 'x');
    expect(listRunIds(dir)).toEqual(['run-sample']);
    expect(listRunIds(join(dir, 'nope'))).toEqual([]);
  });

  it('resolves the sidecar by SCRIPT location, and OPERATION_RUNS_DIR overrides it', () => {
    const previous = process.env.OPERATION_RUNS_DIR;
    try {
      delete process.env.OPERATION_RUNS_DIR;
      expect(resolveRunsDir()).toBe(runsDir());
      expect(runsDir()).toMatch(/[/\\]\.operations[/\\]runs$/);
      process.env.OPERATION_RUNS_DIR = dir;
      expect(resolveRunsDir()).toBe(dir);
    } finally {
      if (previous === undefined) delete process.env.OPERATION_RUNS_DIR;
      else process.env.OPERATION_RUNS_DIR = previous;
    }
  });

  it('creates the runs directory on first write', () => {
    const nested = join(dir, 'deep', 'runs');
    writeRun(sample(), nested);
    expect(readdirSync(nested)).toEqual(['run-sample.json']);
  });

  it('mints distinct, filename-safe run ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newRunId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(isValidRunId(id)).toBe(true);
  });

  it('deleteRun on a directory that does not exist is a no-op', () => {
    mkdirSync(join(dir, 'empty'), { recursive: true });
    expect(() => deleteRun('run-nope', join(dir, 'empty'))).not.toThrow();
  });
});
