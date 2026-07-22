/**
 * @file scripts/conveyor/__tests__/pr-watch.test.mjs
 * @description Unit proof of the conveyor MERGE WATCHER's PURE core (WE #2608). Drives {@link classifyPr}
 *   directly with plain `gh pr view` fixtures (NO gh/network) and pins every terminal-vs-pending branch of the
 *   watcher verdict — merged, parked (review:human / review:pending / review:changes), closed-unmerged
 *   (DISTINCT from a park, at both the verdict AND the exit layer), and still-open-pending — plus the
 *   merged-wins precedence and the exit-code mapping the conveyor skill reads.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyPr,
  exitCodeForVerdict,
  EXIT_MERGED,
  EXIT_PARKED,
  EXIT_TIMEOUT,
  EXIT_CLOSED,
  EXIT_ERROR,
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

  it('open PR labelled review:changes → parked (SHOULD-FIX 2a: a bounced diff surfaces at once, not at timeout)', () => {
    expect(classifyPr({ state: 'OPEN', mergedAt: null, labels: [{ name: 'review:changes' }] })).toBe('parked');
  });

  it('open PR with BOTH review:human + review:changes → parked (either park label suffices)', () => {
    expect(
      classifyPr({ state: 'OPEN', mergedAt: null, labels: [{ name: 'review:human' }, { name: 'review:changes' }] }),
    ).toBe('parked');
  });

  it('bare-string labels array is tolerated (not only [{name}])', () => {
    expect(classifyPr({ state: 'OPEN', mergedAt: null, labels: ['ready-to-merge', 'review:human'] })).toBe(
      'parked',
    );
  });
});

describe('classifyPr — CLOSED (abandoned unmerged; DISTINCT from a review park)', () => {
  it('CLOSED without merging (mergedAt null, no park label) → closed (terminal, not parked)', () => {
    expect(classifyPr({ state: 'CLOSED', mergedAt: null, labels: [] })).toBe('closed');
  });

  it('CLOSED wins over a STALE review label — never /review a closed PR', () => {
    // A human who closes a PR that still carries `review:human` must NOT route the skill to /review (a review
    // label swap cannot land a closed PR). Closed is checked before the park label, so this reads `closed`.
    expect(classifyPr({ state: 'CLOSED', mergedAt: null, labels: [{ name: 'review:human' }] })).toBe('closed');
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
  it('merged → 0; parked → 2; closed → 4; pending → null (loop continues)', () => {
    expect(exitCodeForVerdict('merged')).toBe(EXIT_MERGED);
    expect(exitCodeForVerdict('parked')).toBe(EXIT_PARKED);
    expect(exitCodeForVerdict('closed')).toBe(EXIT_CLOSED);
    expect(exitCodeForVerdict('pending')).toBe(null);
  });

  it('closed is distinguishable from a review park at the EXIT layer (4 ≠ 2), so the skill can branch', () => {
    // SHOULD-FIX 1: the whole point of the `closed` verdict is a DIFFERENT integer than a review park, so the
    // conveyor skill can branch investigate-abandoned-lane (4) vs run-/review (2) — pin it at the exit layer,
    // not only at the verdict layer.
    expect(exitCodeForVerdict('closed')).not.toBe(exitCodeForVerdict('parked'));
    expect(exitCodeForVerdict(classifyPr({ state: 'CLOSED', mergedAt: null, labels: [] }))).toBe(EXIT_CLOSED);
    expect(
      exitCodeForVerdict(classifyPr({ state: 'OPEN', mergedAt: null, labels: [{ name: 'review:human' }] })),
    ).toBe(EXIT_PARKED);
  });

  it('all five exit codes are distinct (merged / error / parked / timeout / closed)', () => {
    expect(new Set([EXIT_MERGED, EXIT_ERROR, EXIT_PARKED, EXIT_TIMEOUT, EXIT_CLOSED]).size).toBe(5);
  });
});
