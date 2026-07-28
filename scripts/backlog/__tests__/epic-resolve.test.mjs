/**
 * @file epic-resolve.test.mjs — unit proof of the PURE epic-resolve-on-last-child verdict (#2752). Drives
 * {@link planEpicResolveOnLand} directly across every branch of the deterministic-core / thin-judgment line:
 * the clean auto-close, the not-last-child / not-an-epic / already-resolved / no-parent skips, the standing
 * program that never resolves, and the blocked/untriaged JUDGMENT cases that ESCALATE instead of closing over
 * a possibly-undelivered tail. Plus {@link hasBlockedBy}'s inline-array reading. Zero fs / git / CLI.
 */
import { describe, it, expect } from 'vitest';
import { planEpicResolveOnLand, hasBlockedBy, EPIC_ESCALATE_REASONS } from '../epic-resolve.mjs';

const epic = (over = {}) => ({
  hasParent: true, parentFound: true, kind: 'epic', status: 'open', openChildrenCount: 0, ...over,
});

describe('planEpicResolveOnLand — the clean auto-close (script-decidable)', () => {
  it('a plain epic whose every parent:-edge child is resolved → resolve, graduatedTo none implied', () => {
    expect(planEpicResolveOnLand(epic())).toEqual({ action: 'resolve', reason: 'all-children-resolved' });
  });
});

describe('planEpicResolveOnLand — skips (nothing to do, nothing a human need see)', () => {
  it('child has no parent edge → skip no-parent', () => {
    expect(planEpicResolveOnLand({ hasParent: false, parentFound: false, openChildrenCount: 0 }))
      .toEqual({ action: 'skip', reason: 'no-parent' });
  });
  it('parent edge points at a missing/re-pointed file → skip parent-missing', () => {
    expect(planEpicResolveOnLand({ hasParent: true, parentFound: false, openChildrenCount: 0 }))
      .toEqual({ action: 'skip', reason: 'parent-missing' });
  });
  it('parent is not an epic (a story with children) → skip parent-not-epic', () => {
    expect(planEpicResolveOnLand(epic({ kind: 'story' })).reason).toBe('parent-not-epic');
  });
  it('parent epic already resolved (idempotent — a sibling land already closed it) → skip already-resolved', () => {
    expect(planEpicResolveOnLand(epic({ status: 'resolved' })).reason).toBe('already-resolved');
  });
  it('NOT the last child — other parent:-edge children still open → skip open-children', () => {
    expect(planEpicResolveOnLand(epic({ openChildrenCount: 2 })).reason).toBe('open-children');
  });
  it('a STANDING program (ongoing: true) never resolves → skip standing-program', () => {
    expect(planEpicResolveOnLand(epic({ ongoing: true })).reason).toBe('standing-program');
  });
  it('a STANDING program (childlessReason: program) never resolves → skip standing-program', () => {
    expect(planEpicResolveOnLand(epic({ childlessReason: 'program' })).reason).toBe('standing-program');
  });
  it('standing-program / open-children win OVER a judgment marker (a program is a quiet skip, never an escalation)', () => {
    expect(planEpicResolveOnLand(epic({ ongoing: true, hasBlockedBy: true })).action).toBe('skip');
    expect(planEpicResolveOnLand(epic({ openChildrenCount: 1, hasBlockedBy: true })).action).toBe('skip');
  });
});

describe('planEpicResolveOnLand — ESCALATE (last child landed, but a judgment tail exists — never auto-close)', () => {
  it('a live blockedBy edge → escalate blocked-by', () => {
    expect(planEpicResolveOnLand(epic({ hasBlockedBy: true }))).toEqual({ action: 'escalate', reason: 'blocked-by' });
  });
  it('childlessReason: blocked → escalate', () => {
    expect(planEpicResolveOnLand(epic({ childlessReason: 'blocked' })))
      .toEqual({ action: 'escalate', reason: 'childless-reason:blocked' });
  });
  it('childlessReason: untriaged → escalate', () => {
    expect(planEpicResolveOnLand(epic({ childlessReason: 'untriaged' })))
      .toEqual({ action: 'escalate', reason: 'childless-reason:untriaged' });
  });
  it('EPIC_ESCALATE_REASONS is exactly {blocked, untriaged} — program is NOT here (it is a standing skip)', () => {
    expect([...EPIC_ESCALATE_REASONS].sort()).toEqual(['blocked', 'untriaged']);
    expect(EPIC_ESCALATE_REASONS.has('program')).toBe(false);
  });
});

describe('hasBlockedBy — inline-array reading', () => {
  it('a non-empty inline list is a block', () => {
    expect(hasBlockedBy('---\nkind: epic\nblockedBy: ["2606"]\n---\n\nx')).toBe(true);
    expect(hasBlockedBy('---\nblockedBy: ["2606", "2700"]\n---\n')).toBe(true);
  });
  it('an empty list / absent field is NOT a block', () => {
    expect(hasBlockedBy('---\nblockedBy: []\n---\n')).toBe(false);
    expect(hasBlockedBy('---\nkind: epic\n---\n')).toBe(false);
  });
});
