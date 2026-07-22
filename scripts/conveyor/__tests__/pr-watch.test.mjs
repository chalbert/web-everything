/**
 * @file scripts/conveyor/__tests__/pr-watch.test.mjs
 * @description Unit proof of the conveyor MERGE WATCHER's PURE core (WE #2608). Drives {@link classifyPr}
 *   directly with plain `gh pr view` fixtures (NO gh/network) and pins every terminal-vs-pending branch of the
 *   watcher verdict — merged, parked (review:human / review:pending / closed-unmerged), and still-open-pending —
 *   plus the merged-wins precedence and the exit-code mapping the conveyor skill reads.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyPr,
  exitCodeForVerdict,
  EXIT_MERGED,
  EXIT_PARKED,
  EXIT_TIMEOUT,
} from '../pr-watch.mjs';

describe('classifyPr — MERGED (the drain landed it; the lane is free)', () => {
  it('state MERGED → merged', () => {
    expect(classifyPr({ state: 'MERGED', mergedAt: '2026-07-22T10:00:00Z', labels: [] })).toBe('merged');
  });

  it('mergedAt set even if state casing differs → merged', () => {
    expect(classifyPr({ state: 'merged', mergedAt: '2026-07-22T10:00:00Z' })).toBe('merged');
  });

  it('merged WINS over a stray park label still on the PR', () => {
    expect(
      classifyPr({ state: 'MERGED', mergedAt: '2026-07-22T10:00:00Z', labels: [{ name: 'review:human' }] }),
    ).toBe('merged');
  });
});

describe('classifyPr — PARKED (terminal; the main session must handle it)', () => {
  it('open PR labelled review:human → parked', () => {
    expect(classifyPr({ state: 'OPEN', mergedAt: null, labels: [{ name: 'review:human' }] })).toBe('parked');
  });

  it('open PR labelled review:pending → parked', () => {
    expect(classifyPr({ state: 'OPEN', mergedAt: null, labels: [{ name: 'review:pending' }] })).toBe('parked');
  });

  it('bare-string labels array is tolerated (not only [{name}])', () => {
    expect(classifyPr({ state: 'OPEN', mergedAt: null, labels: ['ready-to-merge', 'review:human'] })).toBe(
      'parked',
    );
  });

  it('CLOSED without merging (mergedAt null, no park label) → parked (terminal, wake the session)', () => {
    expect(classifyPr({ state: 'CLOSED', mergedAt: null, labels: [] })).toBe('parked');
  });
});

describe('classifyPr — PENDING (still in flight; keep polling)', () => {
  it('open PR with only ready-to-merge (queued, not yet landed) → pending', () => {
    expect(classifyPr({ state: 'OPEN', mergedAt: null, labels: [{ name: 'ready-to-merge' }] })).toBe('pending');
  });

  it('open PR with no labels → pending', () => {
    expect(classifyPr({ state: 'OPEN', mergedAt: null, labels: [] })).toBe('pending');
  });

  it('null / missing PR object (no poll data yet) → pending, never a false exit', () => {
    expect(classifyPr(null)).toBe('pending');
    expect(classifyPr(undefined)).toBe('pending');
    expect(classifyPr({})).toBe('pending');
  });
});

describe('exitCodeForVerdict — the exit contract the conveyor skill reads', () => {
  it('merged → EXIT_MERGED (0); parked → EXIT_PARKED (2); pending → null (loop continues)', () => {
    expect(exitCodeForVerdict('merged')).toBe(EXIT_MERGED);
    expect(exitCodeForVerdict('parked')).toBe(EXIT_PARKED);
    expect(exitCodeForVerdict('pending')).toBe(null);
  });

  it('the three exit codes are distinct (merged / parked / timeout)', () => {
    expect(new Set([EXIT_MERGED, EXIT_PARKED, EXIT_TIMEOUT]).size).toBe(3);
  });
});
