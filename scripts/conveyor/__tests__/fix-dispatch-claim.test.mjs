/**
 * @file scripts/conveyor/__tests__/fix-dispatch-claim.test.mjs — #x0jphk5 (parent #4075, epic #3383), corrected
 *   dup-heal-dispatch (2026-09-27 LIVE INCIDENT).
 * @description Proves the real per-(repo, kind, PR) claim `reconcile-fix-dispatch-daemon.mjs`'s own header used
 *   to (falsely) claim already existed. Three planes:
 *     1. The claim primitives themselves (`fix-dispatch-claim.mjs`), against a real temp lock root — atomic
 *        mutual exclusion and TTL-bounded dead-holder reclaim, mirroring `file-locks.test.mjs`'s own style.
 *     2. THE RED→GREEN PROOF: `dispatchFix`, `tryResumeFix` and `dispatchCiHeal` each wired to take this claim
 *        before spawning/resuming — two dispatch attempts for the SAME PR, from two DIFFERENT owners (modeling
 *        two real dispatcher processes racing the 26+s `claude agents --json --all` listing lag these
 *        functions' own docblocks describe), produce EXACTLY ONE spawn.
 *     3. THE dup-heal-dispatch REGRESSION PROOF: the original design keyed the claim on `(repo, pr, headSha)`,
 *        so a live session's OWN push (a NEW head sha, same PR, same kind) opened a free, independent slot — a
 *        second dispatcher reading it during the SAME listing-lag window dispatched a genuine DUPLICATE
 *        (`ci-heal-2784` x3 / `ci-heal-2783` x3, live 2026-09-26 22:16 ET — see `fix-dispatch-claim.mjs`'s own
 *        header). The key is now `(repo, kind, pr)`, with `headSha` carried only as diagnostic `meta` — these
 *        tests prove the SAME head-sha-rotation scenario is now refused.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_FIX_DISPATCH_CLAIM_TTL_MINUTES, fixDispatchClaimRoot, fixDispatchClaimOwner, fixDispatchResource,
  acquireFixDispatchClaim, releaseFixDispatchClaim, readFixDispatchClaim, fixDispatchSessionName,
  isClaimSessionLive, listFixDispatchClaims, refreshLiveFixDispatchClaims,
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
  it('keys on repo + kind + pr, distinguishing every axis', () => {
    const a = fixDispatchResource({ repo: 'we', pr: 100, kind: 'fix' });
    const b = fixDispatchResource({ repo: 'plateau-app', pr: 100, kind: 'fix' });
    const c = fixDispatchResource({ repo: 'we', pr: 101, kind: 'fix' });
    const d = fixDispatchResource({ repo: 'we', pr: 100, kind: 'ci-heal' });
    expect(new Set([a, b, c, d]).size).toBe(4);
  });
  // dup-heal-dispatch (2026-09-27 LIVE INCIDENT) — THE REGRESSION THIS FIX CLOSES. Before this fix, a
  // different head sha for the SAME (repo, pr) was a FREE, independent slot — exactly what let a still-live
  // session's own push (a fresh commit it made mid-task) rotate its own claim out from under it, so a second
  // dispatcher inside the listing-lag window saw "free" and double-dispatched (`ci-heal-2784`/`ci-heal-2783`,
  // live tonight). The resource key no longer varies with `headSha` at all — it is metadata only now (see
  // `acquireFixDispatchClaim`'s own `meta.headSha`).
  it('a DIFFERENT head sha for the SAME (repo, kind, pr) is the SAME resource — no longer a free slot', () => {
    const a = fixDispatchResource({ repo: 'we', pr: 100, kind: 'ci-heal' });
    const b = fixDispatchResource({ repo: 'we', pr: 100, kind: 'ci-heal' }); // headSha isn't even part of the call
    expect(a).toBe(b);
  });
  it('kind defaults to "fix" — every pre-existing caller that never passed one keeps its old resource string', () => {
    expect(fixDispatchResource({ repo: 'we', pr: 100 })).toBe(fixDispatchResource({ repo: 'we', pr: 100, kind: 'fix' }));
  });
  it('rejects a non-string repo, non-integer pr, or empty kind', () => {
    expect(() => fixDispatchResource({ repo: '', pr: 5 })).toThrow(TypeError);
    expect(() => fixDispatchResource({ repo: 'we', pr: 'x' })).toThrow(TypeError);
    expect(() => fixDispatchResource({ repo: 'we', pr: 5, kind: '' })).toThrow(TypeError);
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

  // dup-heal-dispatch REGRESSION PROOF — see this file's own header and `fixDispatchResource`'s own test above.
  it('a DIFFERENT head sha for the SAME (repo, kind, pr) is BLOCKED, not a free slot (the live incident this fixes)', () => {
    acquireFixDispatchClaim({ repo: 'we', pr: 100, kind: 'ci-heal', headSha: 'sha1', owner: 'A', lockRoot: claimRoot, nowMs: T0, nowIso: iso(T0) });
    // Models the still-live session's OWN push: a fresh head sha, same PR, same kind, moments later.
    const r2 = acquireFixDispatchClaim({ repo: 'we', pr: 100, kind: 'ci-heal', headSha: 'sha2', owner: 'B', lockRoot: claimRoot, nowMs: T0 + 60_000, nowIso: iso(T0 + 60_000) });
    expect(r2).toMatchObject({ ok: false, reason: 'held', heldBy: 'A' });
  });
  it('a DIFFERENT kind for the SAME (repo, pr) is a free, independent slot — fix and ci-heal never share one', () => {
    acquireFixDispatchClaim({ repo: 'we', pr: 100, kind: 'fix', owner: 'A', lockRoot: claimRoot, nowMs: T0, nowIso: iso(T0) });
    const r2 = acquireFixDispatchClaim({ repo: 'we', pr: 100, kind: 'ci-heal', owner: 'B', lockRoot: claimRoot, nowMs: T0, nowIso: iso(T0) });
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

describe('fixDispatchSessionName / isClaimSessionLive — the name-based liveness signal the refresh relies on', () => {
  it('mints the SAME name a real dispatch would (mirrors bindAgents PATH 2)', () => {
    expect(fixDispatchSessionName({ repo: 'we', pr: 2784, kind: 'ci-heal' })).toBe('ci-heal-2784');
    expect(fixDispatchSessionName({ repo: 'we', pr: 2783, kind: 'fix' })).toBe('fix-2783');
  });
  it('is live when a non-terminal agent carries the exact expected name', () => {
    const agentsAll = [{ name: 'ci-heal-2784', state: 'working' }];
    expect(isClaimSessionLive({ repo: 'we', pr: 2784, kind: 'ci-heal', agentsAll })).toBe(true);
  });
  it('is NOT live once the session reaches a terminal state', () => {
    const agentsAll = [{ name: 'ci-heal-2784', state: 'done' }];
    expect(isClaimSessionLive({ repo: 'we', pr: 2784, kind: 'ci-heal', agentsAll })).toBe(false);
  });
  it('is NOT live when no agent carries that name at all (covers the spawn-listing lag)', () => {
    expect(isClaimSessionLive({ repo: 'we', pr: 2784, kind: 'ci-heal', agentsAll: [] })).toBe(false);
  });
});

describe('listFixDispatchClaims / refreshLiveFixDispatchClaims — the tick-time keep-alive', () => {
  it('lists every held claim with usable meta', () => {
    acquireFixDispatchClaim({ repo: 'we', pr: 2784, kind: 'ci-heal', headSha: 'sha1', owner: 'A', lockRoot: claimRoot, nowMs: T0, nowIso: iso(T0) });
    acquireFixDispatchClaim({ repo: 'we', pr: 2783, kind: 'ci-heal', headSha: 'sha2', owner: 'B', lockRoot: claimRoot, nowMs: T0, nowIso: iso(T0) });
    const claims = listFixDispatchClaims(claimRoot);
    expect(claims).toHaveLength(2);
    expect(claims.map((c) => c.meta.pr).sort()).toEqual([2783, 2784]);
  });

  it('returns [] for a lockRoot that does not exist yet, rather than throwing', () => {
    expect(listFixDispatchClaims(join(claimRoot, 'does-not-exist'))).toEqual([]);
  });

  it('refreshes ONLY the claim whose session is confirmed live — a claim near TTL expiry survives a tick while its session is still running', () => {
    acquireFixDispatchClaim({ repo: 'we', pr: 2784, kind: 'ci-heal', headSha: 'sha1', owner: 'A', lockRoot: claimRoot, nowMs: T0, nowIso: iso(T0), leaseMinutes: 10 });
    acquireFixDispatchClaim({ repo: 'we', pr: 2783, kind: 'ci-heal', headSha: 'sha2', owner: 'B', lockRoot: claimRoot, nowMs: T0, nowIso: iso(T0), leaseMinutes: 10 });

    // #2784's session is still live; #2783's already finished.
    const listAgentsAll = () => [{ name: 'ci-heal-2784', state: 'working' }, { name: 'ci-heal-2783', state: 'done' }];
    const refreshAt = T0 + 9 * 60_000; // just inside the original 10-minute TTL
    const result = refreshLiveFixDispatchClaims({ lockRoot: claimRoot, listAgentsAll, nowIso: () => iso(refreshAt) });
    expect(result.checked).toBe(2);
    expect(result.refreshed).toHaveLength(1);
    expect(result.refreshed[0]).toMatchObject({ repo: 'we', pr: 2784, kind: 'ci-heal', owner: 'A' });

    // Past the ORIGINAL TTL (T0 + 11min): #2784's claim (refreshed at T0+9min) is still held; #2783's (never
    // refreshed) is now reclaimable — proving the refresh, not a fluke, is what kept #2784's claim alive.
    const pastOriginalTtl = T0 + 11 * 60_000;
    const stillHeld = acquireFixDispatchClaim({ repo: 'we', pr: 2784, kind: 'ci-heal', owner: 'C', lockRoot: claimRoot, nowMs: pastOriginalTtl, nowIso: iso(pastOriginalTtl) });
    expect(stillHeld.ok).toBe(false);
    const reclaimed = acquireFixDispatchClaim({ repo: 'we', pr: 2783, kind: 'ci-heal', owner: 'C', lockRoot: claimRoot, nowMs: pastOriginalTtl, nowIso: iso(pastOriginalTtl) });
    expect(reclaimed).toMatchObject({ ok: true, reason: 'lease-expired' });
  });

  it('a lock root with no claims at all is a no-op (never calls listAgentsAll unnecessarily)', () => {
    let called = false;
    const result = refreshLiveFixDispatchClaims({ lockRoot: join(claimRoot, 'empty'), listAgentsAll: () => { called = true; return []; } });
    expect(result).toEqual({ checked: 0, refreshed: [] });
    expect(called).toBe(false);
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

  // dup-heal-dispatch — THE LIVE INCIDENT ITSELF, REPLAYED THROUGH THE REAL DISPATCH FUNCTION: `ci-heal-2784`
  // dispatched three times tonight because each dispatch's OWN push (a real ci-heal commit) changed the PR's
  // `headRefOid` before the previous session was confirmed live, and the OLD claim keyed on that head sha let
  // the second dispatch see a free slot. This models EXACTLY that: dispatcher A dispatches against `headRefOid:
  // 'sha1'`; dispatcher B, moments later, reads the SAME PR post-push (`headRefOid: 'sha2'`) and tries again —
  // must be refused, not a second real spawn.
  it('the SAME PR redispatched after its OWN head sha changed (a live session\'s own push) is refused, not a second spawn', async () => {
    const { DISPATCH_EFFECT } = await import('../../operations/dispatch-lane.mjs');
    const sinkCalls = [];
    const sinks = { [DISPATCH_EFFECT]: async (payload) => { sinkCalls.push(payload); return { handle: 'agent-1' }; } };

    const a = await dispatchCiHeal({ ...planned, headRefOid: 'sha1' }, { readBrief: () => TEMPLATE, sinks, claimRoot, claimOwner: 'dispatcher-A' });
    expect(a.held).toBeUndefined();

    const b = await dispatchCiHeal({ ...planned, headRefOid: 'sha2' }, { readBrief: () => TEMPLATE, sinks, claimRoot, claimOwner: 'dispatcher-B' });
    expect(b).toMatchObject({ held: true, reason: 'held', heldBy: 'dispatcher-A' });

    expect(sinkCalls).toHaveLength(1); // ← THE PROOF: tonight's actual duplicate-dispatch shape, now refused.
  });
});
