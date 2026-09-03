/**
 * @file completion-cli.test.mjs — the completion CLI's report/show core (#3436).
 *
 * THE LOAD-BEARING TEST IN HERE is "a crashed agent still leaves a completion record" — `we:backlog/3436-*.md`
 * done-when #3 requires exactly this: the record must not depend on the dispatched agent reaching its own
 * happy-path exit. It is proven here by calling ONLY the `started` report (as the brief's very first action
 * would) and then simulating the rest of the dispatch throwing, with NO `done` report ever made — the record
 * must still be on disk and readable.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';

import { planDoneReport, runReport, runShow, sessionSlugForCompletion } from '../completion-cli.mjs';
import { tryReadCompletion } from '../completion-store.mjs';

let dir;
let previousDir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'we-op-completion-cli-'));
  previousDir = process.env.OPERATION_COMPLETIONS_DIR;
  process.env.OPERATION_COMPLETIONS_DIR = dir;
});
afterEach(() => {
  if (previousDir === undefined) delete process.env.OPERATION_COMPLETIONS_DIR;
  else process.env.OPERATION_COMPLETIONS_DIR = previousDir;
  rmSync(dir, { recursive: true, force: true });
});

describe('sessionSlugForCompletion', () => {
  it('mints the same review-<pr> / fix-<pr> grammar the dispatchers already use', () => {
    expect(sessionSlugForCompletion({ kind: 'review', pr: 701 })).toBe('review-701');
    expect(sessionSlugForCompletion({ kind: 'fix', pr: '9' })).toBe('fix-9');
  });

  it('refuses an unknown kind or a missing pr', () => {
    expect(() => sessionSlugForCompletion({ kind: 'build', pr: 1 })).toThrow(/--kind must be review or fix/);
    expect(() => sessionSlugForCompletion({ kind: 'review', pr: null })).toThrow(/--pr is required/);
  });
});

describe('report --status=started', () => {
  it('mints a fresh started record, readable back through show', () => {
    const { changed, record } = runReport({ kind: 'review', pr: '701', status: 'started' });
    expect(changed).toBe(true);
    expect(record.status).toBe('started');
    expect(runShow({ kind: 'review', pr: '701' })).toEqual({ found: true, ...record });
  });

  it('is idempotent — a retried `started` report never clobbers the first one', () => {
    const first = runReport({ session: 'fix-5', kind: 'fix', status: 'started' }).record;
    const second = runReport({ session: 'fix-5', kind: 'fix', status: 'started' });
    expect(second.changed).toBe(false);
    expect(second.record).toEqual(first);
  });

  // Review finding (#3436): a session slug (`fix-<pr>`) is reused across dispatch GENERATIONS on the same
  // PR — a fixer re-dispatched after a LATER bounce, on the same slug. `started` must start a FRESH record
  // once the prior generation is `done`, or a crash in the new generation reads back as the OLD generation's
  // stale outcome instead of "in flight" / "never finished this round".
  it('starts a FRESH record for a new dispatch generation, once the prior one is done', () => {
    runReport({ session: 'fix-5', kind: 'fix', status: 'started' });
    runReport({ session: 'fix-5', status: 'done', outcome: 'escalated-conflict' });
    const gen2 = runReport({ session: 'fix-5', kind: 'fix', status: 'started' });
    expect(gen2.changed).toBe(true);
    expect(gen2.record.status).toBe('started');
    expect(gen2.record.outcome).toBeNull(); // the prior generation's outcome must NOT leak into the new one
  });

  it('refuses started with no kind and no existing record to infer it from', () => {
    expect(() => runReport({ session: 'fix-5', status: 'started' })).toThrow(/requires --kind/);
  });
});

describe('report --status=done', () => {
  it('merges onto the existing started record, preserving startedAt', () => {
    const started = runReport({ session: 'review-9', kind: 'review', pr: '9', status: 'started' }).record;
    const done = runReport({ session: 'review-9', status: 'done', outcome: 'auto-cleared', verdict: 'accept' }).record;
    expect(done.status).toBe('done');
    expect(done.outcome).toBe('auto-cleared');
    expect(done.verdict).toBe('accept');
    expect(done.startedAt).toBe(started.startedAt);
  });

  it('mints a record directly when no `started` report ever happened', () => {
    const done = runReport({ session: 'fix-42', kind: 'fix', status: 'done', outcome: 'gate-red' }).record;
    expect(done.status).toBe('done');
    expect(done.outcome).toBe('gate-red');
    expect(tryReadCompletion('fix-42').outcome).toBe('gate-red');
  });
});

describe('show', () => {
  it('reports found:false for a session with no record, not a throw', () => {
    expect(runShow({ session: 'review-none' })).toEqual({ found: false, session: 'review-none' });
  });
});

describe('a crashed dispatched agent still leaves a completion record (done-when #3)', () => {
  it('the started report survives a crash that never reaches the done report', () => {
    // Exactly what the brief's arc does: report `started` as the very first action...
    runReport({ session: 'review-1234', kind: 'review', pr: '1234', status: 'started' });

    // ...then the rest of the dispatch (acquiring a lane, running the review loop) throws, exactly as a
    // genuine crash or a refused effect would — no `done` report is EVER made.
    const simulateDispatch = () => {
      throw new Error('simulated crash: lane acquire refused');
    };
    expect(simulateDispatch).toThrow(/simulated crash/);

    // The record must still be there — a reader gets "started, not yet done", never nothing at all.
    const record = tryReadCompletion('review-1234');
    expect(record).not.toBeNull();
    expect(record.status).toBe('started');
    expect(record.outcome).toBeNull();
    expect(runShow({ kind: 'review', pr: '1234' })).toEqual({ found: true, ...record });
  });

  it('planDoneReport tolerates a missing existing record (the report-itself-crashed-before-started case)', () => {
    const record = planDoneReport({ existing: null, session: 'fix-7', kind: 'fix', pr: '7', item: null, patch: { outcome: 'blocked-on-infra' }, now: () => '2026-09-03T02:00:00.000Z' });
    expect(record.status).toBe('done');
    expect(record.outcome).toBe('blocked-on-infra');
    expect(record.startedAt).toBe('2026-09-03T02:00:00.000Z');
  });
});
