import { describe, it, expect } from 'vitest';
import { itemSelector, selectItemActivity } from '../item-activity.mjs';
import { newCompletionRecord, applyCompletionUpdate } from '../completion-record.mjs';

const start = '2026-10-02T10:00:00.000Z';
const done = (session = 'review-42', extra = {}) => applyCompletionUpdate(newCompletionRecord({
  session, kind: session.startsWith('inspect') ? 'inspect' : 'review', pr: '42', now: () => start,
}), { status: 'done', outcome: 'approved', ...extra }, () => '2026-10-02T11:00:00.000Z');
const row = (id, name, extra = {}) => ({ id, name, kind: 'background', state: 'working', startedAt: start, ...extra });

describe('item selection through the actual shared resolver', () => {
  it.each([{}, { pr: 2, card: '12' }, { pr: 0 }, { pr: -1 }, { pr: 1.2 }, { pr: '1e2' },
    { card: '' }, { card: 'xyz' }, { card: '0' }, { pr: 1, repo: 'fui' }])('rejects invalid selectors %j', (input) => {
    expect(() => itemSelector(input)).toThrow();
  });
  it('accepts numeric and hash cards, canonical repos and an empty successful match', () => {
    expect(itemSelector({ card: 'xabc123' })).toEqual({ card: 'xabc123' });
    expect(itemSelector({ pr: 42, repo: 'frontierui' })).toEqual({ pr: 42, repo: 'frontierui' });
    expect(selectItemActivity({ pr: 42 })).toEqual({ runs: [], gaps: [] });
  });
  it('preserves concurrent review/fix and parent inheritance, with repository-safe joins', () => {
    const rows = [row('child', null, { kind: 'subagent', parentSessionId: 'parent' }),
      row('review', 'review-42', { sessionId: 'parent' }), row('fix', 'fix-42'),
      row('foreign', 'review-fui-42'), row('direct', 'conveyor-4198'),
      row('hash', null, { kind: 'interactive', claimedNums: ['xabc123'] })];
    const facts = { rows, prToCard: { 'we:42': '4198', 'frontierui:42': '999' } };
    const pr = selectItemActivity({ pr: 42 }, facts).runs;
    expect(pr.map((r) => r.runId)).toEqual(['review', 'fix', 'child']);
    expect(pr.find((r) => r.runId === 'child')).toMatchObject({ parentRunId: 'review', joinVia: 'parent' });
    expect(selectItemActivity({ card: '4198' }, facts).runs).toHaveLength(4);
    expect(selectItemActivity({ card: 'xabc123' }, facts).runs[0].runId).toBe('hash');
    expect(selectItemActivity({ pr: 42, repo: 'frontierui' }, facts).runs[0].card).toBe('999');
    expect(selectItemActivity({ pr: 42 }, { rows: [rows[1]] }).runs[0].card).toBeNull();
  });
});

describe('completion incarnation evidence', () => {
  it('keeps terminal-only runs, inspect role and repository identity', () => {
    const result = selectItemActivity({ pr: 42, repo: 'frontierui' }, { completions: [done('review-fui-42'), done()] });
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0]).toMatchObject({ live: false, state: null, outcome: 'approved', completionStatus: 'done', runtime: null });
    expect(selectItemActivity({ pr: 42 }, { completions: [done('inspect-42')] }).runs[0].role).toBe('inspect');
  });
  it('deduplicates an exact live/completion match without turning process liveness into success', () => {
    const result = selectItemActivity({ pr: 42 }, { rows: [row('live', 'review-42', { sessionId: 's' })], completions: [done('review-42', { sessionId: 's' })] });
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0]).toMatchObject({ live: true, state: 'working', completionStatus: 'done', outcome: 'approved' });
  });
  it.each([
    { startedAt: '2026-10-02T12:00:00Z' }, { sessionId: 'foreign' }, { sessionId: null },
  ])('rejects stale/foreign evidence %j', (extra) => {
    const result = selectItemActivity({ pr: 42 }, { rows: [row('new', 'review-42', extra)], completions: [done('review-42', { sessionId: 's' })] });
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].outcome).toBeNull();
    expect(result.runs[0].evidenceGaps.join(' ')).toMatch(/rejected/);
  });
  it('rejects an old legacy completion even with no session identity', () => {
    const result = selectItemActivity({ pr: 42 }, { rows: [row('new', 'review-42', { startedAt: Date.parse(start) + 1 })], completions: [done()] });
    expect(result.runs[0].outcome).toBeNull();
  });
  it('does not assign one legacy completion to two concurrent same-slug runs', () => {
    const result = selectItemActivity({ pr: 42 }, { rows: [row('a', 'review-42'), row('b', 'review-42')], completions: [done()] });
    expect(result.runs.map((r) => r.outcome)).toEqual([null, null]);
  });
  it('preserves absent, invalid, started and unknown-outcome evidence as gaps/null', () => {
    const result = selectItemActivity({ pr: 42 }, { rows: [row('a', 'review-42')], completions: [{}] });
    expect(result.gaps.join(' ')).toMatch(/Invalid completion/);
    expect(result.runs[0].outcome).toBeNull();
    const unknown = selectItemActivity({ pr: 42 }, { completions: [done('review-42', { outcome: null })] });
    expect(unknown.runs[0].evidenceGaps.join(' ')).toMatch(/no outcome/);
    const begun = newCompletionRecord({ session: 'review-42', kind: 'review', now: () => start });
    expect(selectItemActivity({ pr: 42 }, { completions: [begun] }).runs).toEqual([]);
    expect(selectItemActivity({ pr: 42 }, { rows: [row('a', 'review-42')], completions: [begun] }).runs[0].outcome).toBeNull();
  });
});
