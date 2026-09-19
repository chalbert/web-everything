/**
 * @file scripts/__tests__/guard-prototype-tracker.test.mjs
 * @description Proof of the #3383 "can't forget" pre-push + SessionStart guard. Mirrors
 *   `guard-git-push.test.mjs`'s split: git/fs are the I/O boundary, exercised nowhere here; every decision
 *   function is pure and tested directly on hand-built inputs.
 */
import { describe, it, expect } from 'vitest';
import {
  protectedBranchNames, protectedPushLines, daysBetween, staleTrackerPushDecision, sessionStartReminder,
  FRESH_DAYS,
} from '../guard-prototype-tracker.mjs';

const REGISTRY = {
  branches: [
    { branch: 'lane/mechanical-dispatcher', owner: '3383' },
    { branch: 'lane/some-other-epic', owner: '9999' },
  ],
};

const line = (localRef, localSha, remoteRef, remoteSha) => `${localRef} ${localSha} ${remoteRef} ${remoteSha}`;
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const ZEROS = '0'.repeat(40);

describe('protectedBranchNames', () => {
  it('returns only branches owned by the given epic', () => {
    expect(protectedBranchNames(REGISTRY, '3383')).toEqual(['lane/mechanical-dispatcher']);
  });
  it('returns [] when nothing is registered for that owner', () => {
    expect(protectedBranchNames(REGISTRY, '4242')).toEqual([]);
  });
  it('tolerates an empty/malformed registry', () => {
    expect(protectedBranchNames({}, '3383')).toEqual([]);
    expect(protectedBranchNames(null, '3383')).toEqual([]);
  });
});

describe('protectedPushLines', () => {
  const branches = ['lane/mechanical-dispatcher'];
  it('matches a push whose remoteRef targets a protected branch', () => {
    const stdin = line('HEAD', SHA_A, 'refs/heads/lane/mechanical-dispatcher', SHA_B);
    const matched = protectedPushLines(stdin, branches);
    expect(matched).toHaveLength(1);
    expect(matched[0]).toMatchObject({ branch: 'lane/mechanical-dispatcher', localSha: SHA_A, remoteSha: SHA_B });
  });
  it('does NOT match a push to an unrelated branch', () => {
    const stdin = line('HEAD', SHA_A, 'refs/heads/lane/unrelated-thing', SHA_B);
    expect(protectedPushLines(stdin, branches)).toEqual([]);
  });
  it('matches even when a mixed batch also pushes an unrelated ref', () => {
    const stdin = [
      line('HEAD', SHA_A, 'refs/heads/lane/unrelated-thing', SHA_B),
      line('refs/heads/lane/mechanical-dispatcher', SHA_A, 'refs/heads/lane/mechanical-dispatcher', SHA_B),
    ].join('\n');
    expect(protectedPushLines(stdin, branches)).toHaveLength(1);
  });
  it('ignores blank/malformed lines and an empty payload', () => {
    expect(protectedPushLines('\n  \nfoo bar\n', branches)).toEqual([]);
    expect(protectedPushLines('', branches)).toEqual([]);
  });
});

describe('daysBetween', () => {
  it('counts whole calendar days forward', () => {
    expect(daysBetween('2026-09-13', '2026-09-14')).toBe(1);
    expect(daysBetween('2026-09-10', '2026-09-14')).toBe(4);
  });
  it('is 0 for the same day', () => {
    expect(daysBetween('2026-09-14', '2026-09-14')).toBe(0);
  });
});

describe('staleTrackerPushDecision', () => {
  const matchedLines = [{ branch: 'lane/mechanical-dispatcher' }];
  const base = { matchedLines, todayDate: '2026-09-15' };

  it('ALLOWS when nothing pushed targets a protected branch', () => {
    expect(staleTrackerPushDecision({ ...base, matchedLines: [], trackerLatestDate: '2026-09-01', touchesTracker: false })).toBeNull();
  });
  it('ALLOWS when this very push touches the tracker file', () => {
    expect(staleTrackerPushDecision({ ...base, trackerLatestDate: '2026-09-01', touchesTracker: true })).toBeNull();
  });
  it('ALLOWS a brand-new branch push (nothing to diff against yet)', () => {
    expect(staleTrackerPushDecision({ ...base, trackerLatestDate: '2026-09-01', touchesTracker: false, isNewBranchPush: true })).toBeNull();
  });
  it('ALLOWS when the tracker date could not be determined (never block on uncertainty)', () => {
    expect(staleTrackerPushDecision({ ...base, trackerLatestDate: null, touchesTracker: false })).toBeNull();
  });
  it(`ALLOWS when the tracker is within the ${FRESH_DAYS}-day grace window`, () => {
    expect(staleTrackerPushDecision({ ...base, trackerLatestDate: '2026-09-14', touchesTracker: false })).toBeNull();
  });
  it('BLOCKS when the tracker is stale and this push does not touch it', () => {
    const r = staleTrackerPushDecision({ ...base, trackerLatestDate: '2026-09-10', touchesTracker: false });
    expect(r).toMatch(/BLOCKED/);
    expect(r).toMatch(/lane\/mechanical-dispatcher/);
    expect(r).toMatch(/2026-09-10/);
    expect(r).toMatch(/PROTOTYPE_TRACKER_PUSH_OK=1/);
  });
  it('ALLOWS a stale push when the override env is set', () => {
    expect(staleTrackerPushDecision({ ...base, trackerLatestDate: '2026-09-10', touchesTracker: false, override: true })).toBeNull();
  });
});

describe('sessionStartReminder', () => {
  const branches = ['lane/mechanical-dispatcher'];
  it('returns a reminder naming the branch when on a protected branch', () => {
    const msg = sessionStartReminder('lane/mechanical-dispatcher', branches);
    expect(msg).toMatch(/epic #3383/);
    expect(msg).toMatch(/lane\/mechanical-dispatcher/);
    expect(msg).toMatch(/ENFORCED/);
  });
  it('returns null on an unrelated branch', () => {
    expect(sessionStartReminder('main', branches)).toBeNull();
    expect(sessionStartReminder('', branches)).toBeNull();
  });
});
