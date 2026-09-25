/**
 * @file scripts/__tests__/merge-ai-prs-stranded-sweep-wiring.test.mjs
 * @description xvr2o8r — unit proof of the DRAIN'S OWN CALL to the strict #3916 stranded-item auto-resolve
 * backstop (`runStrandedSweepStep`, exported from `../merge-ai-prs.mjs`). PR #2661 added
 * `we:scripts/backlog-stranded-sweep.mjs --apply`, but nothing called it automatically — the drain only
 * printed a hint pointing at it. This wiring runs the strict subset (`autoStrandedSweepPass`) once per pass,
 * right after the drain's existing resolve-on-land step, and this file proves the WIRING behaves correctly:
 * `--dry-run` never writes, a real pass applies and logs what it resolved, and — the whole point of this
 * item — a sweep that throws or errors is logged and the pass continues rather than failing. This does NOT
 * re-test `autoStrandedSweepPass`'s own matching logic (that is `backlog-stranded-sweep.test.mjs`'s job); every
 * test here injects a fake `sweepFn` so the drain's own huge module is never actually run end to end.
 */
import { describe, it, expect, vi } from 'vitest';
import { runStrandedSweepStep } from '../merge-ai-prs.mjs';

const okReport = (over = {}) => ({ ok: true, ran: true, autoResolvable: [], applied: [], mainLogUnavailable: false, mainLogWindowTruncated: false, mainLogLen: 0, error: null, ...over });

describe('xvr2o8r — runStrandedSweepStep: the drain\'s once-per-pass call to the strict auto-resolve backstop', () => {
  it('calls sweepFn with apply:true on a REAL (non-dry-run) pass', () => {
    const sweepFn = vi.fn(() => okReport());
    runStrandedSweepStep({ dryRun: false, asJson: true, sweepFn });
    expect(sweepFn).toHaveBeenCalledTimes(1);
    expect(sweepFn.mock.calls[0][0]).toEqual({ apply: true });
  });

  it('calls sweepFn with apply:false under --dry-run — a preview, never a write', () => {
    const sweepFn = vi.fn(() => okReport());
    runStrandedSweepStep({ dryRun: true, asJson: true, sweepFn });
    expect(sweepFn).toHaveBeenCalledTimes(1);
    expect(sweepFn.mock.calls[0][0]).toEqual({ apply: false });
  });

  it('the live case: reports #3916 and #4025 as auto-resolvable and applied on a real pass', () => {
    const report = okReport({
      autoResolvable: [
        { id: '3916', status: 'active', via: 'commit-subject "Graduate test setup … (#3916)"' },
        { id: '4025', status: 'open', via: 'commit-subject "WE #x1ydtnx: lane-pool trim … (#4025)"' },
      ],
      applied: [
        { id: '3916', flipped: true, alreadyResolved: false },
        { id: '4025', flipped: true, alreadyResolved: false },
      ],
    });
    const sweepFn = () => report;
    const log = vi.fn();
    const result = runStrandedSweepStep({ dryRun: false, asJson: false, sweepFn, log });
    expect(result).toEqual({ ok: true, ran: true, autoResolvable: report.autoResolvable, applied: report.applied, error: null });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('✓ stranded-sweep resolved #3916, #4025'));
  });

  it('a --dry-run pass logs what WOULD resolve and never calls anything that writes', () => {
    const report = okReport({
      autoResolvable: [{ id: '3916', status: 'active', via: 'commit-subject "…(#3916)"' }],
      applied: [], // dry-run: sweepFn itself never applies (its own contract), so nothing here
    });
    const log = vi.fn();
    const result = runStrandedSweepStep({ dryRun: true, asJson: false, sweepFn: () => report, log });
    expect(result.ok).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('DRY-RUN would resolve #3916'));
    expect(log.mock.calls.join('')).not.toMatch(/resolved #3916/); // never claims a write happened
  });

  it('NEVER FAILS THE PASS: a thrown sweepFn is logged and swallowed, not re-thrown', () => {
    const log = vi.fn();
    const sweepFn = () => { throw new Error('git log unavailable'); };
    expect(() => runStrandedSweepStep({ dryRun: false, asJson: false, sweepFn, log })).not.toThrow();
    const result = runStrandedSweepStep({ dryRun: false, asJson: false, sweepFn, log });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('git log unavailable');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('stranded-sweep errored — skipped this pass, logging and continuing'));
  });

  it('a report with ok:false (sweepFn\'s own internal degrade) is logged and swallowed the same way', () => {
    const log = vi.fn();
    const sweepFn = () => ({ ok: false, ran: false, autoResolvable: [], applied: [], error: 'cannot read backlog/: ENOENT' });
    const result = runStrandedSweepStep({ dryRun: false, asJson: false, sweepFn, log });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('cannot read backlog/: ENOENT');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('cannot read backlog/: ENOENT'));
  });

  it('a malformed (non-object) report from sweepFn degrades instead of crashing', () => {
    const log = vi.fn();
    const result = runStrandedSweepStep({ dryRun: false, asJson: false, sweepFn: () => undefined, log });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/non-object report/);
  });

  it('never logs when asJson:true, even on an error — the --json contract stays clean stdout/silent stderr here', () => {
    const log = vi.fn();
    runStrandedSweepStep({ dryRun: false, asJson: true, sweepFn: () => { throw new Error('boom'); }, log });
    expect(log).not.toHaveBeenCalled();
  });

  it('a pass that finds nothing auto-resolvable is a quiet no-op (no log spam every pass)', () => {
    const log = vi.fn();
    const result = runStrandedSweepStep({ dryRun: false, asJson: false, sweepFn: () => okReport(), log });
    expect(result).toEqual({ ok: true, ran: true, autoResolvable: [], applied: [], error: null });
    expect(log).not.toHaveBeenCalled();
  });

  it('mainLogUnavailable degrades to a quiet report-only line, never an error', () => {
    const log = vi.fn();
    const result = runStrandedSweepStep({ dryRun: false, asJson: false, sweepFn: () => okReport({ mainLogUnavailable: true }), log });
    expect(result.ok).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('could not read origin/main'));
  });

  it('defaults sweepFn to the real autoStrandedSweepPass when none is injected (wiring is live, not vestigial)', () => {
    // No sweepFn injected — this exercises the real default wiring against this checkout's OWN cwd/backlog.
    // We only assert it never throws and returns the expected report SHAPE; the actual matching behaviour is
    // backlog-stranded-sweep.test.mjs's job.
    const result = runStrandedSweepStep({ dryRun: true, asJson: true });
    expect(result).toHaveProperty('ok');
    expect(result).toHaveProperty('autoResolvable');
    expect(result).toHaveProperty('applied');
    expect(Array.isArray(result.autoResolvable)).toBe(true);
  });
});
