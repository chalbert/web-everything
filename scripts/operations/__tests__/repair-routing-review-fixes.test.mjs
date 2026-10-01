/**
 * @file PR #3311 review round 1 — regressions for the fix/CI-heal routing hand-off:
 *   explicit model pins, post-spawn throws, claim retention on indeterminate launches, critical-work signals
 *   (security tag / high risk / sibling repos) and a failed native listing never expiring live claims.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dispatchFix, cardRoutingSignals } from '../../conveyor/reconcile-fix-dispatch.mjs';
import { dispatchCiHeal } from '../ci-heal-pr-dispatch.mjs';
import { createDispatchSinks } from '../dispatch-lane-io.mjs';
import { DISPATCH_EFFECT } from '../dispatch-lane.mjs';
import { codexBriefDetachedProvider } from '../dispatch-providers/codex-brief.mjs';
import {
  acquireFixDispatchClaim, readFixDispatchClaim, refreshLiveFixDispatchClaims, stampFixDispatchClaim,
} from '../../conveyor/fix-dispatch-claim.mjs';
import { resolveDispatchRoute } from '../../lib/dispatch-routing-policy-io.mjs';
import { CODEX_EFFORT_MAP } from '../../codex-direct-task.mjs';

const planned = { pr: 900002, itemNum: '3209', lane: 4, laneRef: 'lane/3209-fix', scope: ['we:scripts/example.mjs'], risk: 'low', size: 2 };
const brief = 'Fix {{PR_NUM}} {{ITEM_NUM}} {{LANE}} {{LANE_REF}} {{SESSION_SLUG}} {{SCOPE}}.';
let dir; let claimRoot;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'repair-review-')); claimRoot = join(dir, 'claims'); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const base = (over = {}) => ({
  root: '/dispatcher', readBrief: () => brief, claimRoot, claimOwner: 'o', readFixClaim: () => null,
  sessionCwdFor: () => dir, ensureSessionCwd: p => p, resolveSettingsEnv: () => null, providerAvailable: () => true,
  routeFix: p => resolveDispatchRoute({ kind: 'fix', scopePaths: p.scope, size: p.size, risk: p.risk }, { scorecards: [] }),
  writeRunRecord: () => {}, ...over,
});
const claimOf = () => readFixDispatchClaim({ repo: 'we', pr: planned.pr, kind: 'fix', lockRoot: claimRoot });

describe('dispatchFix launch boundary', () => {
  it('honors an explicit reasoned model pin even when Codex is available', () => {
    const spawned = [];
    const result = dispatchFix(planned, base({
      extraArgs: ['--model', 'opus'], modelReason: 'operator pinned',
      spawnCodex: () => { throw new Error('must not start Codex'); },
      spawnAgent: argv => { spawned.push(argv); return 'backgrounded · abc12345\n'; },
    }));
    expect(result.provider).toBe('claude');
    expect(spawned[0]).toEqual(expect.arrayContaining(['--model', 'opus']));
  });

  it('a successful spawn with an off-catalog --model=<id> pin still returns its result and keeps the claim', () => {
    const result = dispatchFix(planned, base({
      extraArgs: ['--model=claude-x'], modelReason: 'pinned',
      spawnAgent: () => 'backgrounded · abc12345\n',
    }));
    expect(result.provider).toBe('claude');
    expect(result.model).toBe('claude-x');
    expect(claimOf()).not.toBeNull();
  });

  it('a successful spawn whose argv has no --model flag does not throw after the launch', () => {
    const result = dispatchFix(planned, base({
      routeFix: () => null, spawnAgent: () => 'backgrounded · abc12345\n',
    }));
    expect(result.agentId).toBeTruthy();
    expect(claimOf()).not.toBeNull();
  });

  it('an INDETERMINATE Codex launch (no pid) keeps the claim — no duplicate worker on the next tick', () => {
    expect(() => dispatchFix(planned, base({
      spawnCodex: request => codexBriefDetachedProvider(request, { spawnDetached: () => ({}) }),
    }))).toThrow(/indeterminate/);
    expect(claimOf()).not.toBeNull();
  });

  it('a synchronous Codex spawn failure (ENOENT) is definitely not applied — the claim is released', () => {
    expect(() => dispatchFix(planned, base({
      spawnCodex: request => codexBriefDetachedProvider(request, { spawnDetached: () => { throw Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }); } }),
    }))).toThrow(/could not be spawned/);
    expect(claimOf()).toBeNull();
  });
});

describe('critical-work signals reach the fix route', () => {
  it('reads tags and risk from the item card; an unreadable card fails closed', () => {
    const files = { 'backlog/3209-x.md': '---\ntags: [security, routing]\nrisk: high\n---\n' };
    const io = { readDir: () => ['3209-x.md'], readFile: p => files[p.slice(p.indexOf('backlog/'))] };
    expect(cardRoutingSignals('/r', '3209', io)).toEqual({ tags: ['security', 'routing'], risk: 'high' });
    expect(cardRoutingSignals('/r', '9999', { readDir: () => [], readFile: () => '' })).toMatchObject({ risk: 'high' });
    expect(cardRoutingSignals('/r', '3209', { readDir: () => { throw new Error('x'); } })).toMatchObject({ risk: 'high' });
    expect(cardRoutingSignals('/r', null)).toEqual({ tags: [], risk: 'high' });
  });

  it('a security-tagged fix routes native Claude, not Codex', () => {
    const route = resolveDispatchRoute({ kind: 'fix', scopePaths: planned.scope, size: 2, tags: ['security'] }, { scorecards: [] });
    expect(route.policyRoute?.provider).toBe('claude');
    const plain = resolveDispatchRoute({ kind: 'fix', scopePaths: planned.scope, size: 2, risk: 'low' }, { scorecards: [] });
    expect(plain.policyRoute?.provider).toBe('codex');
  });

  it('a high-risk fix routes native Claude', () => {
    const route = resolveDispatchRoute({ kind: 'fix', scopePaths: planned.scope, size: 2, risk: 'high' }, { scorecards: [] });
    expect(route.policyRoute?.provider).toBe('claude');
  });

  it('default routeFix is fed the card signals (security card never reaches Codex)', () => {
    const spawned = [];
    const result = dispatchFix(planned, {
      ...base({ routeFix: undefined }), root: dir,
      spawnCodex: () => { throw new Error('must not start Codex'); },
      spawnAgent: argv => { spawned.push(argv); return 'backgrounded · abc12345\n'; },
    });
    // `dir` has no backlog card for the item → unreadable → fail closed → native
    expect(result.provider).toBe('claude');
  });
});

describe('dispatchFix sibling repos stay native (the WE-relative gate cannot judge them)', () => {
  it.each(['frontierui', 'plateau-app'])('a %s fix never reaches Codex, whatever its item number matches in the WE backlog', repo => {
    const spawned = [];
    const result = dispatchFix({ ...planned, scope: [`${repo}:src/a.ts`] }, {
      ...base({ routeFix: undefined }), repo, root: dir,
      home: dir, checkoutExists: () => true, readPackageJson: () => ({ scripts: {} }),
      spawnCodex: () => { throw new Error('must not start Codex'); },
      spawnAgent: argv => { spawned.push(argv); return 'backgrounded · abc12345\n'; },
    });
    expect(result.provider ?? 'claude').toBe('claude');
    expect(spawned).toHaveLength(1);
  });

  it('the default routeFix returns no policy route for a sibling repo and never reads the WE card', () => {
    let routed = 0;
    dispatchFix({ ...planned, scope: ['frontierui:src/a.ts'] }, {
      ...base({ routeFix: undefined }), repo: 'frontierui', root: '/no/such/root',
      home: dir, checkoutExists: () => true, readPackageJson: () => ({ scripts: {} }),
      spawnCodex: () => { routed += 1; return 'x'; },
      spawnAgent: () => 'backgrounded · abc12345\n',
    });
    expect(routed).toBe(0);
  });
});

describe('createDispatchSinks error classification', () => {
  it('an UNKNOWN-outcome launch failure carries `.indeterminate` so dispatchCiHeal keeps its claim', async () => {
    const sinks = createDispatchSinks({
      root: '/primary/webeverything',
      spawnAgent: () => { throw new Error('boom: something odd'); },
    });
    const err = await sinks[DISPATCH_EFFECT]({ prompt: 'p', sessionSlug: 's', num: '1' }).catch(e => e);
    expect(err.message).toMatch(/UNKNOWN/);
    expect(err.indeterminate).toBe(true);
  });
});

describe('dispatchCiHeal', () => {
  const healPlanned = { itemNum: '2638', pr: 743, laneRef: 'lane/2638-x', scope: ['we:scripts/a.mjs'], lane: 9, headRefOid: 'sha' };
  const readBrief = () => 'heal {{PR_NUM}} {{ITEM_NUM}} {{LANE_REF}} {{LANE}} {{SESSION_SLUG}} {{SCOPE}} {{REASON}}';

  it('sibling repo heals are never routed by the WE-relative gate', async () => {
    let routed = 0;
    const sinks = { [DISPATCH_EFFECT]: async payload => { expect(payload.routing).toBeNull(); return { handle: 'a' }; } };
    await dispatchCiHeal({ ...healPlanned, repo: 'frontierui' }, {
      repo: 'frontierui', readBrief, sinks, claimRoot, claimOwner: 'o', readFixClaim: () => null,
      home: dir, checkoutExists: () => true, readPackageJson: () => ({ scripts: {} }),
      routeHeal: () => { routed += 1; return { policyRoute: { provider: 'codex' } }; },
    }).catch(() => {});
    expect(routed).toBe(0);
  });

  it.each([
    ['a security-tagged card', { tags: ['security'] }, 'claude'],
    ['a risk: high card', { tags: [], risk: 'high' }, 'claude'],
    ['an item-less / unreadable card (fails closed)', { tags: [], risk: 'high' }, 'claude'],
    ['a plain low-risk card', { tags: [], risk: undefined }, 'codex'],
  ])('the DEFAULT routeHeal for %s routes %s provider', async (_n, signals, provider) => {
    let seen;
    const sinks = { [DISPATCH_EFFECT]: async payload => { seen = payload.routing; return { handle: 'a' }; } };
    await dispatchCiHeal(healPlanned, {
      readBrief, sinks, claimRoot, claimOwner: 'o', readFixClaim: () => null,
      home: dir, checkoutExists: () => true, readPackageJson: () => ({ scripts: {} }),
      readRoutingSignals: () => signals,
    }).catch(() => {});
    expect(seen?.policyRoute?.provider).toBe(provider);
  });

  it('retains the claim after an indeterminate launch, releases it after a definite failure', async () => {
    const run = (error) => dispatchCiHeal(healPlanned, {
      readBrief, claimRoot, claimOwner: 'o', readFixClaim: () => null,
      sinks: { [DISPATCH_EFFECT]: async () => { throw error; } },
    });
    const key = { repo: 'we', pr: healPlanned.pr, kind: 'ci-heal', lockRoot: claimRoot };
    await expect(run(Object.assign(new Error('no pid; indeterminate'), { indeterminate: true }))).rejects.toThrow(/indeterminate/);
    expect(readFixDispatchClaim(key)).not.toBeNull();
    await expect(dispatchCiHeal(healPlanned, { readBrief, claimRoot, claimOwner: 'other', readFixClaim: () => null,
      sinks: { [DISPATCH_EFFECT]: async () => { throw new Error('second launch must not happen'); } } })).resolves.toMatchObject({ held: true });
    // the held claim from the indeterminate attempt blocks the second dispatch; after a definite failure it is gone:
    const dir2 = join(dir, 'c2');
    await expect(dispatchCiHeal(healPlanned, { readBrief, claimRoot: dir2, claimOwner: 'o', readFixClaim: () => null,
      sinks: { [DISPATCH_EFFECT]: async () => { throw new Error('boom'); } } })).rejects.toThrow('boom');
    expect(readFixDispatchClaim({ ...key, lockRoot: dir2 })).toBeNull();
  });
});

describe('claim sweep with a failed native listing', () => {
  it('does not release or expire a NATIVE claim just because listing failed (a detached claim exists too)', () => {
    const t0 = Date.now() - 10 * 60_000;
    const iso = ms => new Date(ms).toISOString();
    acquireFixDispatchClaim({ repo: 'we', pr: 11, kind: 'fix', owner: 'n', lockRoot: claimRoot, nowMs: t0, nowIso: iso(t0) });
    acquireFixDispatchClaim({ repo: 'we', pr: 12, kind: 'fix', owner: 'd', lockRoot: claimRoot, nowMs: t0, nowIso: iso(t0) });
    stampFixDispatchClaim({ repo: 'we', pr: 12, kind: 'fix', owner: 'd', lockRoot: claimRoot, handle: 'pid:4242', route: { provider: 'codex' } });
    const result = refreshLiveFixDispatchClaims({
      lockRoot: claimRoot, listAgentsAll: () => { throw new Error('native CLI outage'); }, isPidAlive: pid => pid === 4242,
    });
    expect(result.refreshed.map(r => r.pr)).toEqual([12]);
    expect(readFixDispatchClaim({ repo: 'we', pr: 11, kind: 'fix', lockRoot: claimRoot })).not.toBeNull();
  });
});

describe('codex effort map export', () => {
  it('codex-direct-task re-exports CODEX_EFFORT_MAP for the CLI adapter', () => {
    expect(Object.keys(CODEX_EFFORT_MAP).length).toBeGreaterThan(0);
  });
});

describe('round 2 repository repair boundary', () => {
  const sinkOptions = (over = {}) => ({
    root: dir, sessionCwdFor: () => dir, ensureSessionCwd: p => p,
    resolveSettingsEnv: () => null, resolveLaneGrant: () => ({}),
    grantLanePermission: () => {}, ensureWorktreeIsolation: () => {}, ...over,
  });

  it.each(['fix', 'ci-heal'].flatMap(kind => ['we', 'frontierui', 'plateau-app'].map(repo => [kind, repo])))(
    '%s in %s keeps siblings native even with Codex available',
    async (kind, repo) => {
      const spawnAgent = vi.fn(() => 'backgrounded · abc12345\n');
      const spawnCodex = vi.fn(() => { throw new Error('Codex must not launch'); });
      const route = vi.fn(() => resolveDispatchRoute({ kind, scopePaths: planned.scope, risk: 'high' }, { scorecards: [] }));
      const common = {
        ...base(), repo, home: dir, checkoutExists: () => true,
        readPackageJson: () => ({ scripts: {} }), spawnAgent, spawnCodex,
      };
      const result = kind === 'fix'
        ? dispatchFix(planned, { ...common, routeFix: route })
        : await dispatchCiHeal(planned, {
          ...common, readBrief: () => brief + ' {{REASON}}', routeHeal: route,
          sinks: createDispatchSinks(sinkOptions({ spawnAgent, providerAvailable: () => true })),
        });
      expect(result.provider).toBe('claude');
      expect(spawnAgent).toHaveBeenCalledTimes(1);
      expect(spawnCodex).not.toHaveBeenCalled();
      expect(route).toHaveBeenCalledTimes(repo === 'we' ? 1 : 0);
    },
  );

  it.each(['frontierui', 'plateau-app'])('default fix route for %s never reads a colliding WE card', repo => {
    mkdirSync(join(dir, 'backlog'));
    writeFileSync(join(dir, 'backlog', '3209-security.md'), '---\ntags: [security]\nrisk: high\n---\n');
    const readRoutingSignals = vi.fn(cardRoutingSignals);
    const spawnCodex = vi.fn(() => { throw new Error('Codex must not launch'); });
    const result = dispatchFix({ ...planned, scope: [repo + ':src/ordinary.ts'] }, base({
      repo, root: dir, routeFix: undefined, readRoutingSignals, spawnCodex,
      home: dir, checkoutExists: () => true, readPackageJson: () => ({ scripts: {} }),
      spawnAgent: () => 'backgrounded · abc12345\n',
    }));
    expect(result.provider).toBe('claude');
    expect(readRoutingSignals).not.toHaveBeenCalled();
    expect(spawnCodex).not.toHaveBeenCalled();
  });

  it.each([
    ['tags: [security]', 'claude'],
    ['risk: high', 'claude'],
    ['risk: low', 'codex'],
  ])('default WE fix route respects card %s', (metadata, provider) => {
    mkdirSync(join(dir, 'backlog'));
    writeFileSync(join(dir, 'backlog', '3209-card.md'), '---\n' + metadata + '\n---\n');
    const result = dispatchFix(planned, base({
      root: dir, routeFix: undefined,
      spawnCodex: request => codexBriefDetachedProvider(request, { spawnDetached: () => ({ pid: 4242, unref() {} }) }),
      spawnAgent: () => 'backgrounded · abc12345\n',
    }));
    expect(result.provider).toBe(provider);
  });

  it('item-less fixes fail closed on an ordinary scope', () => {
    const result = dispatchFix({ ...planned, itemNum: null }, base({
      routeFix: undefined, spawnCodex: () => { throw new Error('Codex must not launch'); },
      spawnAgent: () => 'backgrounded · abc12345\n',
    }));
    expect(result.provider).toBe('claude');
  });

  it.each(['no-pid', 'unmarked-error', 'ENOENT'])('CI-heal sink preserves launch certainty: %s', async failure => {
    const spawnDetached = vi.fn(() => {
      if (failure === 'no-pid') return {};
      throw Object.assign(new Error(failure), failure === 'ENOENT' ? { code: 'ENOENT' } : {});
    });
    const sinks = createDispatchSinks(sinkOptions({
      provider: request => failure === 'unmarked-error'
        ? spawnDetached()
        : codexBriefDetachedProvider(request, { spawnDetached }),
    }));
    const options = { ...base(), sinks, readBrief: () => brief + ' {{REASON}}', readRoutingSignals: () => ({ tags: [], risk: undefined }) };
    const key = { repo: 'we', pr: planned.pr, kind: 'ci-heal', lockRoot: claimRoot };
    const launch = dispatchCiHeal(planned, options);
    if (failure === 'ENOENT') {
      await expect(launch).rejects.toMatchObject({ notApplied: true });
      expect(readFixDispatchClaim(key)).toBeNull();
    } else {
      await expect(launch).rejects.toMatchObject({ indeterminate: true, cause: expect.any(Error) });
      expect(readFixDispatchClaim(key)).not.toBeNull();
      await expect(dispatchCiHeal(planned, { ...options, claimOwner: 'next-tick' })).resolves.toMatchObject({ held: true });
      expect(spawnDetached).toHaveBeenCalledTimes(1);
    }
  });
});
