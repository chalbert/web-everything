/**
 * @file delivery-report-cli.test.mjs — the delivery-report CLI's report/show core (#3627 design prototype).
 * Mirrors `we:scripts/operations/__tests__/completion-cli.test.mjs`'s crash-survives-as-started coverage.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';

import { parseFilesFlag, parseLearningFlags, runReport, runShow } from '../delivery-report-cli.mjs';
import { tryReadDeliveryReport } from '../delivery-report-store.mjs';

let dir;
let previousDir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'we-op-delivery-report-cli-'));
  previousDir = process.env.OPERATION_DELIVERY_REPORTS_DIR;
  process.env.OPERATION_DELIVERY_REPORTS_DIR = dir;
});
afterEach(() => {
  if (previousDir === undefined) delete process.env.OPERATION_DELIVERY_REPORTS_DIR;
  else process.env.OPERATION_DELIVERY_REPORTS_DIR = previousDir;
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
    const { changed, record } = runReport({ session: 'deliver-3627', item: '3627', status: 'started' });
    expect(changed).toBe(true);
    expect(record.status).toBe('started');
    expect(runShow({ session: 'deliver-3627' })).toEqual({ found: true, ...record });
  });

  it('is idempotent — a retried `started` report never clobbers the first one', () => {
    const first = runReport({ session: 'deliver-1', item: '1', status: 'started' }).record;
    const second = runReport({ session: 'deliver-1', item: '1', status: 'started' });
    expect(second.changed).toBe(false);
    expect(second.record).toEqual(first);
  });

  it('refuses started with no item', () => {
    expect(() => runReport({ session: 'deliver-1', status: 'started' })).toThrow(/requires --item/);
  });
});

describe('report --status=done', () => {
  it('merges onto the existing started record, preserving startedAt', () => {
    const started = runReport({ session: 'deliver-1', item: '1', status: 'started' }).record;
    const done = runReport({ session: 'deliver-1', status: 'done', outcome: 'done', files: 'a.mjs,b.mjs' }).record;
    expect(done.status).toBe('done');
    expect(done.outcome).toBe('done');
    expect(done.filesTouched).toEqual(['a.mjs', 'b.mjs']);
    expect(done.startedAt).toBe(started.startedAt);
  });

  it('mints a record directly when no `started` report ever happened', () => {
    const done = runReport({ session: 'deliver-42', item: '42', status: 'done', outcome: 'blocked', reason: 're-blocked 99' }).record;
    expect(done.status).toBe('done');
    expect(done.outcome).toBe('blocked');
    expect(done.reason).toBe('re-blocked 99');
    expect(tryReadDeliveryReport('deliver-42').reason).toBe('re-blocked 99');
  });

  it('forwards a well-formed learning group onto the record', () => {
    runReport({ session: 'deliver-1', item: '1', status: 'started' });
    const done = runReport({
      session: 'deliver-1', status: 'done', outcome: 'done', files: 'a.mjs',
      'learning-kind': 'doc-gap', 'learning-summary': 's', 'learning-area': 'gate', 'learning-suggestion': 'fix docs',
    }).record;
    expect(done.learning).toEqual({ kind: 'doc-gap', summary: 's', area: 'gate', suggestion: 'fix docs' });
  });

  // The load-bearing behaviour from the design: the CLI itself refuses a hedge with no reason, at write
  // time — the same discipline `validateDeliveryReport` enforces, exercised here through the actual CLI path
  // a minimal delivery agent would call.
  it('refuses a `needs-human-judgment` report with no `reason` (write-time-gated, not just schema-checked)', () => {
    runReport({ session: 'deliver-1', item: '1', status: 'started' });
    expect(() => runReport({ session: 'deliver-1', status: 'done', outcome: 'needs-human-judgment' })).toThrow(/requires a non-empty `reason`/);
  });
});

describe('show', () => {
  it('reports found:false for a session with no record, not a throw', () => {
    expect(runShow({ session: 'deliver-none' })).toEqual({ found: false, session: 'deliver-none' });
  });
});

describe('a crashed dispatched agent still leaves a delivery report (mirrors #3436 done-when #3)', () => {
  it('the started report survives a crash that never reaches the done report', () => {
    runReport({ session: 'deliver-1234', item: '1234', status: 'started' });

    const simulateDispatch = () => {
      throw new Error('simulated crash: build step threw');
    };
    expect(simulateDispatch).toThrow(/simulated crash/);

    const record = tryReadDeliveryReport('deliver-1234');
    expect(record).not.toBeNull();
    expect(record.status).toBe('started');
    expect(record.outcome).toBeNull();
    expect(runShow({ session: 'deliver-1234' })).toEqual({ found: true, ...record });
  });
});
