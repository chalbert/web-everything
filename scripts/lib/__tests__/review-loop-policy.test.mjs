import { describe, expect, it } from 'vitest';
import {
  reviewLoopAutoConfirm, buildAcceptQueueEntry, acceptResumeCommand, isQueuedAcceptStop, ACCEPT_QUEUE_AREA,
  buildPreventionQueueEntry, isPreventionOutstandingClear, PREVENTION_QUEUE_AREA,
} from '../review-loop-policy.mjs';
import { CONFIRM_ACTORS } from '../../operations/review-pr.mjs';
import { VERDICTS } from '../jury-core.mjs';
import { FIELD_CAPS, KINDS, validateEntry } from '../../conveyor/learnings-drop.mjs';

const humanPending = { of: CONFIRM_ACTORS.HUMAN };
const agentPending = { of: CONFIRM_ACTORS.AGENT };

describe('reviewLoopAutoConfirm — the #3072/#3383/#3434 ruling, in code', () => {
  it('declines a HUMAN-addressed confirm no matter what the verdict is — UNCHANGED by #3434/#3442', () => {
    expect(reviewLoopAutoConfirm(humanPending, { verdict: { verdict: VERDICTS.CHANGES } })).toBeNull();
    expect(reviewLoopAutoConfirm(humanPending, { verdict: { verdict: VERDICTS.ACCEPT } })).toBeNull();
    expect(reviewLoopAutoConfirm(humanPending, { verdict: { verdict: VERDICTS.PREVENTION_OUTSTANDING } })).toBeNull();
  });

  it('answers accept unattended for an agent-addressed clean verdict — #3434, mechanical acceptance', () => {
    expect(reviewLoopAutoConfirm(agentPending, { verdict: { verdict: VERDICTS.ACCEPT } }))
      .toEqual({ value: 'accept' });
  });

  it('answers accept unattended for an agent-addressed prevention-outstanding verdict — #3442, no longer bounces', () => {
    // #3434's second ratified item, finished here: every finding is already resolved by definition of this
    // verdict, so the only remaining debt is an unfiled prevention guard — accept-worthy, not another round of
    // `changes` over documentation debt the code itself doesn't have.
    expect(reviewLoopAutoConfirm(agentPending, { verdict: { verdict: VERDICTS.PREVENTION_OUTSTANDING } }))
      .toEqual({ value: 'accept' });
  });

  it('answers `changes` unattended for an agent-addressed non-accept, non-prevention verdict', () => {
    expect(reviewLoopAutoConfirm(agentPending, { verdict: { verdict: VERDICTS.CHANGES } }))
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

describe('#x100grep — literal grep proof `value: \'accept\'` appears EXACTLY where #3434/#3442 put it', () => {
  it('the source returns accept from exactly the two reviewed, ratified branches', async () => {
    // #3434's FIRST ratified item narrowed this canary to exactly one occurrence; #3442 finishes its SECOND
    // ratified item (`prevention-outstanding` also auto-clears) and widens the canary to exactly two — still
    // pinned, still inside `reviewLoopAutoConfirm` only, still one `if` per verdict rather than a combined
    // condition, so each branch's own regex keeps proving THAT specific verdict is the one deciding it. A
    // future edit can still add mechanical accept to some OTHER function without this test noticing, but
    // cannot silently make `reviewLoopAutoConfirm` answer accept from a THIRD, unreviewed branch.
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '..', 'review-loop-policy.mjs'), 'utf8');
    const matches = src.match(/value:\s*['"]accept['"]/g) ?? [];
    expect(matches).toHaveLength(2);
    expect(src).toMatch(/VERDICTS\.ACCEPT\)\s*return\s*\{\s*value:\s*['"]accept['"]\s*\}/);
    expect(src).toMatch(/VERDICTS\.PREVENTION_OUTSTANDING\)\s*return\s*\{\s*value:\s*['"]accept['"]\s*\}/);
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

describe('buildPreventionQueueEntry — the notification filed per unfiled prevention guard (#3442)', () => {
  const finding = { prevention: 'add a lint rule that catches this class of defect at write-time', preventionCaptured: false };
  const entry = buildPreventionQueueEntry({ repo: 'chalbert/web-everything', pr: 1234, runId: 'r-abc123', finding });

  it('produces a kind learnings-drop still recognizes', () => {
    expect(KINDS).toContain(entry.kind);
  });

  it('validates clean against the live learnings-drop schema', () => {
    const { ok, errors } = validateEntry(entry);
    expect(ok, errors?.join('; ')).toBe(true);
  });

  it('names the PR in `summary` and carries the guard text in `suggestion`', () => {
    expect(entry.summary).toContain('chalbert/web-everything#1234');
    expect(entry.summary).toContain('PREVENTION-OUTSTANDING');
    expect(entry.suggestion).toContain('r-abc123');
    expect(entry.suggestion).toContain(finding.prevention);
  });

  it('stays within every field cap, for a realistic repo/pr/runId/guard', () => {
    for (const [field, cap] of Object.entries(FIELD_CAPS)) {
      expect(entry[field].length).toBeLessThanOrEqual(cap);
    }
  });

  it('area names the operation, for a reader of the pool with no other context', () => {
    expect(entry.area).toBe(PREVENTION_QUEUE_AREA);
  });

  it('refuses rather than truncates when an input is too long to fit', () => {
    const hugeGuard = 'x'.repeat(500);
    expect(() => buildPreventionQueueEntry({
      repo: 'o/r', pr: 1, runId: 'r', finding: { prevention: hugeGuard },
    })).toThrow(/over the pool's/);
  });
});

describe('isPreventionOutstandingClear', () => {
  const outstandingFindings = [{ prevention: 'guard A', preventionCaptured: false }];

  it('true for a non-parked outcome whose verdict is prevention-outstanding with an uncaptured guard', () => {
    expect(isPreventionOutstandingClear({
      stopped: 'complete',
      run: { verdict: { verdict: VERDICTS.PREVENTION_OUTSTANDING, findings: outstandingFindings } },
    })).toBe(true);
  });

  it('true on an effect-in-flight stop too — the accept already recorded, the PR-comment effect just has not settled', () => {
    expect(isPreventionOutstandingClear({
      stopped: 'effect-in-flight',
      run: { verdict: { verdict: VERDICTS.PREVENTION_OUTSTANDING, findings: outstandingFindings } },
    })).toBe(true);
  });

  it('false for a `confirm` stop — a review:human PR carrying this verdict is still parked, nothing to file yet', () => {
    expect(isPreventionOutstandingClear({
      stopped: 'confirm',
      run: { verdict: { verdict: VERDICTS.PREVENTION_OUTSTANDING, findings: outstandingFindings } },
    })).toBe(false);
  });

  it('false for any other verdict', () => {
    expect(isPreventionOutstandingClear({
      stopped: 'complete',
      run: { verdict: { verdict: VERDICTS.ACCEPT, findings: outstandingFindings } },
    })).toBe(false);
  });

  it('false when the verdict carries no actually-uncaptured finding (defensive — should not happen in practice)', () => {
    expect(isPreventionOutstandingClear({
      stopped: 'complete',
      run: { verdict: { verdict: VERDICTS.PREVENTION_OUTSTANDING, findings: [{ prevention: 'g', preventionCaptured: true }] } },
    })).toBe(false);
  });

  it('false for a missing outcome', () => {
    expect(isPreventionOutstandingClear(null)).toBe(false);
    expect(isPreventionOutstandingClear(undefined)).toBe(false);
  });
});
