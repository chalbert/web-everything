/**
 * @file fix-report-cli.test.mjs — the fix-report CLI's report/show core (#xu2pp2m, downstream of #3627's
 * `delivery-report-cli.mjs`). Mirrors that file's own crash-survives-as-started coverage.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';

import { parseFilesFlag, parseLearningFlags, runReport, runShow } from '../fix-report-cli.mjs';
import { tryReadFixReport } from '../fix-report-store.mjs';

let dir;
let previousDir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'we-op-fix-report-cli-'));
  previousDir = process.env.OPERATION_FIX_REPORTS_DIR;
  process.env.OPERATION_FIX_REPORTS_DIR = dir;
});
afterEach(() => {
  if (previousDir === undefined) delete process.env.OPERATION_FIX_REPORTS_DIR;
  else process.env.OPERATION_FIX_REPORTS_DIR = previousDir;
  rmSync(dir, { recursive: true, force: true });
});

describe('parseFilesFlag', () => {
  it('splits a comma-joined list and trims entries', () => {
    expect(parseFilesFlag('a.mjs, b.mjs ,c.mjs')).toEqual(['a.mjs', 'b.mjs', 'c.mjs']);
  });

  it('returns null for absent/empty/boolean-true values', () => {
    expect(parseFilesFlag(undefined)).toBeNull();
    expect(parseFilesFlag('')).toBeNull();
    expect(parseFilesFlag(true)).toBeNull();
  });
});

describe('parseLearningFlags', () => {
  it('returns null when none of the four flags are given', () => {
    expect(parseLearningFlags({})).toBeNull();
  });

  it('requires all four together, never a partial group', () => {
    expect(() => parseLearningFlags({ 'learning-kind': 'friction' })).toThrow(/must all be given together/);
  });

  it('builds the sub-object when all four are given', () => {
    expect(parseLearningFlags({
      'learning-kind': 'friction', 'learning-summary': 's', 'learning-area': 'a', 'learning-suggestion': 'sg',
    })).toEqual({ kind: 'friction', summary: 's', area: 'a', suggestion: 'sg' });
  });
});

describe('report --status=started', () => {
  it('mints a fresh started record, readable back through show', () => {
    const { changed, record } = runReport({ session: 'fix-2108', pr: '2108', item: '3629', status: 'started' });
    expect(changed).toBe(true);
    expect(record.status).toBe('started');
    expect(record.pr).toBe('2108');
    expect(runShow({ session: 'fix-2108' })).toEqual({ found: true, ...record });
  });

  it('is idempotent — a retried `started` report never clobbers the first one', () => {
    const first = runReport({ session: 'fix-1', pr: '1', status: 'started' }).record;
    const second = runReport({ session: 'fix-1', pr: '1', status: 'started' });
    expect(second.changed).toBe(false);
    expect(second.record).toEqual(first);
  });

  it('refuses started with no pr', () => {
    expect(() => runReport({ session: 'fix-1', status: 'started' })).toThrow(/requires --pr/);
  });
});

describe('report --status=done', () => {
  it('merges onto the existing started record, preserving startedAt', () => {
    const started = runReport({ session: 'fix-1', pr: '1', status: 'started' }).record;
    const done = runReport({ session: 'fix-1', status: 'done', outcome: 'fixed', files: 'a.mjs,b.mjs' }).record;
    expect(done.status).toBe('done');
    expect(done.outcome).toBe('fixed');
    expect(done.filesTouched).toEqual(['a.mjs', 'b.mjs']);
    expect(done.startedAt).toBe(started.startedAt);
  });

  it('mints a record directly when no `started` report ever happened', () => {
    const done = runReport({ session: 'fix-42', pr: '42', status: 'done', outcome: 'blocked', reason: 'already fixed on main' }).record;
    expect(done.status).toBe('done');
    expect(done.outcome).toBe('blocked');
    expect(done.reason).toBe('already fixed on main');
    expect(tryReadFixReport('fix-42').reason).toBe('already fixed on main');
  });

  it('forwards a well-formed learning group onto the record', () => {
    runReport({ session: 'fix-1', pr: '1', status: 'started' });
    const done = runReport({
      session: 'fix-1', status: 'done', outcome: 'fixed', files: 'a.mjs',
      'learning-kind': 'doc-gap', 'learning-summary': 's', 'learning-area': 'rearm', 'learning-suggestion': 'fix docs',
    }).record;
    expect(done.learning).toEqual({ kind: 'doc-gap', summary: 's', area: 'rearm', suggestion: 'fix docs' });
  });

  // The load-bearing behaviour from the design: the CLI itself refuses a hedge with no reason, at write
  // time — the same discipline `validateFixReport` enforces, exercised here through the actual CLI path a
  // minimal fix agent would call.
  it.each(['blocked', 'escalated-needs-judgment', 'escalated-conflict'])(
    'refuses a `%s` report with no `reason` (write-time-gated, not just schema-checked)',
    (outcome) => {
      runReport({ session: 'fix-1', pr: '1', status: 'started' });
      expect(() => runReport({ session: 'fix-1', status: 'done', outcome })).toThrow(/requires a non-empty `reason`/);
    },
  );
});

describe('show', () => {
  it('reports found:false for a session with no record, not a throw', () => {
    expect(runShow({ session: 'fix-none' })).toEqual({ found: false, session: 'fix-none' });
  });
});

describe('a crashed dispatched fix agent still leaves a fix report (mirrors #3436 done-when #3)', () => {
  it('the started report survives a crash that never reaches the done report', () => {
    runReport({ session: 'fix-1234', pr: '1234', status: 'started' });

    const simulateDispatch = () => {
      throw new Error('simulated crash: repair step threw');
    };
    expect(simulateDispatch).toThrow(/simulated crash/);

    const record = tryReadFixReport('fix-1234');
    expect(record).not.toBeNull();
    expect(record.status).toBe('started');
    expect(record.outcome).toBeNull();
    expect(runShow({ session: 'fix-1234' })).toEqual({ found: true, ...record });
  });
});
