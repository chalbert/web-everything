/** @file Operator readiness gates and the read-only CLI report over inline gh fixtures. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { evaluatePr, main } from '../operations/operator-queue.mjs';

vi.mock('node:child_process', () => {
  const execFileSync = vi.fn();
  return { execFileSync, default: { execFileSync } };
});
afterEach(() => vi.restoreAllMocks());

const HEAD = 'fd37ce270aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const BASE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const advisory = (head = HEAD, verdict = 'approve', createdAt = '2026-09-18T12:00:00Z') => ({
  body: `**Verdict:** ${verdict}\nNet basis: \`${BASE}..${head}\``, createdAt,
});
const fixture = (overrides = {}) => ({
  number: 42, title: 'Ready for review', labels: [{ name: 'review:human' }],
  headRefOid: HEAD, mergeable: 'MERGEABLE', comments: [advisory()],
  statusCheckRollup: [{ name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' }],
  ...overrides,
});

describe('evaluatePr', () => {
  it('passes a fully ready PR without mutating it', () => {
    const pr = fixture();
    const before = structuredClone(pr);
    expect(evaluatePr(pr)).toEqual({ ready: true, reasons: [] });
    expect(pr).toEqual(before);
  });

  it.each([
    ['missing human label', { labels: [] }, 'no review:human label'],
    ['stale head', { comments: [advisory('21aaedb0b')] }, 'advisory is on 21aaedb0b, head is fd37ce270'],
    ['no advisory', { comments: [] }, 'no advisory verdict'],
    ['verdict changes', { comments: [advisory(HEAD, 'Changes requested')] }, 'changes requested'],
    ['changes label', { labels: [{ name: 'review:human' }, { name: 'review:changes' }] }, 'changes requested'],
    ['failing check', { statusCheckRollup: [{ name: 'smoke', status: 'COMPLETED', conclusion: 'FAILURE' }] }, 'CI failing: smoke'],
    ['pending check', { statusCheckRollup: [{ name: 'test', status: 'IN_PROGRESS', conclusion: null }] }, 'CI pending: test'],
    ['failed label', { labels: [{ name: 'review:human' }, { name: 'ci:failed' }] }, 'ci:failed label'],
    ['conflicting', { mergeable: 'CONFLICTING' }, 'conflicts with base'],
    ['unknown', { mergeable: 'UNKNOWN' }, 'mergeability unknown'],
    ['conflict label', { labels: [{ name: 'review:human' }, { name: 'merge-status:conflicting' }] }, 'conflicts with base'],
  ])('fails only the expected gate: %s', (_, overrides, reason) => {
    expect(evaluatePr(fixture(overrides))).toEqual({ ready: false, reasons: [reason] });
  });

  it('skips a newer escalation verdict without Net basis', () => {
    expect(evaluatePr(fixture({ comments: [advisory(), {
      body: '🚦 human review required\n**Verdict:** changes requested',
      createdAt: '2026-09-19T12:00:00Z',
    }] })).ready).toBe(true);
  });

  it('uses the most recent real advisory even if comments are out of order', () => {
    expect(evaluatePr(fixture({ comments: [
      advisory('21aaedb0b', 'changes requested', '2026-09-19T12:00:00Z'), advisory(),
    ] })).reasons).toEqual(['advisory is on 21aaedb0b, head is fd37ce270', 'changes requested']);
  });

  it.each([
    { comments: [advisory(HEAD.slice(0, 9))] },
    { headRefOid: HEAD.slice(0, 9) },
  ])('accepts a matching SHA prefix in either direction', (overrides) => {
    expect(evaluatePr(fixture(overrides)).ready).toBe(true);
  });

  it('ignores review-gate failure and accepts skipped and neutral checks', () => {
    expect(evaluatePr(fixture({ statusCheckRollup: [
      { name: 'review-gate', status: 'COMPLETED', conclusion: 'FAILURE' },
      { name: 'optional', status: 'COMPLETED', conclusion: 'SKIPPED' },
      { name: 'lint', status: 'COMPLETED', conclusion: 'NEUTRAL' },
    ] })).ready).toBe(true);
  });
});

describe('main', () => {
  it('filters out PRs without review:human and continues after a repo error', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(execFileSync).mockReset()
      .mockImplementationOnce(() => { throw new Error('unavailable'); })
      .mockReturnValueOnce(JSON.stringify([
        fixture({ number: 1, labels: [] }), fixture(), fixture({ number: 43, mergeable: 'UNKNOWN' }),
      ]));
    main(['--repo=owner/broken', '--repo=owner/good', '--json']);
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({
      ready: [{ repo: 'owner/good', number: 42, title: 'Ready for review' }],
      notReady: [{ repo: 'owner/good', number: 43, title: 'Ready for review', reasons: ['mergeability unknown'] }],
      errors: ['owner/broken: unavailable'],
    });
    expect(execFileSync).toHaveBeenLastCalledWith('gh', [
      'pr', 'list', '--repo', 'owner/good', '--state', 'open', '--limit', '200', '--json',
      'number,title,labels,headRefOid,mergeable,statusCheckRollup,comments',
    ], expect.objectContaining({ encoding: 'utf8' }));
  });

  it('prints exactly both empty sections and queries all default repos', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(execFileSync).mockReset().mockReturnValue('[]');
    main([]);
    expect(log.mock.calls.map(([line]) => line)).toEqual([
      'NEEDS YOU (review:human, all gates pass):', '(none)',
      'NOT READY — agent work (review:human but gates fail):', '(none)',
    ]);
    expect(vi.mocked(execFileSync).mock.calls.map(([, args]) => args[3])).toEqual([
      'chalbert/web-everything', 'chalbert/frontierui', 'chalbert/plateau-app',
    ]);
  });
});
