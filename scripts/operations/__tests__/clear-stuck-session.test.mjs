/**
 * @file clear-stuck-session.test.mjs — #3383's mechanized GH #77683 workaround:
 *   {@link ../clear-stuck-session.mjs} (the declaration) and {@link ../clear-stuck-session-io.mjs} (the
 *   reader + the one sink).
 *
 * WHAT THIS FILE COVERS:
 *   - `assessStuck`'s five refusal branches, each independently, plus the one path that confirms stuck;
 *   - `planMove` never proceeding on the verdict's say alone or the human's say alone;
 *   - the full `read → assess → authorize → move` run through the engine + effect executor with a stub
 *     reader/sink — no `fs`, no `claude`, no `ps`;
 *   - the io shell's pure-ish helpers (`shortIdOf`, `findListingEntry`, `resolvePidAlive`,
 *     `scanRunStoreForSession`) against plain fixtures;
 *   - `moveJobDirAside` against a REAL temp directory (the one thing in this suite that touches a real
 *     filesystem, exactly as `restart-runner-io-real.test.mjs` isolates its own real-fs group) — the move
 *     itself, the idempotent already-moved replay, and the post-move verification read;
 *   - registration: `run.mjs#OPERATIONS` resolves the operation end to end.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { advanceWhileRunning, runStatus, startRun } from '../engine.mjs';
import { applyPendingEffects } from '../effect-executor.mjs';
import { createMemoryRunStore, newRunRecord } from '../run-store.mjs';
import { createRegistry } from '../registry.mjs';
import { resolveOperation } from '../run.mjs';
import {
  CLEAR_STUCK_SESSION_OP, QUARANTINE_MOVE_EFFECT, STUCK_JOB_STATE,
  shapeStuckRead, assessStuck, authorizeQuestion, planMove, clearStuckSessionOperation,
} from '../clear-stuck-session.mjs';
import {
  configDir, jobsDir, quarantineDir, shortIdOf, scanPsForSession, resolvePidAlive,
  findListingEntry, resolveSessionForPr, scanRunStoreForSession, moveJobDirAside,
  createClearStuckSessionReader, createClearStuckSessionSinks,
} from '../clear-stuck-session-io.mjs';

// ── fixtures ───────────────────────────────────────────────────────────────────────────────────────────────

const LISTING_ENTRY = Object.freeze({
  id: '08f5fdf9', cwd: '/repo', kind: 'background', startedAt: 1789161093591,
  sessionId: '08f5fdf9-bf30-4484-9ca4-d2dabe8f1f7f', name: 'review-2121', state: 'blocked',
});

/** A `readStuckFacts` raw result for the confirmed-stuck baseline — every test overrides from here. */
function stuckFacts(overrides = {}) {
  return {
    resolvedVia: 'session', requestedSession: '08f5fdf9', requestedPr: null,
    shortId: '08f5fdf9', fullSessionId: '08f5fdf9-bf30-4484-9ca4-d2dabe8f1f7f',
    jobDirPath: '/config/jobs/08f5fdf9', jobDirExists: true,
    stateJson: { state: 'blocked', detail: 'x', needs: 'y' },
    listingEntry: LISTING_ENTRY,
    pidAlive: false,
    runStoreBound: false, boundRuns: [],
    ...overrides,
  };
}

// ── shapeStuckRead ─────────────────────────────────────────────────────────────────────────────────────────

describe('shapeStuckRead', () => {
  it('defensively coalesces a bare/empty raw result', () => {
    expect(shapeStuckRead(null)).toMatchObject({
      resolvedVia: 'none', requestedSession: null, requestedPr: null, shortId: null,
      jobDirExists: false, stateJson: null, listingEntry: null, pidAlive: null,
      runStoreBound: false, boundRuns: [],
    });
  });

  it('carries a full raw result through untouched', () => {
    const read = shapeStuckRead(stuckFacts());
    expect(read.shortId).toBe('08f5fdf9');
    expect(read.stateJson).toEqual({ state: 'blocked', detail: 'x', needs: 'y' });
    expect(read.listingEntry).toEqual(LISTING_ENTRY);
    expect(read.pidAlive).toBe(false);
  });

  it('`pidAlive` reads null when there is no listing entry to attach it to', () => {
    expect(shapeStuckRead(stuckFacts({ listingEntry: null, pidAlive: false })).pidAlive).toBeNull();
  });
});

// ── assessStuck — the five refusals, and the one confirmation ────────────────────────────────────────────

describe('assessStuck', () => {
  it('confirms a genuinely stuck session — every signal agrees', () => {
    const v = assessStuck(shapeStuckRead(stuckFacts()));
    expect(v).toMatchObject({ confirmedStuck: true, shortId: '08f5fdf9', jobDirPath: '/config/jobs/08f5fdf9' });
    expect(v.reason).toMatch(/confirmed stuck/);
  });

  it('refusal 1 — no session could be resolved at all', () => {
    const v = assessStuck(shapeStuckRead(stuckFacts({ shortId: null })));
    expect(v.confirmedStuck).toBe(false);
    expect(v.reason).toMatch(/no session could be resolved/);
  });

  it('refusal 2 — no job directory on disk', () => {
    const v = assessStuck(shapeStuckRead(stuckFacts({ jobDirExists: false })));
    expect(v.confirmedStuck).toBe(false);
    expect(v.reason).toMatch(/no job directory exists/);
  });

  it('refusal 3 — not listed by `claude agents --json --all`', () => {
    const v = assessStuck(shapeStuckRead(stuckFacts({ listingEntry: null })));
    expect(v.confirmedStuck).toBe(false);
    expect(v.reason).toMatch(/not currently listed/);
  });

  it('refusal 4 — assessLiveness says something IS live (a live pid)', () => {
    const v = assessStuck(shapeStuckRead(stuckFacts({ pidAlive: true })));
    expect(v.confirmedStuck).toBe(false);
    expect(v.reason).toMatch(/NOT dead \(live-process\)/);
    expect(v.liveness).toMatchObject({ kind: 'live-process' });
  });

  it('refusal 4b — assessLiveness cannot tell (no pid signal at all)', () => {
    const v = assessStuck(shapeStuckRead(stuckFacts({ pidAlive: null })));
    expect(v.confirmedStuck).toBe(false);
    expect(v.reason).toMatch(/NOT dead \(liveness-unknown\)/);
  });

  it('refusal 5 — job state is not "blocked"', () => {
    const v = assessStuck(shapeStuckRead(stuckFacts({ stateJson: { state: 'working', detail: null, needs: null } })));
    expect(v.confirmedStuck).toBe(false);
    expect(v.reason).toMatch(/job state is "working"/);
  });

  it('refusal 6 — a run record still holds this session in-flight', () => {
    const v = assessStuck(shapeStuckRead(stuckFacts({ runStoreBound: true, boundRuns: [{ runId: 'run-1', key: 'dispatch:0' }] })));
    expect(v.confirmedStuck).toBe(false);
    expect(v.reason).toMatch(/run-1:dispatch:0/);
  });

  it('STUCK_JOB_STATE is "blocked" — pinned so a rename cannot silently widen the shape', () => {
    expect(STUCK_JOB_STATE).toBe('blocked');
  });
});

// ── authorizeQuestion / planMove ───────────────────────────────────────────────────────────────────────────

describe('authorizeQuestion', () => {
  it('names the session and reason whichever way the verdict went', () => {
    const stuck = assessStuck(shapeStuckRead(stuckFacts()));
    expect(authorizeQuestion({ verdict: stuck })).toMatch(/08f5fdf9 is confirmed stuck/);

    const notStuck = assessStuck(shapeStuckRead(stuckFacts({ pidAlive: true })));
    expect(authorizeQuestion({ verdict: notStuck })).toMatch(/NOT confirmed stuck/);
  });
});

describe('planMove — the human\'s answer only ever PERMITS, never MANUFACTURES, a move', () => {
  const stuckVerdict = assessStuck(shapeStuckRead(stuckFacts()));
  const notStuckVerdict = assessStuck(shapeStuckRead(stuckFacts({ pidAlive: true })));

  it('moves only when BOTH the verdict confirmed stuck AND the answer is "proceed"', () => {
    expect(planMove(stuckVerdict, 'proceed')).toMatchObject({ shouldMove: true, shortId: '08f5fdf9' });
  });

  it('refuses on a "proceed" answer over a verdict that did not confirm stuck', () => {
    expect(planMove(notStuckVerdict, 'proceed')).toMatchObject({ shouldMove: false });
  });

  it('refuses on a confirmed-stuck verdict the human declined ("abort")', () => {
    expect(planMove(stuckVerdict, 'abort')).toMatchObject({ shouldMove: false });
  });
});

// ── the full declaration, driven through the engine with a stub reader/sink ─────────────────────────────────

function driveTo(op, input) {
  const registry = createRegistry();
  registry.register(op);
  let run = startRun({ op: CLEAR_STUCK_SESSION_OP, id: 'run-css-1', input, registry });
  run = advanceWhileRunning(run, { registry });
  return { run, registry };
}

describe('clearStuckSessionOperation — driven end to end', () => {
  it('confirms stuck, the operator proceeds, and the move effect actually lands', async () => {
    const op = clearStuckSessionOperation({ readStuckFacts: () => stuckFacts() });
    let { run, registry } = driveTo(op, { session: '08f5fdf9', pr: 0 });

    expect(runStatus(run, { registry })).toBe('awaiting-confirm');
    expect(run.pending.of).toBe('operator');
    expect(run.pending.options).toEqual(['proceed', 'abort']);
    expect(run.findings.assess.confirmedStuck).toBe(true);

    run = advanceWhileRunning(run, { registry, resume: { step: 'authorize', value: 'proceed' } });
    expect(runStatus(run, { registry })).toBe('awaiting-effect');

    const moved = [];
    const store = createMemoryRunStore();
    const sinks = { [QUARANTINE_MOVE_EFFECT]: async (payload) => { moved.push(payload); return { moved: true, verifiedCleared: true }; } };
    const outcome = await applyPendingEffects(run, { sinks, store, attemptedBy: 'test' });
    expect(outcome.error).toBeNull();
    run = advanceWhileRunning(outcome.run, { registry });

    expect(runStatus(run, { registry })).toBe('complete');
    expect(moved).toEqual([{ shortId: '08f5fdf9', jobDirPath: '/config/jobs/08f5fdf9' }]);
  });

  it('confirms stuck, but the operator ABORTS — zero effects declared', async () => {
    const op = clearStuckSessionOperation({ readStuckFacts: () => stuckFacts() });
    let { run, registry } = driveTo(op, { session: '08f5fdf9', pr: 0 });
    run = advanceWhileRunning(run, { registry, resume: { step: 'authorize', value: 'abort' } });
    expect(runStatus(run, { registry })).toBe('complete');
    expect(run.findings.move.effects).toEqual([]);
  });

  it('NOT confirmed stuck — even an operator answering "proceed" moves nothing', async () => {
    const op = clearStuckSessionOperation({ readStuckFacts: () => stuckFacts({ pidAlive: true }) });
    let { run, registry } = driveTo(op, { session: '08f5fdf9', pr: 0 });
    expect(run.findings.assess.confirmedStuck).toBe(false);
    run = advanceWhileRunning(run, { registry, resume: { step: 'authorize', value: 'proceed' } });
    expect(runStatus(run, { registry })).toBe('complete');
    expect(run.findings.move.effects).toEqual([]);
  });

  it('refuses a malformed reader (not a function)', () => {
    expect(() => clearStuckSessionOperation({})).toThrow(/needs a `readStuckFacts/);
  });
});

// ── io shell: the pure-ish helpers ─────────────────────────────────────────────────────────────────────────

describe('configDir / jobsDir / quarantineDir', () => {
  it('honours CLAUDE_CONFIG_DIR when set', () => {
    expect(configDir({ CLAUDE_CONFIG_DIR: '/custom/cfg' })).toBe('/custom/cfg');
  });
  it('falls back to a default derived from home when unset', () => {
    expect(configDir({})).toMatch(/\.claude$/);
  });
  it('jobsDir/quarantineDir compose off the config dir', () => {
    expect(jobsDir('/cfg')).toBe(join('/cfg', 'jobs'));
    expect(quarantineDir('/cfg')).toBe(join('/cfg', 'jobs', '.cleared'));
  });
});

describe('shortIdOf', () => {
  it('takes the id as-is when already short', () => {
    expect(shortIdOf('08f5fdf9')).toBe('08f5fdf9');
  });
  it('takes the first hyphen segment of a full UUID', () => {
    expect(shortIdOf('08f5fdf9-bf30-4484-9ca4-d2dabe8f1f7f')).toBe('08f5fdf9');
  });
  it('null/empty in, null out', () => {
    expect(shortIdOf('')).toBeNull();
    expect(shortIdOf(null)).toBeNull();
  });
});

describe('findListingEntry', () => {
  const agents = [LISTING_ENTRY, { id: 'aaaaaaaa', sessionId: 'aaaaaaaa-0000-0000-0000-000000000000', name: 'other' }];
  it('matches by exact `id`', () => {
    expect(findListingEntry('08f5fdf9', agents)).toBe(LISTING_ENTRY);
  });
  it('falls back to a sessionId prefix match', () => {
    expect(findListingEntry('08f5fdf9-bf30-4484-9ca4-d2dabe8f1f7f', agents)).toBe(LISTING_ENTRY);
  });
  it('null when nothing matches, or the list is empty/garbage', () => {
    expect(findListingEntry('zzzzzzzz', agents)).toBeNull();
    expect(findListingEntry('08f5fdf9', null)).toBeNull();
  });
});

describe('scanPsForSession', () => {
  it('true when the full session id appears in the ps output', () => {
    expect(scanPsForSession('08f5fdf9-bf30-4484-9ca4-d2dabe8f1f7f', { exec: () => '... --resume=08f5fdf9-bf30-4484-9ca4-d2dabe8f1f7f ...' })).toBe(true);
  });
  it('false when it does not', () => {
    expect(scanPsForSession('08f5fdf9-bf30-4484-9ca4-d2dabe8f1f7f', { exec: () => 'unrelated process list' })).toBe(false);
  });
  it('false for a null/empty id — nothing to scan for', () => {
    expect(scanPsForSession(null, { exec: () => { throw new Error('must not be called'); } })).toBe(false);
  });
  it('null (not false) when the probe itself cannot run', () => {
    expect(scanPsForSession('x-y-z', { exec: () => { throw new Error('ps: command not found'); } })).toBeNull();
  });
});

describe('resolvePidAlive', () => {
  it('honours the listing row\'s own pid when one is present, never widening with ps', () => {
    const isPidAlive = () => true;
    const exec = () => { throw new Error('must not be called — a pid was present'); };
    expect(resolvePidAlive({ pid: 4242 }, { fullSessionId: 'irrelevant', isPidAlive, exec })).toBe(true);
  });
  it('falls back to the ps-aux scan when the row has no pid at all (the known-stuck shape)', () => {
    const exec = () => '... 08f5fdf9-bf30-4484-9ca4-d2dabe8f1f7f ...';
    expect(resolvePidAlive({}, { fullSessionId: '08f5fdf9-bf30-4484-9ca4-d2dabe8f1f7f', isPidAlive: () => { throw new Error('no pid'); }, exec })).toBe(true);
    expect(resolvePidAlive({}, { fullSessionId: '08f5fdf9-bf30-4484-9ca4-d2dabe8f1f7f', isPidAlive: () => { throw new Error('no pid'); }, exec: () => 'nothing here' })).toBe(false);
  });
});

describe('resolveSessionForPr', () => {
  it('resolves via reconcile-core.mjs#bindAgents, not a second lookup', () => {
    const agents = [{ id: 'abc12345', sessionId: 'abc12345-0000-0000-0000-000000000000', name: 'review-99', cwd: '/repo', laneHeadOid: null, pidAlive: false }];
    const fetchPr = (n) => ({ number: n, headRefOid: 'deadbeef', headRefName: 'lane/x' });
    expect(resolveSessionForPr(99, { fetchPr, agents })).toBe('abc12345');
  });
  it('null when the PR cannot be fetched, or nothing binds', () => {
    expect(resolveSessionForPr(99, { fetchPr: () => null, agents: [] })).toBeNull();
    expect(resolveSessionForPr(99, { fetchPr: (n) => ({ number: n, headRefOid: 'x' }), agents: [] })).toBeNull();
  });
});

describe('scanRunStoreForSession', () => {
  function storeWith(runs) {
    const s = createMemoryRunStore();
    for (const r of runs) s.write(r);
    return s;
  }

  const withOneEffect = (status) => {
    const rec = newRunRecord({ id: 'run-a', op: 'dispatch-lane', input: {} });
    return {
      ...rec,
      effects: [{ key: 'dispatch:0', type: 'x', stepIndex: 0, index: 0, status, handle: '08f5fdf9', payload: {} }],
    };
  };

  it('bound:true when a run holds an in-flight effect whose handle matches this session', () => {
    const store = storeWith([withOneEffect('in-flight')]);
    const res = scanRunStoreForSession({ shortId: '08f5fdf9', fullSessionId: '08f5fdf9-bf30-4484-9ca4-d2dabe8f1f7f', store });
    expect(res).toEqual({ bound: true, runs: [{ runId: 'run-a', key: 'dispatch:0' }] });
  });

  it('bound:false when no in-flight effect matches (an applied one does not count)', () => {
    const store = storeWith([withOneEffect('applied')]);
    expect(scanRunStoreForSession({ shortId: '08f5fdf9', fullSessionId: null, store }).bound).toBe(false);
  });

  it('bound:false with no session to check', () => {
    expect(scanRunStoreForSession({ shortId: null, fullSessionId: null, store: createMemoryRunStore() })).toEqual({ bound: false, runs: [] });
  });
});

// ── moveJobDirAside — the one real-filesystem group ───────────────────────────────────────────────────────

describe('moveJobDirAside — real temp directories, never the real ~/.claude', () => {
  it('moves the job dir aside, then verifies the daemon dropped it from the listing', async () => {
    const cfg = mkdtempSync(join(tmpdir(), 'clear-stuck-'));
    const jobDir = join(jobsDir(cfg), 'abcd1234');
    mkdirSync(jobDir, { recursive: true });
    writeFileSync(join(jobDir, 'state.json'), JSON.stringify({ state: 'blocked' }));

    try {
      const result = moveJobDirAside(
        { shortId: 'abcd1234', jobDirPath: jobDir },
        { cfgDir: cfg, now: () => 1789999999999, listAgents: () => [] },
      );
      expect(result.moved).toBe(true);
      expect(result.verifiedCleared).toBe(true);
      expect(existsSync(jobDir)).toBe(false);
      expect(existsSync(result.to)).toBe(true);
      expect(result.to).toBe(join(quarantineDir(cfg), 'abcd1234-1789999999999'));

      // the ORIGINAL contents travelled with the move, not just an empty directory
      expect(existsSync(join(result.to, 'state.json'))).toBe(true);
    } finally {
      rmSync(cfg, { recursive: true, force: true });
    }
  });

  it('reports the still-listed case honestly when verification finds the id has NOT dropped', () => {
    const cfg = mkdtempSync(join(tmpdir(), 'clear-stuck-'));
    const jobDir = join(jobsDir(cfg), 'abcd1234');
    mkdirSync(jobDir, { recursive: true });
    try {
      const result = moveJobDirAside(
        { shortId: 'abcd1234', jobDirPath: jobDir },
        { cfgDir: cfg, now: () => 1, listAgents: () => [{ id: 'abcd1234' }] },
      );
      expect(result.moved).toBe(true);
      expect(result.stillListed).toBe(true);
      expect(result.verifiedCleared).toBe(false);
    } finally {
      rmSync(cfg, { recursive: true, force: true });
    }
  });

  it('is idempotent on a replay after the source is already gone', () => {
    const cfg = mkdtempSync(join(tmpdir(), 'clear-stuck-'));
    const qDir = quarantineDir(cfg);
    mkdirSync(join(qDir, 'abcd1234-42'), { recursive: true });
    try {
      const result = moveJobDirAside(
        { shortId: 'abcd1234', jobDirPath: join(jobsDir(cfg), 'abcd1234') },
        { cfgDir: cfg, listAgents: () => [] },
      );
      expect(result).toMatchObject({ moved: false, alreadyGone: true, verifiedCleared: true, to: join(qDir, 'abcd1234-42') });
    } finally {
      rmSync(cfg, { recursive: true, force: true });
    }
  });
});

describe('createClearStuckSessionReader — wired with stubs, no real fs/claude/ps', () => {
  it('resolves via --session, reads the job state, and reports pidAlive from the ps-scan fallback', () => {
    const reader = createClearStuckSessionReader({
      cfgDir: '/cfg',
      listAgents: () => [LISTING_ENTRY],
      exists: (p) => p === join('/cfg', 'jobs', '08f5fdf9'),
      readFile: () => JSON.stringify({ state: 'blocked', detail: 'd', needs: 'n' }),
      exec: () => 'nothing matches here',
      isPidAlive: () => { throw new Error('no pid on this row'); },
      store: createMemoryRunStore(),
    });
    const raw = reader({ session: '08f5fdf9', pr: 0 });
    expect(raw).toMatchObject({
      resolvedVia: 'session', shortId: '08f5fdf9', jobDirExists: true,
      stateJson: { state: 'blocked', detail: 'd', needs: 'n' }, pidAlive: false, runStoreBound: false,
    });
  });

  it('resolves via --pr through bindAgents, and reports no job dir when none exists on disk', () => {
    const agents = [{ id: 'abc12345', sessionId: 'abc12345-0000-0000-0000-000000000000', name: 'fix-99', cwd: '/repo', laneHeadOid: null, pidAlive: false }];
    const reader = createClearStuckSessionReader({
      cfgDir: '/cfg',
      listAgents: () => agents,
      fetchPr: (n) => ({ number: n, headRefOid: null, headRefName: 'lane/x' }),
      exists: () => false,
      store: createMemoryRunStore(),
    });
    const raw = reader({ session: '', pr: 99 });
    expect(raw.resolvedVia).toBe('pr');
    expect(raw.shortId).toBe('abc12345');
    expect(raw.jobDirExists).toBe(false);
  });

  it('a listing that cannot be read yields no listing entry rather than throwing', () => {
    const reader = createClearStuckSessionReader({
      cfgDir: '/cfg',
      listAgents: () => { throw new Error('claude: not found'); },
      exists: () => true,
      readFile: () => '{}',
      store: createMemoryRunStore(),
    });
    const raw = reader({ session: '08f5fdf9', pr: 0 });
    expect(raw.listingEntry).toBeNull();
  });
});

describe('createClearStuckSessionSinks', () => {
  it('the QUARANTINE_MOVE_EFFECT sink calls moveJobDirAside with the injected io', async () => {
    const calls = [];
    const sinks = createClearStuckSessionSinks({
      cfgDir: '/cfg',
      exists: (p) => { calls.push(p); return false; },
      listAgents: () => [],
    });
    const result = await sinks[QUARANTINE_MOVE_EFFECT]({ shortId: 'abcd1234', jobDirPath: '/cfg/jobs/abcd1234' });
    expect(result.alreadyGone).toBe(true);
    expect(calls).toContain('/cfg/jobs/abcd1234');
  });
});

// ── registration ───────────────────────────────────────────────────────────────────────────────────────────

describe('registration — run.mjs#OPERATIONS resolves the real wiring', () => {
  it('resolveOperation(CLEAR_STUCK_SESSION_OP) builds a declaration and sinks with no throw', () => {
    const { declaration, sinks } = resolveOperation(CLEAR_STUCK_SESSION_OP);
    expect(declaration.name).toBe(CLEAR_STUCK_SESSION_OP);
    expect(declaration.stepNames).toEqual(['read', 'assess', 'authorize', 'move']);
    expect(typeof sinks[QUARANTINE_MOVE_EFFECT]).toBe('function');
  });
});
