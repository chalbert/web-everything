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
  isReadyToLand,
  isReviewSignedOff,
  isRequiredCheckGreen,
  watchPr,
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

// ── #2683 EVENT-DRIVEN LAND — the ready-to-land trigger fires the fast drain ────────────────────────────────

const GREEN = [{ name: 'test', conclusion: 'SUCCESS' }];
const RED = [{ name: 'test', conclusion: 'FAILURE' }];

describe('isRequiredCheckGreen (#2683 — the trigger reads CI truth like the drain does)', () => {
  it('SUCCESS on the required check → green', () => {
    expect(isRequiredCheckGreen({ statusCheckRollup: GREEN })).toBe(true);
  });
  it('a missing/failed required check → NOT green (never a false green)', () => {
    expect(isRequiredCheckGreen({ statusCheckRollup: [] })).toBe(false);
    expect(isRequiredCheckGreen({ statusCheckRollup: RED })).toBe(false);
  });
});

describe('isReviewSignedOff (#2683 — the non-author sign-off precondition)', () => {
  it('APPROVED → signed off', () => {
    expect(isReviewSignedOff({ reviewDecision: 'APPROVED' })).toBe(true);
  });
  it('an EMPTY/absent decision → no review required, nothing to wait on', () => {
    expect(isReviewSignedOff({ reviewDecision: '' })).toBe(true);
    expect(isReviewSignedOff({})).toBe(true);
  });
  it('REVIEW_REQUIRED / CHANGES_REQUESTED → NOT signed off', () => {
    expect(isReviewSignedOff({ reviewDecision: 'REVIEW_REQUIRED' })).toBe(false);
    expect(isReviewSignedOff({ reviewDecision: 'CHANGES_REQUESTED' })).toBe(false);
  });
});

describe('isReadyToLand (#2683 — the LAST-precondition predicate)', () => {
  it('OPEN + CI green + review signed off → ready', () => {
    expect(isReadyToLand({ state: 'OPEN', statusCheckRollup: GREEN, reviewDecision: 'APPROVED' })).toBe(true);
  });
  it('green but review not yet signed off → NOT ready (review-after-green case)', () => {
    expect(isReadyToLand({ state: 'OPEN', statusCheckRollup: GREEN, reviewDecision: 'REVIEW_REQUIRED' })).toBe(false);
  });
  it('signed off but CI not yet green → NOT ready (green-after-review case)', () => {
    expect(isReadyToLand({ state: 'OPEN', statusCheckRollup: RED, reviewDecision: 'APPROVED' })).toBe(false);
  });
  it('a parked PR (uncleared review:* label) is never ready — it exits parked, not fast-drained', () => {
    expect(isReadyToLand({ state: 'OPEN', statusCheckRollup: GREEN, reviewDecision: 'APPROVED', labels: [{ name: 'review:human' }] })).toBe(false);
  });
  it('a merged/closed PR is never ready (terminal — nothing to trigger)', () => {
    expect(isReadyToLand({ state: 'MERGED', statusCheckRollup: GREEN, reviewDecision: 'APPROVED' })).toBe(false);
    expect(isReadyToLand({ state: 'CLOSED', statusCheckRollup: GREEN, reviewDecision: 'APPROVED' })).toBe(false);
  });
});

describe('watchPr — fires the fast drain on the ready-transition (#2683)', () => {
  const noSleep = async () => {};
  const clockFrom = (steps) => { let t = 0; return () => (t += steps); };

  it('fires on whichever precondition completes LAST (review after green) — exactly once, then exits on merge', async () => {
    // poll 1: green, review still required → NOT ready. poll 2: review signs off → ready (LAST precondition) →
    // FIRE. poll 3: still ready (not merged yet) → must NOT re-fire. poll 4: merged → exit.
    const polls = [
      { state: 'OPEN', statusCheckRollup: GREEN, reviewDecision: 'REVIEW_REQUIRED', labels: [] },
      { state: 'OPEN', statusCheckRollup: GREEN, reviewDecision: 'APPROVED', labels: [] },
      { state: 'OPEN', statusCheckRollup: GREEN, reviewDecision: 'APPROVED', labels: [] },
      { state: 'MERGED', mergedAt: '2026-07-26T00:00:00Z', labels: [] },
    ];
    let i = 0;
    const pollOnce = async () => polls[i++];
    let fires = 0;
    const code = await watchPr({ pollOnce, sleep: noSleep, now: clockFrom(1), intervalMs: 1, deadlineMs: 1e9, fireFastDrain: async () => { fires++; } });
    expect(code).toBe(EXIT_MERGED);
    expect(fires).toBe(1); // fired once on the review-after-green transition, never re-fired while still ready
  });

  it('does NOT fire while the gate is incomplete (green-only), and re-fires after a ready→not-ready→ready dip', async () => {
    const polls = [
      { state: 'OPEN', statusCheckRollup: GREEN, reviewDecision: 'REVIEW_REQUIRED', labels: [] }, // not ready
      { state: 'OPEN', statusCheckRollup: GREEN, reviewDecision: 'APPROVED', labels: [] },        // ready → fire
      { state: 'OPEN', statusCheckRollup: RED, reviewDecision: 'APPROVED', labels: [] },          // CI restarted → not ready
      { state: 'OPEN', statusCheckRollup: GREEN, reviewDecision: 'APPROVED', labels: [] },        // ready again → fire
      { state: 'MERGED', mergedAt: 'x', labels: [] },
    ];
    let i = 0;
    let fires = 0;
    const code = await watchPr({ pollOnce: async () => polls[i++], sleep: noSleep, now: clockFrom(1), intervalMs: 1, deadlineMs: 1e9, fireFastDrain: async () => { fires++; } });
    expect(code).toBe(EXIT_MERGED);
    expect(fires).toBe(2);
  });

  it('a fire failure never kills the watch (best-effort — daemon sweep is the backstop)', async () => {
    const polls = [
      { state: 'OPEN', statusCheckRollup: GREEN, reviewDecision: 'APPROVED', labels: [] },
      { state: 'MERGED', mergedAt: 'x', labels: [] },
    ];
    let i = 0;
    const code = await watchPr({ pollOnce: async () => polls[i++], sleep: noSleep, now: clockFrom(1), intervalMs: 1, deadlineMs: 1e9, fireFastDrain: async () => { throw new Error('drain boom'); } });
    expect(code).toBe(EXIT_MERGED);
  });

  it('never fires when fireFastDrain is null (--no-fast-drain) — pure daemon-sweep cadence', async () => {
    const polls = [
      { state: 'OPEN', statusCheckRollup: GREEN, reviewDecision: 'APPROVED', labels: [] },
      { state: 'MERGED', mergedAt: 'x', labels: [] },
    ];
    let i = 0;
    const code = await watchPr({ pollOnce: async () => polls[i++], sleep: noSleep, now: clockFrom(1), intervalMs: 1, deadlineMs: 1e9, fireFastDrain: null });
    expect(code).toBe(EXIT_MERGED);
  });

  it('a parked PR exits parked (never fires the fast drain)', async () => {
    let fires = 0;
    const code = await watchPr({
      pollOnce: async () => ({ state: 'OPEN', mergedAt: null, statusCheckRollup: GREEN, reviewDecision: 'APPROVED', labels: [{ name: 'review:human' }] }),
      sleep: noSleep, now: clockFrom(1), intervalMs: 1, deadlineMs: 1e9, fireFastDrain: async () => { fires++; },
    });
    expect(code).toBe(EXIT_PARKED);
    expect(fires).toBe(0);
  });
});
