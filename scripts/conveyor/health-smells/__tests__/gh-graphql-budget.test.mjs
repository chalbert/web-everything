/**
 * @file scripts/conveyor/health-smells/__tests__/gh-graphql-budget.test.mjs
 * @description The PURE `evaluate()` of `gh-graphql-budget` over the 2026-09-27 05:26Z live shape: the App
 *   installation's real GraphQL bucket (in-band `rateLimit`) draining at ~145 points/min, and the 04:31-05:20Z
 *   exhausted/blocked shape — both must breach and NAME the top spenders; a healthy bucket stays quiet.
 */
import { describe, it, expect } from 'vitest';
import smell, { summarizeGraphqlSpend, estimateGraphqlPoints } from '../gh-graphql-budget.mjs';
import { SMELLS } from '../index.mjs';

const NOW = Date.parse('2026-09-27T05:50:00Z');
const at = (minAgo) => new Date(NOW - minAgo * 60_000).toISOString();

function calls() {
  const out = [];
  for (let i = 0; i < 90; i += 1) out.push({ ts: at(i % 29), op: 'pr list', outcome: 'call', ok: true, caller: 'reconcile-fix-dispatch-daemon.mjs' });
  for (let i = 0; i < 40; i += 1) out.push({ ts: at(i % 29), op: 'pr list', outcome: 'call', ok: true, caller: 'review-daemon.mjs' });
  for (let i = 0; i < 30; i += 1) out.push({ ts: at(i % 29), op: 'pr view', outcome: 'call', ok: true });
  for (let i = 0; i < 50; i += 1) out.push({ ts: at(i % 29), op: 'api --method', outcome: 'call', ok: true, caller: 'parked-pr-conflict-watch.mjs' }); // REST — not GraphQL
  for (let i = 0; i < 20; i += 1) out.push({ ts: at(i % 29), op: 'pr list (snapshot)', outcome: 'snapshot_hit', caller: 'x' });
  return out;
}

describe('gh-graphql-budget', () => {
  it('is registered', () => {
    expect(SMELLS.map((s) => s.id)).toContain('gh-graphql-budget');
  });

  it('estimates only GraphQL spend (REST ops and snapshot hits cost 0)', () => {
    expect(estimateGraphqlPoints({ op: 'pr list' })).toBe(3);
    expect(estimateGraphqlPoints({ op: 'pr list (snapshot)' })).toBe(1);
    expect(estimateGraphqlPoints({ op: 'api --method' })).toBe(0);
    expect(estimateGraphqlPoints({ op: 'run list' })).toBe(0);
    const s = summarizeGraphqlSpend(calls(), { now: NOW });
    expect(s.total).toBe(90 * 3 + 40 * 3 + 30);
    expect(s.top[0]).toEqual(['reconcile-fix-dispatch-daemon.mjs', 270]);
    expect(s.snapshotHits).toBe(20);
  });

  it('breaches below 20% remaining and names the top spenders + the unlogged share', () => {
    const graphqlBudget = { sample: { remaining: 900, limit: 6100, resetAt: '2026-09-27T06:19:57Z' }, blocks: [] };
    const [r] = smell.evaluate({ graphqlBudget, ghCalls: calls() }, { now: NOW });
    expect(r.breach).toBe(true);
    expect(r.summary).toMatch(/900\/6100 left/);
    expect(r.summary).toMatch(/reconcile-fix-dispatch-daemon\.mjs ~270/);
    expect(r.measure.unloggedPointsEstimate).toBe(6100 - 900 - (270 + 120 + 30));
    expect(r.recommendation).toMatch(/bypass|directly/);
  });

  it('breaches while a GraphQL budget block is active, even with no sample', () => {
    const graphqlBudget = { sample: null, blocks: [{ resource: 'graphql', untilMs: NOW + 5 * 60_000, until: '2026-09-27T05:55:00.000Z' }] };
    const [r] = smell.evaluate({ graphqlBudget, ghCalls: [] }, { now: NOW });
    expect(r.breach).toBe(true);
    expect(r.summary).toMatch(/BLOCKED until 2026-09-27T05:55/);
  });

  it('stays quiet on a healthy bucket', () => {
    const graphqlBudget = { sample: { remaining: 5000, limit: 6100, resetAt: '2026-09-27T06:19:57Z' }, blocks: [] };
    const [r] = smell.evaluate({ graphqlBudget, ghCalls: calls() }, { now: NOW });
    expect(r.breach).toBe(false);
  });
});
