/**
 * @file scripts/conveyor/health-smells/__tests__/bg-isolation-stall.test.mjs
 * @description #x9fbg1x — the PURE `evaluate()` of the `bg-isolation-stall` smell, over plain
 *   `bgIsolationStalls` fixtures shaped like `we:scripts/conveyor/health-watch.mjs#probeBgIsolationStalls`'s
 *   own return value (no fs here — see the sibling smell tests for the same no-fs convention).
 */
import { describe, it, expect } from 'vitest';
import bgIsolationStall from '../bg-isolation-stall.mjs';

describe('bg-isolation-stall.evaluate', () => {
  it('breaches on every row the probe already confirmed via transcript evidence', () => {
    const bgIsolationStalls = [{
      name: 'fix-2748', sessionId: '03bd61b3-f427-483f-9ab0-34649b75bc37',
      cwd: '/Users/op/workspace/.operations/dispatch/f6b254c8-…',
      evidence: 'This background session hasn\'t isolated its changes yet. Call EnterWorktree first…',
    }];
    const out = bgIsolationStall.evaluate({ bgIsolationStalls });
    expect(out).toHaveLength(1);
    expect(out[0].subject).toBe('fix-2748');
    expect(out[0].breach).toBe(true);
    expect(out[0].measure).toEqual({ name: 'fix-2748', sessionId: bgIsolationStalls[0].sessionId, cwd: bgIsolationStalls[0].cwd });
    expect(out[0].summary).toMatch(/EnterWorktree/);
    expect(out[0].recommendation).toMatch(/do not tell the session to run `git worktree add`/i);
  });

  it('returns nothing when the probe found no confirmed stall', () => {
    expect(bgIsolationStall.evaluate({ bgIsolationStalls: [] })).toHaveLength(0);
  });

  it('tolerates a missing/undefined probe (no-op, never throws)', () => {
    expect(bgIsolationStall.evaluate({})).toEqual([]);
  });

  it('is declared over the right probe, with alert-on-first-tick hysteresis', () => {
    expect(bgIsolationStall.id).toBe('bg-isolation-stall');
    expect(bgIsolationStall.probes).toEqual(['bgIsolationStalls']);
    expect(bgIsolationStall.openAfter).toBe(1);
    expect(bgIsolationStall.action).toBe('alert');
  });
});
