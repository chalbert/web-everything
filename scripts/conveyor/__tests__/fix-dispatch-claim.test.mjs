/**
 * @file scripts/conveyor/__tests__/fix-dispatch-claim.test.mjs — #x0jphk5 (parent #4075, epic #3383).
 * @description Proves the real per-(repo, PR, head sha) claim `reconcile-fix-dispatch-daemon.mjs`'s own header
 *   used to (falsely) claim already existed. Two planes:
 *     1. The claim primitives themselves (`fix-dispatch-claim.mjs`), against a real temp lock root — atomic
 *        mutual exclusion and TTL-bounded dead-holder reclaim, mirroring `file-locks.test.mjs`'s own style.
 *     2. THE RED→GREEN PROOF: `dispatchFix`, `tryResumeFix` and `dispatchCiHeal` each wired to take this claim
 *        before spawning/resuming — two dispatch attempts for the SAME PR, from two DIFFERENT owners (modeling
 *        two real dispatcher processes racing the 26+s `claude agents --json --all` listing lag these
 *        functions' own docblocks describe), produce EXACTLY ONE spawn.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_FIX_DISPATCH_CLAIM_TTL_MINUTES, fixDispatchClaimRoot, fixDispatchClaimOwner, fixDispatchResource,
  acquireFixDispatchClaim, releaseFixDispatchClaim, readFixDispatchClaim,
} from '../fix-dispatch-claim.mjs';
import { dispatchFix, tryResumeFix } from '../reconcile-fix-dispatch.mjs';
import { dispatchCiHeal } from '../../operations/ci-heal-pr-dispatch.mjs';
import { buildAuthorActorMarker } from '../../lib/review-independence.mjs';

let claimRoot;
beforeEach(() => { claimRoot = mkdtempSync(join(tmpdir(), 'fix-dispatch-claim-test-')); });
afterEach(() => { rmSync(claimRoot, { recursive: true, force: true }); });

const T0 = Date.parse('2026-09-25T12:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();

describe('fixDispatchResource', () => {
  it('keys on repo + pr + headSha, distinguishing every axis', () => {
    const a = fixDispatchResource({ repo: 'we', pr: 100, headSha: 'aaa' });
    const b = fixDispatchResource({ repo: 'plateau-app', pr: 100, headSha: 'aaa' });
    const c = fixDispatchResource({ repo: 'we', pr: 101, headSha: 'aaa' });
    const d = fixDispatchResource({ repo: 'we', pr: 100, headSha: 'bbb' });
    expect(new Set([a, b, c, d]).size).toBe(4);
  });
  it('degrades a missing/null head sha to a stable "unknown" slot rather than skipping the claim', () => {
    expect(fixDispatchResource({ repo: 'we', pr: 5, headSha: null })).toBe(fixDispatchResource({ repo: 'we', pr: 5 }));
  });
  it('rejects a non-string repo or non-integer pr', () => {
    expect(() => fixDispatchResource({ repo: '', pr: 5 })).toThrow(TypeError);
    expect(() => fixDispatchResource({ repo: 'we', pr: 'x' })).toThrow(TypeError);
  });
});

describe('fixDispatchClaimRoot / fixDispatchClaimOwner', () => {
  it('roots under the coordination sidecar, not a checkout-local dir', () => {
    expect(fixDispatchClaimRoot('/coord')).toBe(join('/coord', 'fix-dispatch-claims'));
  });
  it('the default owner embeds host and pid, so two different real processes never collide', () => {
    const o1 = fixDispatchClaimOwner({ host: 'mac', pid: 111 });
    const o2 = fixDispatchClaimOwner({ host: 'mac', pid: 222 });
    expect(o1).not.toBe(o2);
    expect(o1).toBe('mac:111');
  });
});

describe('acquireFixDispatchClaim / releaseFixDispatchClaim — atomic mutual exclusion', () => {
  it('the first owner acquires cleanly', () => {
    const r = acquireFixDispatchClaim({ repo: 'we', pr: 100, headSha: 'sha1', owner: 'A', lockRoot: claimRoot, nowMs: T0, nowIso: iso(T0) });
    expect(r).toMatchObject({ ok: true, reason: 'free', heldBy: 'A' });
  });

  it('a SECOND, different owner is refused while the first still holds it', () => {
    acquireFixDispatchClaim({ repo: 'we', pr: 100, headSha: 'sha1', owner: 'A', lockRoot: claimRoot, nowMs: T0, nowIso: iso(T0) });
    const r2 = acquireFixDispatchClaim({ repo: 'we', pr: 100, headSha: 'sha1', owner: 'B', lockRoot: claimRoot, nowMs: T0 + 1000, nowIso: iso(T0 + 1000) });
    expect(r2).toMatchObject({ ok: false, reason: 'held', heldBy: 'A' });
  });

  it('a different head sha for the SAME pr is a free, independent slot (a new push is not blocked by the old commit\'s claim)', () => {
    acquireFixDispatchClaim({ repo: 'we', pr: 100, headSha: 'sha1', owner: 'A', lockRoot: claimRoot, nowMs: T0, nowIso: iso(T0) });
    const r2 = acquireFixDispatchClaim({ repo: 'we', pr: 100, headSha: 'sha2', owner: 'B', lockRoot: claimRoot, nowMs: T0, nowIso: iso(T0) });
    expect(r2.ok).toBe(true);
  });

  it('the SAME owner re-acquiring is a reentrant heartbeat refresh, not a refusal', () => {
    acquireFixDispatchClaim({ repo: 'we', pr: 100, headSha: 'sha1', owner: 'A', lockRoot: claimRoot, nowMs: T0, nowIso: iso(T0) });
    const r2 = acquireFixDispatchClaim({ repo: 'we', pr: 100, headSha: 'sha1', owner: 'A', lockRoot: claimRoot, nowMs: T0 + 1000, nowIso: iso(T0 + 1000) });
    expect(r2).toMatchObject({ ok: true, reason: 'own', heldBy: 'A' });
  });

  it('release by the OWNER frees it for the next acquirer immediately', () => {
    acquireFixDispatchClaim({ repo: 'we', pr: 100, headSha: 'sha1', owner: 'A', lockRoot: claimRoot, nowMs: T0, nowIso: iso(T0) });
    const rel = releaseFixDispatchClaim({ repo: 'we', pr: 100, headSha: 'sha1', owner: 'A', lockRoot: claimRoot });
    expect(rel).toEqual({ released: true });
    const r2 = acquireFixDispatchClaim({ repo: 'we', pr: 100, headSha: 'sha1', owner: 'B', lockRoot: claimRoot, nowMs: T0 + 1000, nowIso: iso(T0 + 1000) });
    expect(r2.ok).toBe(true);
  });

  it('release by a NON-owner is a safe no-op — never tears down a lock it does not own', () => {
    acquireFixDispatchClaim({ repo: 'we', pr: 100, headSha: 'sha1', owner: 'A', lockRoot: claimRoot, nowMs: T0, nowIso: iso(T0) });
    const rel = releaseFixDispatchClaim({ repo: 'we', pr: 100, headSha: 'sha1', owner: 'B', lockRoot: claimRoot });
    expect(rel).toEqual({ released: false, reason: 'not-owner', heldBy: 'A' });
    expect(readFixDispatchClaim({ repo: 'we', pr: 100, headSha: 'sha1', lockRoot: claimRoot })?.owner).toBe('A');
  });

  it('releasing an absent claim is a safe no-op', () => {
    expect(releaseFixDispatchClaim({ repo: 'we', pr: 999, headSha: 'x', owner: 'A', lockRoot: claimRoot })).toEqual({ released: false, reason: 'absent' });
  });

  it('DEAD-HOLDER RECLAIM: a claim past its TTL is reclaimed by a new owner, never PID-fast-pathed', () => {
    acquireFixDispatchClaim({ repo: 'we', pr: 100, headSha: 'sha1', owner: 'A', lockRoot: claimRoot, nowMs: T0, nowIso: iso(T0), leaseMinutes: 10 });
    // Just inside the TTL: still held.
    const withinTtl = acquireFixDispatchClaim({
      repo: 'we', pr: 100, headSha: 'sha1', owner: 'B', lockRoot: claimRoot,
      nowMs: T0 + 9 * 60_000, nowIso: iso(T0 + 9 * 60_000), leaseMinutes: 10,
    });
    expect(withinTtl.ok).toBe(false);
    // Past the TTL: reclaimed, even though the ORIGINAL owner's "pid" was never probed as dead (this module
    // never passes a real pid-liveness verdict — see fix-dispatch-claim.mjs's own header for why).
    const pastTtl = acquireFixDispatchClaim({
      repo: 'we', pr: 100, headSha: 'sha1', owner: 'B', lockRoot: claimRoot,
      nowMs: T0 + 11 * 60_000, nowIso: iso(T0 + 11 * 60_000), leaseMinutes: 10,
    });
    expect(pastTtl).toMatchObject({ ok: true, reason: 'lease-expired', heldBy: 'B' });
  });

  it('the default TTL is comfortably above the measured 26+s listing lag', () => {
    expect(DEFAULT_FIX_DISPATCH_CLAIM_TTL_MINUTES * 60).toBeGreaterThan(26 * 10);
  });
});

describe('readFixDispatchClaim — read-only introspection for a dry-run', () => {
  it('reports null when free, and the holder once claimed', () => {
    expect(readFixDispatchClaim({ repo: 'we', pr: 7, headSha: 's', lockRoot: claimRoot })).toBeNull();
    acquireFixDispatchClaim({ repo: 'we', pr: 7, headSha: 's', owner: 'A', lockRoot: claimRoot, nowMs: T0, nowIso: iso(T0) });
    expect(readFixDispatchClaim({ repo: 'we', pr: 7, headSha: 's', lockRoot: claimRoot })?.owner).toBe('A');
  });
});

// ── THE RED→GREEN PROOF ─────────────────────────────────────────────────────────────────────────────────────
// Each block below calls the REAL dispatch function twice for the SAME (repo, pr, headSha), from two DIFFERENT
// claim owners (modeling two independent dispatcher processes), sharing one real `claimRoot`. Before this item,
// nothing stopped both calls from spawning; the assertion is always "exactly one spawn happened, total".

const REAL_TEMPLATE_STUB = [
  '# fix brief for {{PR_NUM}} (item {{ITEM_NUM}})',
  'acquire: node scripts/lane-pool.mjs acquire --lane={{LANE}} --session={{SESSION_SLUG}} --scope={{SCOPE}} --base={{LANE_REF}}',
  'this brief documents {{LIKE_THIS}} as an example convention, not a real token',
].join('\n');

describe('dispatchFix — two racing dispatchers, one PR: exactly one spawn', () => {
  const planned = { itemNum: '3438', pr: 1764, laneRef: 'lane/3438-x', scope: ['we:x'], lane: 9, headRefOid: 'deadbeef'.repeat(5) };
  const baseOpts = { root: '/repo', readBrief: () => REAL_TEMPLATE_STUB, claimRoot };

  it('dispatcher A spawns; dispatcher B (racing the listing lag) is refused `held`, spawning nothing', () => {
    const spawnCalls = [];
    const spawnAgent = (argv, opts) => { spawnCalls.push({ argv, opts }); return ''; };

    const resultA = dispatchFix(planned, { ...baseOpts, mintSessionId: () => 'sid-a', spawnAgent, claimOwner: 'dispatcher-A' });
    expect(resultA.held).toBeUndefined();
    expect(resultA.sessionId).toBe('sid-a');

    const resultB = dispatchFix(planned, { ...baseOpts, mintSessionId: () => 'sid-b', spawnAgent, claimOwner: 'dispatcher-B' });
    expect(resultB).toMatchObject({ held: true, reason: 'held', heldBy: 'dispatcher-A' });

    expect(spawnCalls).toHaveLength(1); // ← THE PROOF: not two.
  });

  it('RED WITHOUT THE CLAIM (regression guard): calling twice with claiming disabled would double-spawn — proves the claim, not something else, is what caps it at one', () => {
    const spawnCalls = [];
    const spawnAgent = () => { spawnCalls.push(1); return ''; };
    const noClaim = () => ({ ok: true, reason: 'free', heldBy: null });
    const noop = () => ({ released: false, reason: 'absent' });

    dispatchFix(planned, { ...baseOpts, mintSessionId: () => 'sid-a', spawnAgent, acquireClaim: noClaim, releaseClaim: noop });
    dispatchFix(planned, { ...baseOpts, mintSessionId: () => 'sid-b', spawnAgent, acquireClaim: noClaim, releaseClaim: noop });
    expect(spawnCalls).toHaveLength(2); // without the claim wired, both attempts spawn — this is the bug this item fixes.
  });

  it('a failed attempt (spawnAgent throws) releases its claim so a legitimate retry is never blocked forever', () => {
    const throwing = () => { throw new Error('claude --bg failed'); };
    expect(() => dispatchFix(planned, { ...baseOpts, mintSessionId: () => 'sid-a', spawnAgent: throwing, claimOwner: 'dispatcher-A' })).toThrow('claude --bg failed');

    const spawnCalls = [];
    const retry = dispatchFix(planned, { ...baseOpts, mintSessionId: () => 'sid-b', spawnAgent: (a, o) => { spawnCalls.push({ a, o }); return ''; }, claimOwner: 'dispatcher-B' });
    expect(retry.held).toBeUndefined();
    expect(spawnCalls).toHaveLength(1);
  });
});

describe('runReconcileFixDispatch — a `held` result returns its popped lane to the pool', () => {
  it('reports `held` for the claimed PR (never pushed into `dispatched`) and reuses the SAME lane for the next entry — proving it was given back, not leaked', async () => {
    const { runReconcileFixDispatch } = await import('../reconcile-fix-dispatch.mjs');
    const dispatchCalls = [];
    const result = runReconcileFixDispatch({
      root: '/repo',
      // No conveyor item in either head ref — the item-less PR-diff-fallback path, so no `findItemFn`/
      // `resolveFallbackScope` plumbing is needed to reach a real `scope:` (mirrors this file's own
      // `reconcile-fix-dispatch.test.mjs` "attributed to the PR itself" fixture).
      reconcile: () => ({
        dispatch: [
          { kind: 'fix', prNumber: 50, headRefName: 'some-hand-opened-branch-a', headRefOid: 'a'.repeat(40) },
          { kind: 'fix', prNumber: 51, headRefName: 'some-hand-opened-branch-b', headRefOid: 'b'.repeat(40) },
        ],
        refusals: [],
      }),
      findItemFn: () => null,
      loadItems: () => [],
      fetchItemlessDiffPaths: () => ['we:x'],
      pickFreeLanes: () => [3], // exactly ONE lane in the pool — the second entry can only dispatch if it's returned.
      tryResume: () => ({ resumed: false, resumeAttempt: null }),
      dispatch: (entry) => {
        dispatchCalls.push(entry);
        return entry.pr === 50 ? { held: true, reason: 'held', heldBy: 'dispatcher-A' } : { sessionId: 's', pr: entry.pr, itemNum: null, lane: entry.lane, unknownTokens: [], resumed: false };
      },
      checkStaleness: () => ({ fresh: true, behind: 0 }),
    });
    expect(result.refusals).toEqual([{ pr: 50, kind: 'held', why: expect.stringContaining('dispatcher-A') }]);
    expect(result.dispatched).toEqual([{ sessionId: 's', pr: 51, itemNum: null, lane: 3, unknownTokens: [], resumed: false }]);
    expect(dispatchCalls.map((d) => d.lane)).toEqual([3, 3]); // the SAME lane number, reused after being given back.
  });
});

describe('tryResumeFix — a racing resume attempt is claim-refused, never a duplicate `--resume`', () => {
  const MATCHING_HEAD = 'deadbeef'.repeat(5);
  const marker = buildAuthorActorMarker('cand-0000-0000-0000-000000000000');
  const planned = {
    itemNum: '3438', pr: 1764, laneRef: 'lane/3438-wire-reconcile-pass', scope: ['we:x'],
    isConflict: true, body: `some PR body\n\n${marker}\n`, headRefOid: MATCHING_HEAD,
  };
  const baseOpts = {
    root: '/repo', claimRoot,
    listAgentsAll: () => [{ sessionId: 'cand-0000-0000-0000-000000000000', id: 'candxxxx', cwd: '/lanes/lane-4', name: 'conveyor-3438' }],
    resolveHead: (cwd) => (cwd === '/lanes/lane-4' ? MATCHING_HEAD : null),
  };

  it('two dispatchers racing the same, ownership-confirmed resume candidate: only one issues `--resume`', () => {
    // Genuine interleaving, not just two sequential calls: dispatcher B races in from INSIDE dispatcher A's own
    // `spawnAgent` call — i.e. after A has taken the claim but before it has released it — modeling the real
    // race (two dispatchers reading the same stale listing at nearly the same instant). A sequential-only test
    // would pass even without the claim wired correctly, since `tryResumeFix` releases on completion; this is
    // the shape that actually needs the claim's mutual exclusion.
    const resumeCalls = [];
    let bResult = null;
    const spawnAgent = (argv) => {
      resumeCalls.push(argv);
      if (!bResult) {
        bResult = tryResumeFix(planned, {
          ...baseOpts, claimOwner: 'dispatcher-B',
          spawnAgent: (bArgv) => { resumeCalls.push(bArgv); return 'backgrounded · candxxxx\n'; },
        });
      }
      return 'backgrounded · candxxxx\n';
    };

    const a = tryResumeFix(planned, { ...baseOpts, spawnAgent, claimOwner: 'dispatcher-A' });

    expect(resumeCalls).toHaveLength(1); // ← THE PROOF: B raced in mid-flight and did NOT get to `--resume`.
    expect(a.resumed).toBe(true);
    expect(bResult.resumed).toBe(false);
    expect(bResult.resumeAttempt).toMatchObject({ attempted: false, refused: 'claimed-elsewhere' });
    // The winning attempt released its own claim once its (synchronous, bounded) resume attempt concluded —
    // a THIRD dispatcher arriving after A finishes is free to try again (not double-blocked forever).
    expect(readFixDispatchClaim({ repo: 'we', pr: 1764, headSha: MATCHING_HEAD, lockRoot: claimRoot })).toBeNull();
  });
});

describe('dispatchCiHeal — two racing dispatchers, one PR: exactly one spawn', () => {
  const TEMPLATE = 'heal #{{ITEM_NUM}} pr={{PR_NUM}} ref={{LANE_REF}} lane={{LANE}} slug={{SESSION_SLUG}} scope={{SCOPE}} why={{REASON}}';
  const planned = { itemNum: '2638', pr: 743, laneRef: 'lane/2638-some-slug', scope: ['we:scripts/a.mjs'], lane: 9, headRefOid: 'sha-ci' };

  it('dispatcher A spawns via the sink; dispatcher B is refused `held`, the sink never called', async () => {
    const { DISPATCH_EFFECT } = await import('../../operations/dispatch-lane.mjs');
    const sinkCalls = [];
    const sinks = { [DISPATCH_EFFECT]: async (payload) => { sinkCalls.push(payload); return { handle: 'agent-1' }; } };

    const a = await dispatchCiHeal(planned, { readBrief: () => TEMPLATE, sinks, claimRoot, claimOwner: 'dispatcher-A' });
    expect(a.held).toBeUndefined();

    const b = await dispatchCiHeal(planned, { readBrief: () => TEMPLATE, sinks, claimRoot, claimOwner: 'dispatcher-B' });
    expect(b).toMatchObject({ held: true, reason: 'held', heldBy: 'dispatcher-A' });

    expect(sinkCalls).toHaveLength(1); // ← THE PROOF: the sink (which is what actually spawns) ran once.
  });
});
