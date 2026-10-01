/**
 * @file Regression tests for the PR #3279 review findings on the routed fix/ci-heal launch path.
 * Each case names the exact failure the reviewer described.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dispatchFix } from '../reconcile-fix-dispatch.mjs';
import { acquireFixDispatchClaim, stampFixDispatchClaim, readFixDispatchClaim, refreshLiveFixDispatchClaims } from '../fix-dispatch-claim.mjs';
import { dispatchCiHeal } from '../../operations/ci-heal-pr-dispatch.mjs';
import { DISPATCH_EFFECT } from '../../operations/dispatch-lane.mjs';
import { dispatchProviderAvailable } from '../../lib/dispatch-provider-availability.mjs';

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'fix-routing-review-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const planned = { pr: 900002, itemNum: '3209', lane: 4, laneRef: 'lane/3209-fix', scope: ['we:scripts/example.mjs'] };
const route = (provider, fallback = []) => ({ policyRoute: { provider, model: provider === 'codex' ? 'gpt-6-astra' : 'sonnet', effort: 'high', fallback } });
const base = (over = {}) => ({
  root: '/dispatcher', readBrief: () => 'Fix {{PR_NUM}} {{ITEM_NUM}} {{LANE}} {{LANE_REF}} {{SESSION_SLUG}} {{SCOPE}}.',
  claimRoot: join(dir, 'claims'), claimOwner: 'owner-1', readFixClaim: () => null,
  sessionCwdFor: () => dir, ensureSessionCwd: p => p, resolveSettingsEnv: () => null,
  providerAvailable: () => true, routeFix: () => route('claude'), mintSessionId: () => 'sid-1',
  spawnAgent: () => '', ...over,
});
const claim = () => readFixDispatchClaim({ repo: 'we', pr: planned.pr, kind: 'fix', lockRoot: join(dir, 'claims') });

describe('dispatchFix — post-launch bookkeeping never throws', () => {
  it.each([['--model=opus'], ['--model=not-in-the-catalog']])('an explicit %s pin still returns a result and stamps the claim', (pin) => {
    const result = dispatchFix(planned, base({ extraArgs: [pin], modelReason: 'explicit pin' }));
    expect(result.provider).toBe('claude');
    expect(claim().meta.handle).toBeDefined();
  });
});

describe('dispatchFix — an explicit pin is honored even when Codex is selected and available', () => {
  it('launches native Claude with the pin instead of Codex', () => {
    const argvs = [];
    const result = dispatchFix(planned, base({
      routeFix: () => route('codex', [{ provider: 'claude', model: 'sonnet', effort: 'high' }]),
      extraArgs: ['--model', 'opus'], modelReason: 'explicit pin',
      spawnCodex: () => { throw new Error('must not launch Codex'); },
      spawnAgent: (argv) => { argvs.push(argv); return ''; },
    }));
    expect(result.provider).toBe('claude');
    expect(argvs[0]).toEqual(expect.arrayContaining(['--model', 'opus']));
  });
  it('without a pin the same route still goes to Codex', () => {
    const result = dispatchFix(planned, base({ routeFix: () => route('codex'), spawnCodex: () => 'pid:7', spawnAgent: () => { throw new Error('no'); } }));
    expect(result.provider).toBe('codex');
  });
});

describe('dispatchFix — claim retention on a throwing launch', () => {
  it('a Codex spawn that throws after launch KEEPS the claim (indeterminate launch is never retried)', () => {
    expect(() => dispatchFix(planned, base({ routeFix: () => route('codex'), spawnCodex: () => { throw new Error('started without a pid; launch is indeterminate'); } }))).toThrow(/indeterminate/);
    expect(claim()).not.toBeNull();
  });
  it('a Codex spawn that throws notApplied RELEASES the claim', () => {
    const error = Object.assign(new Error('not applied'), { notApplied: true });
    expect(() => dispatchFix(planned, base({ routeFix: () => route('codex'), spawnCodex: () => { throw error; } }))).toThrow(/not applied/);
    expect(claim()).toBeNull();
  });
  it('a Claude spawn that throws before it returns RELEASES the claim', () => {
    expect(() => dispatchFix(planned, base({ spawnAgent: () => { throw new Error('spawn failed'); } }))).toThrow(/spawn failed/);
    expect(claim()).toBeNull();
  });
});

describe('claude is always launchable', () => {
  it('a quota-exhausted Claude row does not hold it (critical-scope work has no other provider)', () => {
    const records = [{ provider: 'claude', status: 'quota-exhausted', scoredAt: '2026-09-30T19:59:00Z', quotaResetsAt: '2026-09-30T21:00:00Z' }];
    const options = { env: { PATH: '' }, now: Date.parse('2026-09-30T20:00:00Z'), access: () => { throw new Error('missing'); }, records };
    expect(dispatchProviderAvailable('claude', options)).toBe(true);
    expect(dispatchProviderAvailable('codex', options)).toBe(false);
  });
});

describe('dispatchCiHeal — sibling repos keep the Claude path', () => {
  it.each([['frontierui', 0], ['we', 1]])('routeHeal is consulted for %s: %i call(s)', async (repo, calls) => {
    let routed = 0;
    const sinks = { [DISPATCH_EFFECT]: async (payload) => ({ handle: 'agent-1', seen: payload }) };
    await dispatchCiHeal({ itemNum: '2638', pr: 743, laneRef: 'lane/x', scope: ['frontierui:src/auth/trust.ts'], lane: 9, headRefOid: 's' }, {
      repo, readBrief: () => 'heal {{PR_NUM}} {{LANE_REF}} {{LANE}} {{SESSION_SLUG}} {{SCOPE}} {{REASON}}', sinks,
      claimRoot: join(dir, 'heal-claims'), claimOwner: 'o', readFixClaim: () => null, home: dir,
      checkoutExists: () => true, readPackageJson: () => ({}),
      routeHeal: () => { routed += 1; return null; },
    }).catch(() => {});
    expect(routed).toBe(calls);
  });
});

describe('refreshLiveFixDispatchClaims — a native listing outage', () => {
  it('does not release a native claim just because a detached claim kept the sweep alive', () => {
    const T0 = Date.parse('2026-09-25T12:00:00.000Z'); const iso = ms => new Date(ms).toISOString();
    const lockRoot = join(dir, 'sweep');
    acquireFixDispatchClaim({ repo: 'we', pr: 10, kind: 'fix', owner: 'A', lockRoot, nowMs: T0, nowIso: iso(T0), leaseMinutes: 10 });
    acquireFixDispatchClaim({ repo: 'we', pr: 11, kind: 'fix', owner: 'B', lockRoot, nowMs: T0, nowIso: iso(T0), leaseMinutes: 10 });
    stampFixDispatchClaim({ repo: 'we', pr: 11, kind: 'fix', owner: 'B', lockRoot, route: { provider: 'codex', model: 'm', effort: 'high' }, handle: 'pid:4242' });
    const result = refreshLiveFixDispatchClaims({
      lockRoot, nowMs: T0 + 60_000, nowIso: () => iso(T0 + 60_000), isPidAlive: pid => pid === 4242,
      listAgentsAll: () => { throw new Error('native CLI unavailable'); },
    });
    expect(result.refreshed.map(c => c.pr)).toEqual([11]);
    expect(result.released ?? []).toEqual([]);
    expect(readFixDispatchClaim({ repo: 'we', pr: 10, kind: 'fix', lockRoot })).not.toBeNull();
  });
});
