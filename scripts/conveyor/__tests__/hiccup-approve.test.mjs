/**
 * @file scripts/conveyor/__tests__/hiccup-approve.test.mjs
 * @description Unit proof of the #3421 approval store: an entry starts unapproved, `approveEntry` records
 *   an explicit approval keyed by `<session>#<ts>`, and `isApproved` reflects it — the mechanism
 *   `learnings-harvest.mjs`'s gate reads to decide whether a blocking entry may re-enter candidates.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { approvalsPath, readApprovals, approvalKey, isApproved, approveEntry } from '../hiccup-approve.mjs';

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'we-hiccup-approve-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('approvalsPath', () => {
  it('an explicit dir wins over the machine-fixed default (test isolation)', () => {
    expect(approvalsPath({ dir })).toBe(join(dir, 'approvals.json'));
  });
  it('falls back to the machine-fixed pool when no dir is given', () => {
    expect(approvalsPath({ env: {}, home: '/home/u' })).toBe('/home/u/.claude/conveyor/learnings/approvals.json');
  });
});

describe('readApprovals — absent/malformed is the empty case, never fatal', () => {
  it('an absent store reads as {}', () => {
    expect(readApprovals(join(dir, 'nope.json'))).toEqual({});
  });
});

describe('approve → isApproved round-trip', () => {
  it('an entry is unapproved before, approved after', () => {
    const entry = { session: 'conveyor-runner', ts: '2026-09-01T00:00:00.000Z' };
    expect(isApproved(entry, readApprovals(approvalsPath({ dir })))).toBe(false);

    const { path, key } = approveEntry(entry, { dir, now: '2026-09-02T00:00:00.000Z' });
    expect(existsSync(path)).toBe(true);
    expect(key).toBe(approvalKey(entry));

    const approvals = readApprovals(path);
    expect(isApproved(entry, approvals)).toBe(true);
    expect(approvals[key].approvedAt).toBe('2026-09-02T00:00:00.000Z');
  });

  it('a second, different entry does not disturb the first (accumulates, never overwrites the store)', () => {
    approveEntry({ session: 'a', ts: '2026-09-01T00:00:00.000Z' }, { dir });
    approveEntry({ session: 'b', ts: '2026-09-01T00:00:00.000Z' }, { dir });
    const approvals = readApprovals(approvalsPath({ dir }));
    expect(Object.keys(approvals)).toHaveLength(2);
    expect(isApproved({ session: 'a', ts: '2026-09-01T00:00:00.000Z' }, approvals)).toBe(true);
    expect(isApproved({ session: 'b', ts: '2026-09-01T00:00:00.000Z' }, approvals)).toBe(true);
  });

  it('approveEntry requires both session and ts', () => {
    expect(() => approveEntry({ session: 'a' }, { dir })).toThrow(/required/);
    expect(() => approveEntry({ ts: '2026-09-01T00:00:00.000Z' }, { dir })).toThrow(/required/);
  });
});
