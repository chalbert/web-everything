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

  // #4309 — lines the throttle passthrough logged with GitHub's own X-Ratelimit headers (`rl`).
  const RESET = Date.parse('2026-09-27T06:19:57Z') / 1000;
  const measured = (minAgo, used, caller, op = 'pr view') => ({
    ts: at(minAgo), op, outcome: 'call', ok: true, caller, resource: 'graphql', id: 'app', inv: `${caller}-${used}`,
    rl: [{ used, rem: 6100 - used, limit: 6100, reset: RESET, res: 'graphql' }],
  });

  it('attributed points beat the static estimate where a line carries rl; the rest stays estimated', () => {
    const entries = [
      measured(20, 5000, 'session:aaaa1111'), // bare baseline
      measured(19, 5040, 'session:aaaa1111', 'pr list'), // +40: a `pr list` the static table would call 3
      { ts: at(18.5), op: 'pr list', outcome: 'call', ok: true, caller: 'review-daemon.mjs', resource: 'graphql', id: 'app' },
      measured(18, 5100, 'drain-daemon.mjs', 'pr list'), // +60 → 50 attributed (cap), 10 residual for the daemon's estimate
    ];
    const s = summarizeGraphqlSpend(entries, { now: NOW });
    expect(s.byCaller['session:aaaa1111']).toBe(41); // 40 attributed + ~1 for the bare-baseline call's own unknown cost
    expect(s.byCaller['drain-daemon.mjs']).toBe(50);
    expect(s.attributed).toBe(90);
    expect(s.estimated).toBeGreaterThan(0);
    expect(s.attributed + s.estimated + s.unattributed).toBe(100); // the bucket's observed `used` change
    expect(s.topCallers.find((c) => c.name === 'review-daemon.mjs').estimate).toBe(true);
    expect(s.topCallers.find((c) => c.name === 'drain-daemon.mjs').estimate).toBe(false);
  });

  it('measure carries attributed / estimated / unattributed / topOps, and the breach text names the top 3 callers with points and requests', () => {
    const entries = [...calls(), measured(20, 5000, 'session:aaaa1111'), measured(10, 5030, 'session:aaaa1111', 'pr view')];
    const graphqlBudget = { sample: { remaining: 900, limit: 6100, resetAt: '2026-09-27T06:19:57Z' }, blocks: [] };
    const [r] = smell.evaluate({ graphqlBudget, ghCalls: entries }, { now: NOW });
    expect(r.breach).toBe(true);
    expect(r.measure).toMatchObject({ attributed: 30, estimated: expect.any(Number), unattributed: expect.any(Number) });
    expect(r.measure.topOps[0]).toMatchObject({ name: 'reconcile-fix-dispatch-daemon.mjs pr list', points: 270, estimate: true, requests: 90 });
    expect(r.summary).toMatch(/top: reconcile-fix-dispatch-daemon\.mjs ~270 pts\/90 req, review-daemon\.mjs ~120 pts\/40 req, session:aaaa1111 ~31 pts\/2 req\./);
    expect(r.summary).toMatch(/header-attributed 30/);
    expect(r.recommendation).toMatch(/delta-based estimates/);
  });
});

