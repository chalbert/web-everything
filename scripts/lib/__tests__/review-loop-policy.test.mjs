import { describe, expect, it } from 'vitest';
import {
  reviewLoopAutoConfirm, buildAcceptQueueEntry, acceptResumeCommand, isQueuedAcceptStop, ACCEPT_QUEUE_AREA,
} from '../review-loop-policy.mjs';
import { CONFIRM_ACTORS } from '../../operations/review-pr.mjs';
import { VERDICTS } from '../jury-core.mjs';
import { FIELD_CAPS, KINDS, validateEntry } from '../../conveyor/learnings-drop.mjs';

const humanPending = { of: CONFIRM_ACTORS.HUMAN };
const agentPending = { of: CONFIRM_ACTORS.AGENT };

describe('reviewLoopAutoConfirm — the #3072/#3383/#3434 ruling, in code', () => {
  it('declines a HUMAN-addressed confirm no matter what the verdict is — UNCHANGED by #3434', () => {
    expect(reviewLoopAutoConfirm(humanPending, { verdict: { verdict: VERDICTS.CHANGES } })).toBeNull();
    expect(reviewLoopAutoConfirm(humanPending, { verdict: { verdict: VERDICTS.ACCEPT } })).toBeNull();
  });

  it('answers accept unattended for an agent-addressed clean verdict — #3434, mechanical acceptance', () => {
    expect(reviewLoopAutoConfirm(agentPending, { verdict: { verdict: VERDICTS.ACCEPT } }))
      .toEqual({ value: 'accept' });
  });

  it('answers `changes` unattended for an agent-addressed non-accept verdict', () => {
    expect(reviewLoopAutoConfirm(agentPending, { verdict: { verdict: VERDICTS.CHANGES } }))
      .toEqual({ value: 'changes' });
    expect(reviewLoopAutoConfirm(agentPending, { verdict: { verdict: VERDICTS.PREVENTION_OUTSTANDING } }))
      .toEqual({ value: 'changes' });
  });

  it('declines with no pending at all (defensive — driveRun never calls it this way today)', () => {
    expect(reviewLoopAutoConfirm(null, { verdict: { verdict: VERDICTS.CHANGES } })).toBeNull();
  });

  it('declines a missing/garbage verdict rather than answering blind', () => {
    expect(reviewLoopAutoConfirm(agentPending, {})).toEqual({ value: 'changes' });
    // No verdict at all is not `accept`, so this still answers `changes` — a run with no verdict object could
    // not have reached a `confirm` suspend for review-pr in practice (reduce always sets one), but the policy
    // does not need to assume that to stay safe: the only value it may never answer is `accept`, and `undefined
    // !== 'accept'` holds either way.
  });
});

describe('#x100grep — literal grep proof `value: \'accept\'` appears EXACTLY where #3434 put it', () => {
  it('the source returns accept from exactly one place: the agent-addressed accept-verdict branch', async () => {
    // #3434 (2026-09-01) deliberately reverses the #x100grep canary this test used to be: instead of asserting
    // `value: 'accept'` never appears (the OLD, now-superseded invariant), this pins it to appear EXACTLY
    // once, and only inside `reviewLoopAutoConfirm` itself — so a future edit can still add mechanical accept
    // to some OTHER function without this test noticing, but cannot silently make `reviewLoopAutoConfirm`
    // answer accept from more than the one reviewed, ratified branch.
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '..', 'review-loop-policy.mjs'), 'utf8');
    const matches = src.match(/value:\s*['"]accept['"]/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(src).toMatch(/VERDICTS\.ACCEPT\)\s*return\s*\{\s*value:\s*['"]accept['"]\s*\}/);
  });
});

describe('buildAcceptQueueEntry — the notification filed for a queued accept', () => {
  const entry = buildAcceptQueueEntry({ repo: 'chalbert/web-everything', pr: 1234, runId: 'r-abc123' });

  it('produces a kind learnings-drop still recognizes', () => {
    expect(KINDS).toContain(entry.kind);
  });

  it('validates clean against the live learnings-drop schema — not merely a shape this file invented', () => {
    const { ok, errors } = validateEntry(entry);
    expect(ok, errors?.join('; ')).toBe(true);
  });

  it('names the PR and carries a working resume command in `suggestion`', () => {
    expect(entry.summary).toContain('chalbert/web-everything#1234');
    expect(entry.suggestion).toContain('--resume=r-abc123');
    expect(entry.suggestion).toContain('--answer=accept');
  });

  it('stays within every field cap, for a realistic repo/pr/runId', () => {
    for (const [field, cap] of Object.entries(FIELD_CAPS)) {
      expect(entry[field].length).toBeLessThanOrEqual(cap);
    }
  });

  it('area names the operation, for a reader of the pool with no other context', () => {
    expect(entry.area).toBe(ACCEPT_QUEUE_AREA);
  });

  it('refuses rather than truncates when an input is too long to fit', () => {
    const hugeRepo = 'x'.repeat(500);
    expect(() => buildAcceptQueueEntry({ repo: hugeRepo, pr: 1, runId: 'r' })).toThrow(/over the pool's/);
  });
});

describe('acceptResumeCommand', () => {
  it('is the documented --resume=<id> --answer=accept shape, naming the PR', () => {
    const cmd = acceptResumeCommand({ runId: 'r-1', repo: 'o/r', pr: 42 });
    expect(cmd).toBe(
      'node scripts/operations/run.mjs review-pr --resume=r-1 --answer=accept # o/r#42 — clears it; '
      + '--answer=changes bounces it instead',
    );
  });
});

describe('isQueuedAcceptStop', () => {
  it('true only for an agent-addressed confirm stop whose verdict is accept', () => {
    expect(isQueuedAcceptStop({
      stopped: 'confirm',
      run: { pending: { of: CONFIRM_ACTORS.AGENT }, verdict: { verdict: VERDICTS.ACCEPT } },
    })).toBe(true);
  });

  it('false for a human-addressed confirm stop, even on accept', () => {
    expect(isQueuedAcceptStop({
      stopped: 'confirm',
      run: { pending: { of: CONFIRM_ACTORS.HUMAN }, verdict: { verdict: VERDICTS.ACCEPT } },
    })).toBe(false);
  });

  it('false for an agent-addressed confirm stop whose verdict is not accept', () => {
    expect(isQueuedAcceptStop({
      stopped: 'confirm',
      run: { pending: { of: CONFIRM_ACTORS.AGENT }, verdict: { verdict: VERDICTS.CHANGES } },
    })).toBe(false);
  });

  it('false for a non-confirm stop entirely', () => {
    expect(isQueuedAcceptStop({ stopped: 'complete', run: { verdict: { verdict: VERDICTS.ACCEPT } } })).toBe(false);
  });

  it('false for a missing outcome', () => {
    expect(isQueuedAcceptStop(null)).toBe(false);
    expect(isQueuedAcceptStop(undefined)).toBe(false);
  });
});
