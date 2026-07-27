/**
 * @file scripts/conveyor/__tests__/tick-core.test.mjs
 * @description Unit proof of the MECHANIZED CONVEYOR TICK CORE (WE #2699, epic #2677(a)). Drives the pure
 *   {@link ../tick-core.mjs} functions directly with plain objects (NO git/network) and PINS every guard rule
 *   the /conveyor SKILL previously ran in prose, so a future refactor cannot silently change a guard's semantics:
 *
 *   • the IN-FLIGHT DISPATCH (build) guard — a launch is dropped when its `num` OR its `lane` matches a live
 *     entry; retirement on claim / Agent-return / TTL;
 *   • the DIFFERENT PREPARE guard — keyed by `num`, the union re-dispatch gate, retirement ONLY on
 *     scope-committed / PR-terminal / TTL-to-first-PR and NEVER on Agent-return;
 *   • the FIX guard — the in-flight entry vs. the surviving attempt counter, the in-flight test, the retry cap
 *     that binds across bounce cycles, entry retirement, and counter-clear-on-terminal;
 *   • WATCHER ARMING (one per conveyor-launched open PR), IDLE-STOP, the exit-code router, and the whole
 *     {@link planTick} composition — including the free-lane exclusion shared across builds and prepares.
 */
import { describe, it, expect } from 'vitest';
import {
  retireBuildGuards,
  filterLaunches,
  retirePrepareGuards,
  planPrepareSpawns,
  planFixSpawns,
  retireFixGuards,
  clearTerminalFixAttempts,
  planCiHealSpawns,
  retireCiHealGuards,
  clearTerminalCiHealAttempts,
  armWatchers,
  releaseSessionForNum,
  assessIdleStop,
  routeWatcherExit,
  buildStatusLine,
  planTick,
  DEFAULT_BUILD_TTL_TICKS,
  DEFAULT_PREPARE_TTL_TICKS,
  DEFAULT_FIX_RETRY_CAP,
  DEFAULT_CI_HEAL_RETRY_CAP,
} from '../tick-core.mjs';

// ── The in-flight dispatch (build) guard — filter by num OR lane ──────────────────────────────────────────────

describe('filterLaunches — the in-flight dispatch guard drops by num OR by lane', () => {
  it('passes a launch with neither num nor lane guarded', () => {
    const { spawn, suppressed } = filterLaunches([{ num: 10, lane: 4 }], []);
    expect(spawn).toEqual([{ num: 10, lane: 4 }]);
    expect(suppressed).toEqual([]);
  });

  it('drops a launch whose NUM matches a live guard (the item is already dispatching)', () => {
    const { spawn, suppressed } = filterLaunches([{ num: 10, lane: 5 }], [{ num: 10, lane: 4 }]);
    expect(spawn).toEqual([]);
    expect(suppressed).toEqual([{ num: 10, lane: 5, by: 'num' }]);
  });

  it('drops a launch whose LANE matches a live guard even when the num differs (the lane is the contended resource)', () => {
    // The core hazard the OR-guard closes: tick N launched {num:100,lane:4}; it is slow to acquire; tick N+1
    // re-assigns lane 4 to a different top-of-queue num — must NOT start a second agent on lane 4.
    const { spawn, suppressed } = filterLaunches([{ num: 200, lane: 4 }], [{ num: 100, lane: 4 }]);
    expect(spawn).toEqual([]);
    expect(suppressed).toEqual([{ num: 200, lane: 4, by: 'lane' }]);
  });

  it('normalizes ids so a padded/`#`-sigil num still matches its guard', () => {
    const { spawn } = filterLaunches([{ num: '#010', lane: 9 }], [{ num: 10, lane: 4 }]);
    expect(spawn).toEqual([]);
  });
});

describe('retireBuildGuards — claim / Agent-return / TTL (SKILL §2, three ways)', () => {
  it('retires on CLAIM when the guard lane shows leased in state.lanes', () => {
    const { live, retired } = retireBuildGuards([{ num: 10, lane: 4, spawnedTick: 0 }], {
      lanes: [{ lane: 4, num: 10 }], queue: [{ num: 10, buildQueued: true }], tick: 1,
    });
    expect(live).toEqual([]);
    expect(retired).toEqual([{ num: 10, lane: 4, reason: 'claimed' }]);
  });

  it('retires on CLAIM when the item has left the cleared build queue', () => {
    const { live, retired } = retireBuildGuards([{ num: 10, lane: 4, spawnedTick: 0 }], {
      lanes: [], queue: [], tick: 1, // 10 no longer a buildQueued row → claimed/active
    });
    expect(live).toEqual([]);
    expect(retired[0].reason).toBe('claimed');
  });

  it('retires on Agent-RETURN via signals.returnedBuildNums (still queued, lane not yet leased)', () => {
    const { live, retired } = retireBuildGuards([{ num: 10, lane: 4, spawnedTick: 0 }], {
      lanes: [], queue: [{ num: 10, buildQueued: true }], tick: 1, returnedBuildNums: [10],
    });
    expect(live).toEqual([]);
    expect(retired[0].reason).toBe('returned');
  });

  it('retires on TTL after the default (3) ticks with the item never claimed — surfaced as a note', () => {
    const guard = [{ num: 10, lane: 4, spawnedTick: 0 }];
    const ctx = { lanes: [], queue: [{ num: 10, buildQueued: true }], tick: DEFAULT_BUILD_TTL_TICKS - 1 };
    expect(retireBuildGuards(guard, ctx).live).toHaveLength(1); // not yet
    const at = retireBuildGuards(guard, { ...ctx, tick: DEFAULT_BUILD_TTL_TICKS });
    expect(at.live).toEqual([]);
    expect(at.retired[0]).toMatchObject({ num: 10, reason: 'ttl', note: true });
  });
});

// ── The DIFFERENT prepare guard ───────────────────────────────────────────────────────────────────────────────

describe('retirePrepareGuards — NEVER on Agent-return; scope-committed / PR-terminal / TTL-to-first-PR only', () => {
  const guard = () => [{ num: 20, kind: 'prepare', lane: 5, spawnedTick: 0, sawPr: false }];

  it('stays LIVE while the item is still unshaped and no PR has appeared (a slow but healthy prepare)', () => {
    const { live, retired } = retirePrepareGuards(guard(), { unshaped: [{ num: 20 }], prs: [], tick: 2 });
    expect(retired).toEqual([]);
    expect(live).toHaveLength(1);
  });

  it('does NOT retire on Agent-return — there is no return path in the prepare guard at all', () => {
    // The build guard would retire on return; the prepare guard has no such input. Even with the item still
    // unshaped and no PR, the entry must persist (returning at PR-open is several ticks before merge).
    const { live } = retirePrepareGuards(guard(), { unshaped: [{ num: 20 }], prs: [], tick: 1 });
    expect(live).toHaveLength(1);
  });

  it('retires SCOPE-COMMITTED once the item leaves state.unshaped (its scope landed)', () => {
    const { live, retired } = retirePrepareGuards(guard(), { unshaped: [], prs: [], tick: 1 });
    expect(live).toEqual([]);
    expect(retired[0]).toMatchObject({ num: 20, reason: 'scope-committed' });
  });

  it('TTL fires ONLY while no PR ever appeared — a slow-but-live prepare past the TTL with an OPEN PR is void, not re-dispatched', () => {
    const late = DEFAULT_PREPARE_TTL_TICKS + 2;
    // No PR ever → TTL fires (died pre-PR).
    const died = retirePrepareGuards(guard(), { unshaped: [{ num: 20 }], prs: [], tick: late });
    expect(died.retired[0]).toMatchObject({ reason: 'ttl', note: true });
    // Open PR exists → TTL is VOID; the entry stays live even well past the TTL.
    const alive = retirePrepareGuards(guard(), {
      unshaped: [{ num: 20 }], prs: [{ num: 20, prNumber: 99, state: 'OPEN', labels: [] }], tick: late,
    });
    expect(alive.retired).toEqual([]);
    expect(alive.live[0].sawPr).toBe(true); // sticky flip persisted
  });

  it('retires PR-TERMINAL once a seen PR leaves the open set (sawPr sticky → terminal, not a false TTL)', () => {
    const seen = [{ num: 20, kind: 'prepare', lane: 5, spawnedTick: 0, sawPr: true }];
    const { live, retired } = retirePrepareGuards(seen, { unshaped: [{ num: 20 }], prs: [], tick: 3 });
    expect(live).toEqual([]);
    expect(retired[0]).toMatchObject({ num: 20, reason: 'pr-terminal' });
  });

  it('a prepare-decision guard keys retirement on the UNPREPARED decision set, not unshaped', () => {
    const dg = [{ num: 30, kind: 'prepare-decision', lane: 6, spawnedTick: 0, sawPr: false }];
    // still unprepared → live
    expect(retirePrepareGuards(dg, { decisions: [{ num: 30, prepared: false }], prs: [], tick: 1 }).live).toHaveLength(1);
    // preparedDate landed (prepared:true) → scope-committed (left the pending set)
    const done = retirePrepareGuards(dg, { decisions: [{ num: 30, prepared: true }], prs: [], tick: 1 });
    expect(done.retired[0]).toMatchObject({ num: 30, reason: 'scope-committed' });
  });
});

describe('planPrepareSpawns — union re-dispatch gate + lane exclusion (SKILL §3b/§3e)', () => {
  it('spawns one prepare-scope agent per unshaped item, consuming free lanes', () => {
    const r = planPrepareSpawns({ unshaped: [{ num: 20 }, { num: 21 }], availableLanes: [5, 6], tick: 0 });
    expect(r.scopeSpawns).toEqual([{ num: 20, lane: 5 }, { num: 21, lane: 6 }]);
    expect(r.newGuards).toEqual([
      { num: 20, kind: 'prepare', lane: 5, spawnedTick: 0, sawPr: false },
      { num: 21, kind: 'prepare', lane: 6, spawnedTick: 0, sawPr: false },
    ]);
  });

  it('SKIPS an item with a live prepare-guard entry (in-flight)', () => {
    const r = planPrepareSpawns({ unshaped: [{ num: 20 }], livePrepareGuards: [{ num: 20, kind: 'prepare', lane: 5 }], availableLanes: [7], tick: 1 });
    expect(r.scopeSpawns).toEqual([]);
  });

  it('SKIPS an item that already has an OPEN PR — the union backstop when the guard is lost', () => {
    const r = planPrepareSpawns({ unshaped: [{ num: 20 }], prs: [{ num: 20, prNumber: 99, state: 'OPEN' }], availableLanes: [7], tick: 1 });
    expect(r.scopeSpawns).toEqual([]);
  });

  it('HOLDS (a note, no spawn) when no free lane remains', () => {
    const r = planPrepareSpawns({ unshaped: [{ num: 20 }], availableLanes: [], tick: 0 });
    expect(r.scopeSpawns).toEqual([]);
    expect(r.notes[0].kind).toBe('prepare-no-lane');
  });

  it('spawns a prepare-decision agent ONLY for an UNPREPARED decision', () => {
    const r = planPrepareSpawns({ decisions: [{ num: 30, prepared: false }, { num: 31, prepared: true }], availableLanes: [5, 6], tick: 0 });
    expect(r.decisionSpawns).toEqual([{ num: 30, lane: 5 }]);
    expect(r.newGuards[0].kind).toBe('prepare-decision');
  });
});

// ── The fix guard — two pieces of state ───────────────────────────────────────────────────────────────────────

describe('planFixSpawns — in-flight test + retry cap across bounce cycles (SKILL §3c)', () => {
  const changesPr = (pr, num) => ({ num, prNumber: pr, state: 'OPEN', labels: ['review:changes'] });

  it('spawns a fix for a conveyor-launched review:changes PR and bumps the attempt counter', () => {
    const r = planFixSpawns({ prs: [changesPr(99, 40)], launchedNums: [40], availableLanes: [5], tick: 0 });
    expect(r.spawns).toEqual([{ pr: 99, num: 40, lane: 5 }]);
    expect(r.newGuards).toEqual([{ pr: 99, num: 40, lane: 5, spawnedTick: 0 }]);
    expect(r.fixAttempts).toEqual({ 99: 1 });
  });

  it('does NOT fix a review:changes PR the conveyor did not launch', () => {
    const r = planFixSpawns({ prs: [changesPr(99, 40)], launchedNums: [], availableLanes: [5], tick: 0 });
    expect(r.spawns).toEqual([]);
  });

  it('SKIPS a PR with a live fix-guard ENTRY (the in-flight test stops the immediate re-arm double-dispatch)', () => {
    const r = planFixSpawns({ prs: [changesPr(99, 40)], launchedNums: [40], liveFixGuards: [{ pr: 99, num: 40 }], availableLanes: [5], tick: 1 });
    expect(r.spawns).toEqual([]);
  });

  it('the retry cap BINDS across fresh bounce cycles — a persisted counter at the cap surfaces, never re-fixes', () => {
    // A new human bounce is a fresh review:changes with NO live entry — the counter (persisted, not on the entry)
    // is what makes the cap bind. At cap (3) the PR is surfaced for /review, not auto-fixed.
    const r = planFixSpawns({ prs: [changesPr(99, 40)], launchedNums: [40], fixAttempts: { 99: DEFAULT_FIX_RETRY_CAP }, availableLanes: [5], tick: 5 });
    expect(r.spawns).toEqual([]);
    expect(r.notes[0]).toMatchObject({ kind: 'fix-exhausted', pr: 99, attempts: DEFAULT_FIX_RETRY_CAP });
    expect(r.fixAttempts[99]).toBe(DEFAULT_FIX_RETRY_CAP); // not bumped past the cap
  });

  // #2643 — the cap must SURVIVE a conveyor restart. On a fresh conveyor the in-session `fixAttempts` map is EMPTY,
  // so the cap binds only if it reads the DURABLE floor (`prRearmCounts`) derived from the PR's re-arm comments.
  it('binds the cap from the DURABLE floor alone when the in-session tally was wiped by a restart', () => {
    const r = planFixSpawns({
      prs: [changesPr(99, 40)], launchedNums: [40],
      fixAttempts: {},                         // restart wiped the session tally
      prRearmCounts: { 99: DEFAULT_FIX_RETRY_CAP }, // but the PR carries 3 durable re-arm comments
      availableLanes: [5], tick: 0,
    });
    expect(r.spawns).toEqual([]); // cap binds → no re-fix from zero
    expect(r.notes[0]).toMatchObject({ kind: 'fix-exhausted', pr: 99, attempts: DEFAULT_FIX_RETRY_CAP });
  });

  it('binds on max(in-session, durable) and re-seeds the in-session tally off the durable floor on the first spawn', () => {
    // Post-restart: in-session 0, durable 2 → attempts=2 (< cap) → spawn, and the bumped tally re-seeds to 3.
    const r = planFixSpawns({
      prs: [changesPr(99, 40)], launchedNums: [40], fixAttempts: {}, prRearmCounts: { 99: 2 },
      availableLanes: [5], tick: 0,
    });
    expect(r.spawns).toEqual([{ pr: 99, num: 40, lane: 5 }]);
    expect(r.fixAttempts[99]).toBe(3); // re-primed from the durable floor, not 1
  });

  it('a died-before-rearm fix (no durable comment) still terminates via the in-session tally', () => {
    // The fix agent died before posting a re-arm comment, so the durable floor is 0; the in-session tally (which
    // bumps at spawn) is what carries it to the cap. max(3, 0) = 3 → surfaced, not re-fixed.
    const r = planFixSpawns({
      prs: [changesPr(99, 40)], launchedNums: [40], fixAttempts: { 99: DEFAULT_FIX_RETRY_CAP }, prRearmCounts: { 99: 0 },
      availableLanes: [5], tick: 9,
    });
    expect(r.spawns).toEqual([]);
    expect(r.notes[0]).toMatchObject({ kind: 'fix-exhausted', pr: 99 });
  });
});

describe('retireFixGuards + clearTerminalFixAttempts — entry vs. counter lifetimes (SKILL §3c)', () => {
  it('retires the ENTRY when the PR no longer carries review:changes (re-armed to pending) — counter untouched', () => {
    const { live, retired } = retireFixGuards([{ pr: 99, num: 40, spawnedTick: 0 }], {
      prs: [{ num: 40, prNumber: 99, state: 'OPEN', labels: ['review:pending'] }], tick: 1,
    });
    expect(live).toEqual([]);
    expect(retired[0]).toMatchObject({ pr: 99, reason: 'resolved' });
  });

  it('the attempt counter SURVIVES entry retirement and clears ONLY when the PR leaves the open set', () => {
    // Still open (re-armed) → counter kept.
    expect(clearTerminalFixAttempts({ 99: 2 }, [{ prNumber: 99, state: 'OPEN' }])).toEqual({ 99: 2 });
    // PR gone from the open list (merged/closed) → counter cleared.
    expect(clearTerminalFixAttempts({ 99: 2 }, [])).toEqual({});
  });

  it('retires the entry on TTL if the PR is still review:changes past the backstop (still cap-gated on re-dispatch)', () => {
    const { retired } = retireFixGuards([{ pr: 99, num: 40, spawnedTick: 0 }], {
      prs: [{ num: 40, prNumber: 99, state: 'OPEN', labels: ['review:changes'] }], tick: 5, ttlTicks: 5,
    });
    expect(retired[0]).toMatchObject({ pr: 99, reason: 'ttl', note: true });
  });
});

// ── The CI-HEAL guard — green-at-open PR gone RED / BEHIND (SKILL §3c-ci, #2666) ──────────────────────────────────

describe('planCiHealSpawns — trigger, exclusions, in-flight test + restart-surviving retry cap (SKILL §3c-ci)', () => {
  // A conveyor PR that was GREEN AT OPEN (carries `ready-to-merge`) and has since gone RED on a required check.
  const redPr = (pr, num, labels = ['ready-to-merge']) => ({ num, prNumber: pr, state: 'OPEN', ci: 'fail', labels });

  it('spawns a CI-heal for a conveyor-launched was-green PR gone red-CI and bumps the counter', () => {
    const r = planCiHealSpawns({ prs: [redPr(99, 40)], launchedNums: [40], availableLanes: [5], tick: 0 });
    expect(r.spawns).toEqual([{ pr: 99, num: 40, lane: 5, reason: 'red-ci' }]);
    expect(r.newGuards).toEqual([{ pr: 99, num: 40, lane: 5, spawnedTick: 0 }]);
    expect(r.ciHealAttempts).toEqual({ 99: 1 });
  });

  it('does NOT heal a PR that was NEVER green at open (no ready-to-merge / review park) — the delivery agent escalated it', () => {
    const r = planCiHealSpawns({ prs: [redPr(99, 40, [])], launchedNums: [40], availableLanes: [5], tick: 0 });
    expect(r.spawns).toEqual([]);
  });

  it('does NOT heal a `review:changes` PR — the fix loop (§3c) owns it and already rebases', () => {
    const r = planCiHealSpawns({ prs: [redPr(99, 40, ['review:changes', 'ready-to-merge'])], launchedNums: [40], availableLanes: [5], tick: 0 });
    expect(r.spawns).toEqual([]);
  });

  it('does NOT heal a PR the conveyor did not launch', () => {
    const r = planCiHealSpawns({ prs: [redPr(99, 40)], launchedNums: [], availableLanes: [5], tick: 0 });
    expect(r.spawns).toEqual([]);
  });

  it('does NOT heal a green PR (ci !== fail and not BEHIND)', () => {
    const r = planCiHealSpawns({ prs: [{ num: 40, prNumber: 99, state: 'OPEN', ci: 'pass', labels: ['ready-to-merge'] }], launchedNums: [40], availableLanes: [5], tick: 0 });
    expect(r.spawns).toEqual([]);
  });

  it('heals a BEHIND + PARKED PR (the not-landable BEHIND case #2183 leaves), reason BEHIND', () => {
    const r = planCiHealSpawns({
      prs: [{ num: 40, prNumber: 99, state: 'OPEN', ci: 'pass', mergeStateStatus: 'BEHIND', labels: ['review:human'] }],
      launchedNums: [40], availableLanes: [5], tick: 0,
    });
    expect(r.spawns).toEqual([{ pr: 99, num: 40, lane: 5, reason: 'behind' }]);
  });

  it('does NOT heal a BEHIND but LANDABLE PR (ready-to-merge, green) — that is #2183\'s job, not this loop', () => {
    const r = planCiHealSpawns({
      prs: [{ num: 40, prNumber: 99, state: 'OPEN', ci: 'pass', mergeStateStatus: 'BEHIND', labels: ['ready-to-merge'] }],
      launchedNums: [40], availableLanes: [5], tick: 0,
    });
    expect(r.spawns).toEqual([]);
  });

  it('SKIPS a PR with a live CI-heal ENTRY (the in-flight test stops a duplicate heal on the same red episode)', () => {
    const r = planCiHealSpawns({ prs: [redPr(99, 40)], launchedNums: [40], liveCiHealGuards: [{ pr: 99, num: 40 }], availableLanes: [5], tick: 1 });
    expect(r.spawns).toEqual([]);
  });

  it('the retry cap BINDS from the persisted in-session counter — at cap it surfaces for /review, never re-heals', () => {
    const r = planCiHealSpawns({ prs: [redPr(99, 40)], launchedNums: [40], ciHealAttempts: { 99: DEFAULT_CI_HEAL_RETRY_CAP }, availableLanes: [5], tick: 5 });
    expect(r.spawns).toEqual([]);
    expect(r.notes[0]).toMatchObject({ kind: 'ci-heal-exhausted', pr: 99, attempts: DEFAULT_CI_HEAL_RETRY_CAP });
  });

  it('binds the cap from the DURABLE floor alone when a restart wiped the in-session tally (#2666 mirrors #2643)', () => {
    const r = planCiHealSpawns({
      prs: [redPr(99, 40)], launchedNums: [40],
      ciHealAttempts: {},                            // restart wiped the session tally
      prCiHealCounts: { 99: DEFAULT_CI_HEAL_RETRY_CAP }, // but the PR carries 3 durable CI-heal comments
      availableLanes: [5], tick: 0,
    });
    expect(r.spawns).toEqual([]);
    expect(r.notes[0]).toMatchObject({ kind: 'ci-heal-exhausted', pr: 99, attempts: DEFAULT_CI_HEAL_RETRY_CAP });
  });

  it('binds on max(in-session, durable) and re-seeds the in-session tally off the durable floor on the first spawn', () => {
    const r = planCiHealSpawns({
      prs: [redPr(99, 40)], launchedNums: [40], ciHealAttempts: {}, prCiHealCounts: { 99: 2 },
      availableLanes: [5], tick: 0,
    });
    expect(r.spawns).toEqual([{ pr: 99, num: 40, lane: 5, reason: 'red-ci' }]);
    expect(r.ciHealAttempts[99]).toBe(3); // re-primed from the durable floor, not 1
  });

  it('surfaces a no-lane hold rather than dropping the heal', () => {
    const r = planCiHealSpawns({ prs: [redPr(99, 40)], launchedNums: [40], availableLanes: [], tick: 0 });
    expect(r.spawns).toEqual([]);
    expect(r.notes[0]).toMatchObject({ kind: 'ci-heal-no-lane', pr: 99 });
  });
});

describe('retireCiHealGuards + clearTerminalCiHealAttempts — entry vs. counter lifetimes (SKILL §3c-ci)', () => {
  it('retires the ENTRY when CI recovered (ci no longer fail) — counter untouched', () => {
    const { live, retired } = retireCiHealGuards([{ pr: 99, num: 40, spawnedTick: 0 }], {
      prs: [{ num: 40, prNumber: 99, state: 'OPEN', ci: 'pass', labels: ['ready-to-merge'] }], tick: 1,
    });
    expect(live).toEqual([]);
    expect(retired[0]).toMatchObject({ pr: 99, reason: 'resolved' });
  });

  it('keeps the ENTRY live while the PR is still red (mid-heal), retiring it only on recovery or TTL', () => {
    const { live } = retireCiHealGuards([{ pr: 99, num: 40, spawnedTick: 0 }], {
      prs: [{ num: 40, prNumber: 99, state: 'OPEN', ci: 'fail', labels: ['ready-to-merge'] }], tick: 1, ttlTicks: 5,
    });
    expect(live).toHaveLength(1);
  });

  it('retires the entry on TTL if the PR is still red past the backstop (still cap-gated on re-dispatch)', () => {
    const { retired } = retireCiHealGuards([{ pr: 99, num: 40, spawnedTick: 0 }], {
      prs: [{ num: 40, prNumber: 99, state: 'OPEN', ci: 'fail', labels: ['ready-to-merge'] }], tick: 5, ttlTicks: 5,
    });
    expect(retired[0]).toMatchObject({ pr: 99, reason: 'ttl', note: true });
  });

  it('the attempt counter SURVIVES entry retirement and clears ONLY when the PR leaves the open set', () => {
    expect(clearTerminalCiHealAttempts({ 99: 2 }, [{ prNumber: 99, state: 'OPEN' }])).toEqual({ 99: 2 });
    expect(clearTerminalCiHealAttempts({ 99: 2 }, [])).toEqual({});
  });
});

// ── Watcher arming ────────────────────────────────────────────────────────────────────────────────────────────

describe('releaseSessionForNum — the merge-time auto-release slug per owning-agent kind (SKILL §4/§3, #2700)', () => {
  it('derives the build lease by default, and the prepare/decision lease when a live prepare guard holds the num', () => {
    const buildOnly = new Map();
    expect(releaseSessionForNum(40, buildOnly)).toBe('conveyor-40');
    expect(releaseSessionForNum(40, new Map([['40', 'prepare']]))).toBe('prepare-40');
    expect(releaseSessionForNum(40, new Map([['40', 'prepare-decision']]))).toBe('prepare-decision-40');
    // A missing / non-Map lookup degrades to the build session (never throws).
    expect(releaseSessionForNum(40, undefined)).toBe('conveyor-40');
  });
});

describe('armWatchers — one watcher per conveyor-launched OPEN PR (SKILL §4)', () => {
  const pr = (num, prNumber) => ({ num, prNumber, state: 'OPEN', labels: [] });

  it('arms a watcher (with its build release-session) only for a PR whose num this conveyor launched', () => {
    const r = armWatchers([pr(40, 99), pr(41, 100)], [40], []);
    expect(r.arm).toEqual([{ pr: 99, releaseSession: 'conveyor-40' }]);
    expect(r.nextWatched).toEqual([99]);
  });

  it('tags a prepare PR with its prepare release-session (from the live prepare guard), not the build one', () => {
    const r = armWatchers([pr(41, 100)], [41], [], [{ num: 41, kind: 'prepare' }]);
    expect(r.arm).toEqual([{ pr: 100, releaseSession: 'prepare-41' }]);
  });

  it('does not re-arm a PR already watched, and prunes a watched PR that has left the open set', () => {
    const r = armWatchers([pr(40, 99)], [40, 41], [99, 100]); // 100 (num 41) no longer open
    expect(r.arm).toEqual([]); // 99 already watched
    expect(r.nextWatched).toEqual([99]); // 100 pruned (its watcher already exited)
  });
});

// ── Idle-stop ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('assessIdleStop — queue-empty AND no operator feedback (SKILL §6)', () => {
  const MIN = 60 * 1000;

  it('stops only when BOTH the queue is empty AND the operator has been silent past the window', () => {
    const empty = { queue: [], lanes: [], prs: [], launchedNums: [] };
    expect(assessIdleStop({ ...empty, now: 20 * MIN, lastOperatorTurn: 0, idleWindowMs: 15 * MIN }).stop).toBe(true);
    // Silent long enough but queue not empty → no stop.
    expect(assessIdleStop({ queue: [{ num: 1, buildQueued: true }], now: 20 * MIN, lastOperatorTurn: 0, idleWindowMs: 15 * MIN }).stop).toBe(false);
    // Queue empty but recent operator feedback → no stop.
    expect(assessIdleStop({ ...empty, now: 5 * MIN, lastOperatorTurn: 0, idleWindowMs: 15 * MIN }).stop).toBe(false);
  });

  it('an in-flight lane or an open conveyor PR keeps the queue non-empty', () => {
    const base = { now: 99 * MIN, lastOperatorTurn: 0, idleWindowMs: 15 * MIN };
    expect(assessIdleStop({ ...base, queue: [], lanes: [{ lane: 4 }], prs: [], launchedNums: [] }).stop).toBe(false);
    expect(assessIdleStop({ ...base, queue: [], lanes: [], prs: [{ num: 40, prNumber: 99, state: 'OPEN' }], launchedNums: [40] }).stop).toBe(false);
  });

  it('never stops when the operator-feedback clock is unknown (conservative — a fresh session)', () => {
    expect(assessIdleStop({ queue: [], lanes: [], prs: [], launchedNums: [], now: null, lastOperatorTurn: null }).stop).toBe(false);
  });
});

// ── Watcher-exit router ───────────────────────────────────────────────────────────────────────────────────────

describe('routeWatcherExit — the exit-code → action table (SKILL §3)', () => {
  it('maps each exit code to its branch', () => {
    expect(routeWatcherExit(0).action).toBe('merged-freed');
    expect(routeWatcherExit(3).action).toBe('rearm-timeout');
    expect(routeWatcherExit(4).action).toBe('anomaly-closed');
    expect(routeWatcherExit(1).action).toBe('error');
    expect(routeWatcherExit(7).action).toBe('error'); // unknown code
  });

  it('splits a parked (2) PR by its label: review:changes → fix, any other review label → surface', () => {
    expect(routeWatcherExit(2, ['review:changes']).action).toBe('dispatch-fix');
    expect(routeWatcherExit(2, ['review:human']).action).toBe('surface-review');
    expect(routeWatcherExit(2, ['review:pending']).action).toBe('surface-review');
  });
});

// ── The whole composition ─────────────────────────────────────────────────────────────────────────────────────

describe('planTick — composes the tick and threads nextState', () => {
  it('filters the plan through guards, records new build guards, and grows launchedNums', () => {
    const out = planTick({
      state: { queue: [{ num: 10, buildQueued: true }, { num: 11, buildQueued: true }], lanes: [], prs: [] },
      plan: { launch: [{ num: 10, lane: 4 }, { num: 11, lane: 5 }] },
      freeLanes: [4, 5, 6],
      bookkeeping: { tick: 0, buildGuards: [{ num: 11, lane: 5, spawnedTick: 0 }] }, // 11 already guarded
    });
    // 11 is suppressed (live guard); only 10 spawns.
    expect(out.decisions.spawnBuilds).toEqual([{ num: 10, lane: 4 }]);
    expect(out.decisions.suppressedBuilds).toEqual([{ num: 11, lane: 5, by: 'num' }]);
    expect(out.nextState.tick).toBe(1);
    expect(out.nextState.buildGuards).toEqual(expect.arrayContaining([
      { num: 11, lane: 5, spawnedTick: 0 },
      { num: 10, lane: 4, spawnedTick: 0 },
    ]));
    expect(out.nextState.launchedNums).toContain('10');
  });

  it('shares the free-lane pool across builds and prepares — a prepare never takes a build lane this tick', () => {
    const out = planTick({
      state: { queue: [{ num: 10, buildQueued: true }], unshaped: [{ num: 20 }], lanes: [], prs: [] },
      plan: { launch: [{ num: 10, lane: 4 }] },
      freeLanes: [4, 5],
      bookkeeping: { tick: 0 },
    });
    expect(out.decisions.spawnBuilds).toEqual([{ num: 10, lane: 4 }]);
    // The prepare must land on lane 5 (4 is taken by the build), never a collision.
    expect(out.decisions.spawnPrepareScope).toEqual([{ num: 20, lane: 5 }]);
  });

  it('excludes lanes across builds, prepares AND fixes in one tick — no lane is used twice', () => {
    const out = planTick({
      state: {
        queue: [{ num: 10, buildQueued: true }],
        unshaped: [{ num: 20 }],
        prs: [{ num: 40, prNumber: 99, state: 'OPEN', labels: ['review:changes'] }],
        lanes: [], needsSlice: [], decisions: [],
      },
      plan: { launch: [{ num: 10, lane: 4 }] },
      freeLanes: [4, 5, 6],
      bookkeeping: { tick: 0, launchedNums: [40] }, // 40 is a conveyor-launched PR now bounced
    });
    expect(out.decisions.spawnBuilds).toEqual([{ num: 10, lane: 4 }]);
    expect(out.decisions.spawnPrepareScope).toEqual([{ num: 20, lane: 5 }]);
    expect(out.decisions.spawnFixes).toEqual([{ pr: 99, num: 40, lane: 6 }]);
    // Every consumed lane is distinct — 4 (build), 5 (prepare), 6 (fix).
    const lanes = [4, 5, 6];
    expect(new Set(lanes).size).toBe(3);
    expect(out.nextState.fixAttempts).toEqual({ 99: 1 });
  });

  it('composes a CI-heal spawn for a green-at-open PR gone red, on a lane no build/prepare/fix took (#2666)', () => {
    const out = planTick({
      state: {
        queue: [{ num: 10, buildQueued: true }],
        prs: [{ num: 40, prNumber: 99, state: 'OPEN', ci: 'fail', labels: ['ready-to-merge'] }],
        lanes: [], needsSlice: [], decisions: [],
      },
      plan: { launch: [{ num: 10, lane: 4 }] },
      freeLanes: [4, 5],
      bookkeeping: { tick: 0, launchedNums: [40] }, // 40 is a conveyor-launched PR now gone red after open
    });
    expect(out.decisions.spawnBuilds).toEqual([{ num: 10, lane: 4 }]);
    expect(out.decisions.spawnCiHeals).toEqual([{ pr: 99, num: 40, lane: 5, reason: 'red-ci' }]);
    expect(out.nextState.ciHealGuards).toEqual([{ pr: 99, num: 40, lane: 5, spawnedTick: 0 }]);
    expect(out.nextState.ciHealAttempts).toEqual({ 99: 1 });
  });

  it('retires a build guard via the lane-leased claim path — the guard drops out of nextState', () => {
    // Once the agent acquires its lane it shows leased in state.lanes; dispatch-plan then stops listing the
    // (now-claimed, off-queue) item, so plan.launch is empty. The guard must retire — not linger forever.
    const out = planTick({
      state: { queue: [], lanes: [{ lane: 4, num: 10 }], prs: [] },
      plan: { launch: [] },
      freeLanes: [],
      bookkeeping: { tick: 1, buildGuards: [{ num: 10, lane: 4, spawnedTick: 0 }] },
    });
    expect(out.decisions.retireGuards.build).toEqual([{ num: 10, lane: 4, reason: 'claimed' }]);
    expect(out.nextState.buildGuards).toEqual([]);
  });

  it('arms a watcher for a spawned build once its PR is open on a later tick, and stops when idle', () => {
    const idle = planTick({
      state: { queue: [], lanes: [], prs: [] },
      plan: { launch: [] },
      bookkeeping: { tick: 3, launchedNums: [] },
      now: 100 * 60 * 1000, lastOperatorTurn: 0,
    });
    expect(idle.decisions.idleStop).toBe(true);
    expect(idle.decisions.statusLine).toContain('conveyor ·');
  });

  it('arms a watcher carrying the item build release-session for an open conveyor-launched PR (#2700)', () => {
    const out = planTick({
      state: { queue: [], lanes: [], prs: [{ num: 40, prNumber: 99, state: 'OPEN', labels: [] }] },
      plan: { launch: [] },
      bookkeeping: { tick: 2, launchedNums: [40], watched: [] },
    });
    expect(out.decisions.armWatchers).toEqual([{ pr: 99, releaseSession: 'conveyor-40' }]);
    expect(out.nextState.watched).toEqual([99]);
  });

  it('consumes state.health as a backstop — a stalled lane surfaces as an actionable note (#2616/#2700)', () => {
    const out = planTick({
      state: {
        queue: [], lanes: [{ lane: 4, num: 10 }], prs: [],
        health: { verdict: 'warn', stalled: [{ lane: 4, num: 10, idleS: 240 }] },
      },
      plan: { launch: [] },
      bookkeeping: { tick: 5 },
    });
    expect(out.decisions.notes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'lane-stalled', num: 10, lane: 4 }),
    ]));
    expect(out.decisions.statusLine).toContain('health warn');
  });

  it('surfaces a needs-slice epic and a prepared decision as notes (no agent, no guard)', () => {
    const out = planTick({
      state: { queue: [], needsSlice: [{ num: 50, epicState: 'unsliced' }], decisions: [{ num: 60, prepared: true }], lanes: [], prs: [] },
      plan: { launch: [] },
      bookkeeping: { tick: 0 },
    });
    expect(out.decisions.notes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'needs-slice', num: 50 }),
      expect.objectContaining({ kind: 'decision-ready', num: 60 }),
    ]));
    // A prepared decision is PRESENTED, never spawned.
    expect(out.decisions.spawnPrepareDecision).toEqual([]);
  });
});

describe('buildStatusLine — the terse per-tick line (SKILL §5)', () => {
  it('counts building / preparing / fixing / queued / parked and the health verdict', () => {
    const line = buildStatusLine({
      queue: [{ num: 10, buildQueued: true }, { num: 11, buildQueued: true }],
      lanes: [{ lane: 4, num: 12 }],
      prs: [{ num: 13, prNumber: 99, state: 'OPEN', labels: ['review:human'] }],
      health: { verdict: 'ok' },
      liveBuildGuards: [{ num: 10, lane: 5 }],
      livePrepareGuards: [{ num: 20, lane: 6 }],
      liveFixGuards: [{ pr: 99, num: 13 }],
      liveCiHealGuards: [{ pr: 98, num: 14 }],
      launchedNums: [10, 12, 13, 14, 20],
    });
    // building = {10 (guard), 12 (active lane)} = 2; preparing = 1; fixing = 1; healing = 1; parked = 1 (#13).
    expect(line).toContain('2 building');
    expect(line).toContain('1 preparing');
    expect(line).toContain('1 fixing');
    expect(line).toContain('1 healing');
    expect(line).toContain('1 parked');
    expect(line).toContain('health ok');
  });

  it('appends infra-blocked count and a warn flag with the stalled lanes', () => {
    const line = buildStatusLine({
      queue: [], lanes: [], prs: [],
      health: { verdict: 'warn', stalled: [{ lane: 7 }] },
      infraBlocked: [{ num: 80 }],
    });
    expect(line).toContain('1 infra-blocked');
    expect(line).toContain('health warn');
    expect(line).toContain('lane-7');
  });
});
