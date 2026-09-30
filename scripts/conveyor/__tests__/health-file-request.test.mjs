import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, utimesSync, renameSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  keyFor, refFor, buildRequest, laneStarvationOpen, isDuplicate, countRecent, planFileRequests, recordRequested,
  renderFilingSection, readLedgerStrict, writeLedger, ledgerPath, claimForLanding, patchLedgerEntry,
  spliceFilingSection, withLedgerLock, DAY_MS, ATTEMPT_TIMEOUT_MS,
} from '../health-file-request.mjs';

const laneStarvation = { id: 'lane-starvation' };
const investigateSmell = { id: 'daemon-owed-no-dispatch' };
const knownFixSmell = {
  id: 'gh-call-failures',
  knownFix: { title: 'Health daemon: known fix for ${subject}', digestTemplate: 'Apply the known fix for ${subject}.', scope: ['we:scripts/x.mjs'], size: '2' },
};

function ep(overrides = {}) {
  return { key: 'k', smell: 'daemon-owed-no-dispatch', subject: 'we', status: 'open', id: '2026-09-28-x-we-0000', ...overrides };
}

describe('refFor', () => {
  it('is a deterministic, stable ref for a given episode id — the same input always gives the same ref', () => {
    expect(refFor('2026-09-28-x-we-0000')).toBe(refFor('2026-09-28-x-we-0000'));
    expect(refFor('2026-09-28-x-we-0000')).toMatch(/^lane\//);
  });
});

describe('buildRequest', () => {
  it('returns null with neither a known-fix template nor a product-change finding', () => {
    expect(buildRequest(ep(), investigateSmell)).toBeNull();
  });

  // #4079 review round 4, standards-conformance finding: this guard (added in round 2 to close a real
  // ref-collision — every id-less episode would otherwise share the literal ref `lane/health-file-undefined`)
  // had no test of its own.
  it('returns null for an episode with no `id`, even when a trigger condition otherwise fires — an id-less'
    + ' request would collide every such request onto the same literal ref', () => {
    const idLess = ep({ smell: 'gh-call-failures', id: null, investigation: { recommendation: { productChange: 'add a retry' } } });
    expect(buildRequest(idLess, knownFixSmell)).toBeNull();
  });

  it('fires from a known-fix template, interpolating the subject', () => {
    const req = buildRequest(ep({ smell: 'gh-call-failures' }), knownFixSmell);
    expect(req.title).toContain('we');
    expect(req.digest).toContain('we');
    expect(req.scope).toEqual(['we:scripts/x.mjs']);
    expect(req.size).toBe('2');
    expect(req.key).toBe(keyFor('gh-call-failures', 'we'));
  });

  it('fires from an investigation naming a concrete product change, even with no known-fix template', () => {
    const withInvestigation = ep({ investigation: { recommendation: { whatIsWrong: 'w', productChange: 'add a retry', nextStep: 'n' } } });
    const req = buildRequest(withInvestigation, investigateSmell);
    expect(req).not.toBeNull();
    expect(req.digest).toContain('add a retry');
    expect(req.scope).toEqual([]);
  });

  it('a known-fix template takes precedence over (and does not require) an investigation finding', () => {
    const withBoth = ep({ smell: 'gh-call-failures', investigation: { recommendation: { productChange: 'other' } } });
    const req = buildRequest(withBoth, knownFixSmell);
    expect(req.digest).not.toContain('other');
  });

  // #4079 review round 1, finding 6: this digest is what a committed card, a commit message and a PUBLIC PR
  // body carry (health-file-request-land.mjs) — it must never depend on the CALLER having already scrubbed
  // the investigation text, since a future caller (a test harness, a hand-built ledger entry) might not have.
  it('scrubs a credential-shaped token out of the digest, even though production also scrubs upstream', () => {
    const tok = `ghp_${'P'.repeat(36)}`;
    const withSecret = ep({ investigation: { recommendation: { whatIsWrong: `saw ${tok} in the log`, productChange: 'rotate it', nextStep: 'n' } } });
    const req = buildRequest(withSecret, investigateSmell);
    expect(req.digest).not.toContain(tok);
    expect(req.digest).toContain('[redacted]');
  });
});

// #4079 review round 1, finding 8: `abandoned` is a MANUAL-ONLY status (see this module's own header) — never
// set by this pipeline, but honored by `isDuplicate`/`countRecent` as "not live" so an operator can hand-edit
// the ledger to free a dedup slot / drop it from the daily-cap count. Locking that contract down here in case
// a future refactor removes the branch believing it dead code.
describe('isDuplicate / countRecent — the manual `abandoned` exemption', () => {
  it('isDuplicate ignores an abandoned entry — the dedup slot is free again', () => {
    expect(isDuplicate([{ key: 'k', status: 'abandoned' }], 'k')).toBe(false);
    expect(isDuplicate([{ key: 'k', status: 'pending' }], 'k')).toBe(true);
  });

  it('countRecent excludes abandoned entries from the daily cap', () => {
    const now = Date.parse('2026-09-28T12:00:00Z');
    const ledger = [{ key: 'a', status: 'abandoned', requestedAt: now }, { key: 'b', status: 'pending', requestedAt: now }];
    expect(countRecent(ledger, now)).toBe(1);
  });
});

describe('laneStarvationOpen', () => {
  it('true only for an open/flapping lane-starvation episode, any subject', () => {
    expect(laneStarvationOpen({ a: { smell: 'lane-starvation', subject: 'we', status: 'open' } })).toBe(true);
    expect(laneStarvationOpen({ a: { smell: 'lane-starvation', subject: 'plateau', status: 'flapping' } })).toBe(true);
    expect(laneStarvationOpen({ a: { smell: 'lane-starvation', subject: 'we', status: 'closed' } })).toBe(false);
    expect(laneStarvationOpen({ a: { smell: 'daemon-silent', subject: 'we', status: 'open' } })).toBe(false);
    expect(laneStarvationOpen({})).toBe(false);
  });
});

describe('planFileRequests — dedup, cap, lane-starvation gate, off switch', () => {
  const smellsById = { 'gh-call-failures': knownFixSmell, 'lane-starvation': laneStarvation };
  const now = Date.parse('2026-09-28T12:00:00Z');

  it('off by default: every live episode is held, none requested', () => {
    const episodes = { a: ep({ key: 'a', smell: 'gh-call-failures' }) };
    const { toRequest, held } = planFileRequests({ episodes, smellsById, ledger: [], config: {}, now });
    expect(toRequest).toEqual([]);
    expect(held.a).toMatch(/off/);
  });

  it('a second request for the SAME (smell, subject) is deduplicated once the first is on the ledger', () => {
    const episodes = { a: ep({ key: 'a', smell: 'gh-call-failures', subject: 'we' }) };
    const config = { fileDispatch: true };
    const first = planFileRequests({ episodes, smellsById, ledger: [], config, now });
    expect(first.toRequest).toHaveLength(1);
    const ledger = recordRequested([], first.toRequest[0].request, now);
    const second = planFileRequests({ episodes, smellsById, ledger, config, now });
    expect(second.toRequest).toEqual([]);
    expect(second.held.a).toMatch(/duplicate/);
  });

  it('a DIFFERENT subject of the same smell is NOT deduplicated by another subject\'s entry', () => {
    const episodes = { a: ep({ key: 'a', smell: 'gh-call-failures', subject: 'plateau-app' }) };
    const config = { fileDispatch: true };
    const ledger = recordRequested([], buildRequest(ep({ smell: 'gh-call-failures', subject: 'we' }), knownFixSmell), now);
    const { toRequest } = planFileRequests({ episodes, smellsById, ledger, config, now });
    expect(toRequest).toHaveLength(1);
  });

  it('at most fileMaxPerDay requests within fileWindowMs', () => {
    const config = { fileDispatch: true, fileMaxPerDay: 2, fileWindowMs: DAY_MS };
    let ledger = [];
    const episodes = {};
    for (const subj of ['a', 'b', 'c']) {
      episodes[subj] = ep({ key: subj, smell: 'gh-call-failures', subject: subj });
    }
    const { toRequest, held } = planFileRequests({ episodes, smellsById, ledger, config, now });
    expect(toRequest).toHaveLength(2);
    expect(Object.values(held)).toContain('at the daily cap (2)');
  });

  it('an entry older than the window does not count against the cap', () => {
    const config = { fileDispatch: true, fileMaxPerDay: 1, fileWindowMs: DAY_MS };
    const staleLedger = recordRequested([], buildRequest(ep({ smell: 'gh-call-failures', subject: 'old' }), knownFixSmell), now - 2 * DAY_MS);
    const episodes = { a: ep({ key: 'a', smell: 'gh-call-failures', subject: 'we' }) };
    const { toRequest } = planFileRequests({ episodes, smellsById, ledger: staleLedger, config, now });
    expect(toRequest).toHaveLength(1);
  });

  it('no filing while ANY lane-starvation episode is open, regardless of subject', () => {
    const config = { fileDispatch: true };
    const episodes = {
      a: ep({ key: 'a', smell: 'gh-call-failures', subject: 'we' }),
      b: { key: 'b', smell: 'lane-starvation', subject: 'lane-pool:we', status: 'open' },
    };
    const { toRequest, held } = planFileRequests({ episodes, smellsById, ledger: [], config, now });
    expect(toRequest).toEqual([]);
    expect(held.a).toMatch(/lane-starvation/);
  });

  // #4079 review round 1, findings 3/12: the spec's trigger window is "open/flapping episodes", verbatim —
  // a CLOSED (or any other non-pending/non-open/non-flapping) episode must never spend the daily cap on an
  // already-resolved problem, even though `state.episodes` today happens to never retain one that long.
  it('a closed episode is never planned for filing, even if it otherwise carries a trigger', () => {
    const episodes = { a: ep({ key: 'a', smell: 'gh-call-failures', subject: 'we', status: 'closed' }) };
    const config = { fileDispatch: true };
    const { toRequest, held } = planFileRequests({ episodes, smellsById, ledger: [], config, now });
    expect(toRequest).toEqual([]);
    expect(held.a).toBeUndefined(); // not "live" at all — never even reaches the trigger/dedup/cap checks
  });
});

describe('renderFilingSection', () => {
  it('is empty for no entry, and names the status otherwise', () => {
    expect(renderFilingSection(null)).toEqual([]);
    const lines = renderFilingSection({ status: 'landed', card: 42, prUrl: 'https://github.com/x/y/pull/1', title: 't', digest: 'd', scope: [] });
    expect(lines.join('\n')).toContain('#42');
    expect(lines.join('\n')).toContain('https://github.com/x/y/pull/1');
  });
});

describe('ledger IO', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'health-file-request-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('an absent ledger reads as empty', () => {
    expect(readLedgerStrict(dir)).toEqual([]);
  });

  it('FAILS CLOSED on a corrupt ledger — never silently treated as empty', () => {
    mkdirSync(join(dir, 'filing'), { recursive: true });
    writeFileSync(ledgerPath(dir), '{ not json');
    expect(() => readLedgerStrict(dir)).toThrow(/corrupt/);
  });

  it('FAILS CLOSED when the ledger file is not an array', () => {
    mkdirSync(join(dir, 'filing'), { recursive: true });
    writeFileSync(ledgerPath(dir), JSON.stringify({ oops: true }));
    expect(() => readLedgerStrict(dir)).toThrow(/not an array/);
  });

  it('writeLedger + readLedgerStrict round-trip', () => {
    writeLedger(dir, [{ key: 'a::b', status: 'pending' }]);
    expect(readLedgerStrict(dir)).toEqual([{ key: 'a::b', status: 'pending' }]);
  });

  it('claimForLanding claims a pending entry exclusively, then refuses a second concurrent claim', () => {
    writeLedger(dir, recordRequested([], { key: 'k1', smell: 's', subject: 'x', episodeId: 'e1', title: 't', digest: 'd', scope: [], size: '3' }, 100));
    const first = claimForLanding(dir, 'k1', 200);
    expect(first.claimed.status).toBe('landing');
    expect(first.claimed.attemptId).toBeTruthy();
    const second = claimForLanding(dir, 'k1', 300);
    expect(second.claimed).toBeNull();
    expect(second.reason).toBe('in-flight');
  });

  it('claimForLanding reclaims a STALE landing claim (abandoned/crashed attempt)', () => {
    writeLedger(dir, [{ key: 'k1', status: 'landing', attemptId: 'old', claimedAt: 0 }]);
    const claim = claimForLanding(dir, 'k1', ATTEMPT_TIMEOUT_MS + 1000);
    expect(claim.claimed).not.toBeNull();
    expect(claim.claimed.attemptId).not.toBe('old');
  });

  it('claimForLanding refuses an already-landed (pr set) entry — a pure no-op', () => {
    writeLedger(dir, [{ key: 'k1', status: 'landed', pr: 7 }]);
    const claim = claimForLanding(dir, 'k1', 100);
    expect(claim.claimed).toBeNull();
    expect(claim.reason).toBe('already-landed');
  });

  it('patchLedgerEntry refuses a write from a SUPERSEDED attemptId (lost-update guard)', () => {
    writeLedger(dir, [{ key: 'k1', status: 'landing', attemptId: 'a1' }]);
    // a fresher claim supersedes attemptId a1 (simulating a stale reclaim that happened in between)
    writeLedger(dir, [{ key: 'k1', status: 'landing', attemptId: 'a2' }]);
    const result = patchLedgerEntry(dir, 'k1', 'a1', { status: 'landed', pr: 1 });
    expect(result).toBeNull();
    expect(readLedgerStrict(dir)[0].attemptId).toBe('a2');
  });

  it('patchLedgerEntry applies when the attemptId still matches', () => {
    writeLedger(dir, [{ key: 'k1', status: 'landing', attemptId: 'a1' }]);
    const result = patchLedgerEntry(dir, 'k1', 'a1', { status: 'landed', pr: 5 });
    expect(result.status).toBe('landed');
    expect(result.pr).toBe(5);
  });

  it('withLedgerLock serializes two calls (never runs them concurrently) and reclaims a stale lock file', () => {
    const order = [];
    withLedgerLock(dir, () => { order.push('first'); });
    withLedgerLock(dir, () => { order.push('second'); });
    expect(order).toEqual(['first', 'second']);
    // a leftover lock file older than staleMs is reclaimed rather than blocking forever
    writeFileSync(join(dir, 'filing', 'ledger.lock'), '999999');
    const oldTime = new Date(Date.now() - 10_000);
    utimesSync(join(dir, 'filing', 'ledger.lock'), oldTime, oldTime);
    expect(() => withLedgerLock(dir, () => 'ok', { staleMs: 1000, timeoutMs: 2000 })).not.toThrow();
  });

  // #4079 review round 1, finding 5: a stale-lock reclaim must be a SINGLE-WINNER operation. The old
  // mechanism was a plain `unlinkSync(lockPath)` — unconditional, so a second waiter observing the same
  // stale lock could unlink the FIRST waiter's freshly-created lock (not the stale one it actually inspected)
  // and also proceed into the critical section, breaking the whole point of the lock. `withLedgerLock` now
  // reclaims via `renameSync(lockPath, <unique-per-waiter-path>)`, which is atomic: of any waiters racing that
  // exact rename off the SAME source path, exactly one succeeds and every other one gets ENOENT (its source is
  // already gone). This test proves that single-winner guarantee holds for the primitive the fix relies on.
  it('the stale-lock reclaim is a single-winner atomic rename — two "waiters" racing the same stale lock can'
    + ' never both win it', () => {
    const lockPath = join(dir, 'filing', 'ledger.lock');
    mkdirSync(join(dir, 'filing'), { recursive: true });
    writeFileSync(lockPath, '111');
    const claimA = `${lockPath}.reclaim-a`;
    const claimB = `${lockPath}.reclaim-b`;
    renameSync(lockPath, claimA); // "waiter A" reclaims first
    expect(() => renameSync(lockPath, claimB)).toThrow(); // "waiter B" loses the race — source already gone
    expect(existsSync(claimA)).toBe(true);
    expect(existsSync(claimB)).toBe(false);
  });

  // #4079 review round 2, simplicity/standards-conformance/claim-accuracy findings: the test above proves the
  // single primitive (`renameSync`) is single-winner, but never calls `withLedgerLock` itself under real
  // contention — so a regression in HOW that primitive is wired into the function (not the primitive itself)
  // would go undetected. This drives the actual function, from two REAL OS processes, contending on one
  // already-stale lock, and proves mutual exclusion held throughout (a shared "busy" marker file is written at
  // the start of the critical section and removed at the end; either process finding it already present would
  // prove overlap) AND that both eventually make progress (neither starves forever behind the other).
  it('withLedgerLock holds mutual exclusion across two REAL concurrent processes contending on one stale lock', async () => {
    const lockPath = join(dir, 'filing', 'ledger.lock');
    mkdirSync(join(dir, 'filing'), { recursive: true });
    writeFileSync(lockPath, '999999'); // a pid nothing holds — immediately stale once staleMs elapses
    utimesSync(lockPath, new Date(0), new Date(0)); // as old as it gets, well past any staleMs used below

    const busyPath = join(dir, 'filing', 'busy.marker');
    const scriptPath = join(dir, 'contend-worker.mjs');
    writeFileSync(scriptPath, `
      import { existsSync, writeFileSync, unlinkSync, appendFileSync } from 'node:fs';
      import { withLedgerLock } from ${JSON.stringify(join(process.cwd(), 'scripts', 'conveyor', 'health-file-request.mjs'))};
      const dir = ${JSON.stringify(dir)};
      const busyPath = ${JSON.stringify(busyPath)};
      const label = process.argv[2];
      withLedgerLock(dir, () => {
        if (existsSync(busyPath)) { appendFileSync(${JSON.stringify(join(dir, 'filing', 'overlap.marker'))}, label); }
        writeFileSync(busyPath, label);
        const start = Date.now();
        while (Date.now() - start < 40) { /* hold the critical section briefly, on purpose */ }
        unlinkSync(busyPath);
      }, { staleMs: 2000, timeoutMs: 5000, sleepMs: 5 }); // staleMs MUST outlast the critical section's own 40ms hold below, or a loser waiter can wrongly reclaim a lock the WINNER still legitimately holds — that is a real, inherent limit of any mtime-based staleness heuristic (also true before this fix), not something this test is trying to characterize
      appendFileSync(${JSON.stringify(join(dir, 'filing', 'done.marker'))}, label);
    `);
    const run = (label) => new Promise((resolve, reject) => {
      let stderr = '';
      const child = spawn(process.execPath, [scriptPath, label], { stdio: ['ignore', 'ignore', 'pipe'] });
      child.stderr.on('data', (c) => { stderr += c; });
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`worker ${label} exited ${code}: ${stderr.slice(0, 2000)}`))));
      child.on('error', reject);
    });
    await Promise.all([run('A'), run('B')]);
    expect(existsSync(join(dir, 'filing', 'overlap.marker'))).toBe(false); // never both in the critical section
    expect(readFileSync(join(dir, 'filing', 'done.marker'), 'utf8')).toContain('A');
    expect(readFileSync(join(dir, 'filing', 'done.marker'), 'utf8')).toContain('B'); // both made progress — neither starved
  }, 10_000);

  describe('withLedgerLock generation CAS (#4381)', () => {
    const gen = (n) => join(dir, 'filing', `ledger.lock.${String(n).padStart(12, '0')}`);
    const plantStale = (n, content = 'held:999999') => {
      mkdirSync(join(dir, 'filing'), { recursive: true });
      writeFileSync(gen(n), content);
      utimesSync(gen(n), new Date(0), new Date(0));
    };
    const opts = { staleMs: 60_000, timeoutMs: 300, sleepMs: 5 };

    it('a third process recreating the lock inside the observe->take window is never stolen from', () => {
      plantStale(1);
      let fired = false;
      let ran = false;
      expect(() => withLedgerLock(dir, () => { ran = true; }, opts, {
        afterObserve: () => { if (!fired) { fired = true; writeFileSync(gen(2), 'held:424242'); } },
      })).toThrow(/timed out/);
      expect(fired).toBe(true);
      expect(ran).toBe(false);
      expect(readFileSync(gen(2), 'utf8')).toBe('held:424242'); // fresh lock untouched
    });

    it('two reclaimers + a third recreator never overlap in the critical section', () => {
      plantStale(1);
      let occupancy = 0;
      let peak = 0;
      let entered = 0;
      const body = () => { occupancy += 1; entered += 1; peak = Math.max(peak, occupancy); occupancy -= 1; };
      let thirdDone = false;
      const third = () => { if (!thirdDone) { thirdDone = true; writeFileSync(gen(2), 'held:424242'); } };
      // reclaimer A is refused (third recreated gen 2); reclaimer B, on the same stale observation, is too.
      for (const label of ['A', 'B']) {
        expect(() => withLedgerLock(dir, body, opts, { afterObserve: third }), label).toThrow(/timed out/);
      }
      expect(entered).toBe(0);
      expect(peak).toBe(0);
      // once the third releases, a reclaimer proceeds exactly once
      writeFileSync(gen(2), 'released');
      withLedgerLock(dir, body, opts);
      expect(entered).toBe(1);
      expect(peak).toBe(1);
    });

    it('release leaves a tombstone so a stale observer cannot re-create the successor name', () => {
      withLedgerLock(dir, () => {});
      expect(readFileSync(gen(1), 'utf8')).toBe('released');
      expect(() => writeFileSync(gen(1), 'held:1', { flag: 'wx' })).toThrow(/EEXIST/);
    });

    it('a superseded holder releasing is harmless to its successor', () => {
      let successorEntered = false;
      withLedgerLock(dir, () => {
        // A is reclaimed as stale by B while still inside its critical section
        utimesSync(gen(1), new Date(0), new Date(0));
        withLedgerLock(dir, () => {
          successorEntered = true;
          expect(existsSync(gen(1))).toBe(false); // pruned by B
        }, opts);
        writeFileSync(gen(2), 'held:777'); // a successor B' now holds the lock
      }, opts);
      expect(successorEntered).toBe(true);
      expect(readFileSync(gen(2), 'utf8')).toBe('held:777'); // A's release never touched it
    });

    it('reclaims a stale legacy bare ledger.lock once and waits on a fresh one', () => {
      mkdirSync(join(dir, 'filing'), { recursive: true });
      const legacy = join(dir, 'filing', 'ledger.lock');
      writeFileSync(legacy, '999999');
      let ran = false;
      expect(() => withLedgerLock(dir, () => { ran = true; }, opts)).toThrow(/timed out/); // fresh: waited on
      expect(ran).toBe(false);
      utimesSync(legacy, new Date(0), new Date(0));
      withLedgerLock(dir, () => { ran = true; }, opts);
      expect(ran).toBe(true);
      expect(existsSync(legacy)).toBe(false);
    });
  });
});

describe('spliceFilingSection', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'health-file-request-report-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('is a no-op when the report file does not exist yet', () => {
    expect(spliceFilingSection(join(dir, 'missing.md'), { status: 'pending', title: 't', digest: 'd' })).toBe(false);
  });

  it('appends the section on first write, then REPLACES it idempotently on the next (never duplicates it)', () => {
    const p = join(dir, 'e.md');
    writeFileSync(p, '# Health episode\n\nsomething\n');
    spliceFilingSection(p, { status: 'pending', title: 't', digest: 'd', scope: [] });
    const once = readFileSync(p, 'utf8');
    expect(once.match(/## Filing request/g)).toHaveLength(1);
    spliceFilingSection(p, { status: 'landed', card: 9, title: 't', digest: 'd', scope: [] });
    const twice = readFileSync(p, 'utf8');
    expect(twice.match(/## Filing request/g)).toHaveLength(1);
    expect(twice).toContain('#9');
    // the episode's original content survives both splices, untouched
    expect(twice).toContain('something');
  });

  it('this works for a report the tick would no longer touch — i.e. it does not depend on episode state at all,'
    + ' only on the report file already existing (the archived/closed-episode path)', () => {
    const p = join(dir, 'closed-episode.md');
    writeFileSync(p, '# Health episode: x — y\n\n(closed, no longer rendered by the tick)\n');
    const changed = spliceFilingSection(p, { status: 'landed', card: 3, prUrl: 'https://x/1', title: 't', digest: 'd', scope: [] });
    expect(changed).toBe(true);
    expect(readFileSync(p, 'utf8')).toContain('landed as an uncleared card #3');
  });
});
