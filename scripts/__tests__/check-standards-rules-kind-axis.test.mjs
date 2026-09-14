/**
 * @file scripts/__tests__/check-standards-rules-kind-axis.test.mjs
 * @description The backlog `kind` axis vocabulary (#3567 adds `investigation` as a third non-build
 *   lifecycle beside `decision`) — `BACKLOG_KINDS`, `isGroupingKind`, `isExecKind`.
 */
import { describe, it, expect } from 'vitest';
import { BACKLOG_KINDS, isGroupingKind, isExecKind, validateBacklogItem } from '../check-standards-rules.mjs';

describe('BACKLOG_KINDS — the merged nature+hierarchy axis (#466/#487/#2691/#3567)', () => {
  it('includes investigation alongside story/epic/task/decision/feature', () => {
    expect(BACKLOG_KINDS).toEqual(new Set(['story', 'epic', 'task', 'decision', 'feature', 'investigation']));
  });
});

describe('isGroupingKind — investigation is NOT a grouping (container) kind', () => {
  it('is false for investigation — it has no children of its own by definition', () => {
    expect(isGroupingKind('investigation')).toBe(false);
  });
  it('stays true only for epic/feature', () => {
    expect(isGroupingKind('epic')).toBe(true);
    expect(isGroupingKind('feature')).toBe(true);
    expect(isGroupingKind('story')).toBe(false);
    expect(isGroupingKind('decision')).toBe(false);
  });
});

describe('isExecKind — investigation is a real (non-decision) kind on the exec axis', () => {
  it('is true for investigation, same as every kind except decision', () => {
    expect(isExecKind('investigation')).toBe(true);
    expect(isExecKind('decision')).toBe(false);
  });
});

describe('a well-formed kind:investigation item validates clean with NO scope and NO size (red-team #3567)', () => {
  it('a minimal investigation item — title/summary/dateOpened only — passes validateBacklogItem with zero errors', () => {
    const item = {
      id: 'x999999-test-investigation', kind: 'investigation', status: 'open',
      file: 'backlog/x999999-test-investigation.md',
      title: 'Test investigation', summary: 'a test investigation item', dateOpened: '2026-09-08',
    };
    const res = validateBacklogItem(item, { kindByNum: new Map(), items: new Map() });
    expect(res.errors).toEqual([]);
  });
});
