/**
 * @file scripts/conveyor/__tests__/infra-blocked.test.mjs
 * @description Unit proof of the conveyor INFRA-BLOCKED state's PURE core (WE #2659). Drives
 *   classify/correlate/backoff/retry-decision/record/mark/derive directly with plain values (no fs / clock /
 *   network) and pins: only KNOWN-transient failures classify as infra (a real error never loops), the backoff
 *   grows and caps, the retry state machine waits→retries→surfaces at the cap, record is idempotent, the retry
 *   mark bumps + reschedules, and the lane-detail derive matches the shape status-board reads. The atomic fs
 *   roundtrip is exercised at the boundary; the live gh/network/pr-land driver is the IO shell (not unit-tested).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  classifyPrOpenFailure,
  correlateCause,
  backoffMs,
  parseInfraStore,
  infraHas,
  recordInfraBlock,
  markRetryAttempt,
  updateCause,
  removeInfraBlock,
  serializeInfraStore,
  retryDecision,
  deriveInfraByNum,
  readInfraStore,
  writeInfraStore,
  withInfraLock,
  mutateInfraStore,
  recordInfraBlockIO,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_BASE_MS,
  DEFAULT_CAP_MS,
} from '../infra-blocked.mjs';

const T0 = Date.parse('2026-07-24T00:00:00.000Z');

describe('classifyPrOpenFailure — only KNOWN-transient faults are infra (a real error never loops)', () => {
  it('GitHub 5xx / service degradation → infra "GitHub outage"', () => {
    for (const t of ['HTTP 503 Service Unavailable', 'GraphQL: 502 Bad Gateway', 'Internal Server Error (500)', 'GitHub is currently unavailable', 'the server is temporarily unavailable']) {
      const c = classifyPrOpenFailure(t);
      expect(c.infra).toBe(true);
      expect(c.cause).toBe('GitHub outage');
    }
  });
  it('rate limiting → infra "GitHub rate limit"', () => {
    expect(classifyPrOpenFailure('API rate limit exceeded').cause).toBe('GitHub rate limit');
    expect(classifyPrOpenFailure('You have triggered an abuse detection mechanism').cause).toBe('GitHub rate limit');
  });
  it('network / DNS / connection faults → infra "network"', () => {
    for (const t of ['could not resolve host: api.github.com', 'read ECONNRESET', 'connect ETIMEDOUT', 'dial tcp: i/o timeout', 'connection refused']) {
      expect(classifyPrOpenFailure(t)).toEqual({ infra: true, cause: 'network' });
    }
  });
  it('a GENUINE error is NOT infra (never a doomed retry loop): bad body, auth, already-exists, validation', () => {
    for (const t of ['a pull request already exists for chalbert:lane/2659-x', 'Validation Failed: body is too short', 'HTTP 401: Bad credentials', 'GraphQL: must be a collaborator', '']) {
      const c = classifyPrOpenFailure(t);
      expect(c.infra).toBe(false);
      expect(c.cause).toBe(null);
    }
  });
  it('a BARE 50x number OUT of an HTTP/status context is NOT an outage (no "502 bytes" false-positive, review 4)', () => {
    expect(classifyPrOpenFailure('the diff is 502 bytes over the limit').infra).toBe(false);
    expect(classifyPrOpenFailure('error code 509 in the validation table').infra).toBe(false);
    // …but the SAME number IN an HTTP/status context, or beside a server-error phrase, still classifies.
    expect(classifyPrOpenFailure('HTTP 502 from api.github.com').cause).toBe('GitHub outage');
    expect(classifyPrOpenFailure('status code 503').cause).toBe('GitHub outage');
    expect(classifyPrOpenFailure('502 bad gateway').cause).toBe('GitHub outage');
  });
  it('nullish / whitespace → not infra', () => {
    expect(classifyPrOpenFailure(null)).toEqual({ infra: false, cause: null });
    expect(classifyPrOpenFailure('   ')).toEqual({ infra: false, cause: null });
  });
});

describe('correlateCause — tell a real outage from a one-off (needs the fetched GitHub status)', () => {
  it('a live incident → "GitHub outage" whatever the classified cause', () => {
    expect(correlateCause('network', { reachable: true, indicator: 'major' })).toBe('GitHub outage');
    expect(correlateCause('GitHub rate limit', { reachable: true, indicator: 'critical' })).toBe('GitHub outage');
  });
  it('status page UNREACHABLE → keep a network-class cause (our own connectivity is suspect)', () => {
    expect(correlateCause('GitHub outage', { reachable: false })).toBe('network');
    expect(correlateCause('network', { reachable: false })).toBe('network');
  });
  it('reachable + operational (indicator none) → the failure was a ONE-OFF → tag transient', () => {
    expect(correlateCause('GitHub outage', { reachable: true, indicator: 'none' })).toBe('GitHub outage (transient)');
    // idempotent — an already-transient cause is not double-tagged
    expect(correlateCause('network (transient)', { reachable: true, indicator: 'none' })).toBe('network (transient)');
  });
  it('no status object → the classified cause unchanged (never throws)', () => {
    expect(correlateCause('GitHub outage', null)).toBe('GitHub outage');
    expect(correlateCause('', undefined)).toBe('infra');
  });
});

describe('backoffMs — exponential with a cap', () => {
  it('doubles from the base and never exceeds the cap', () => {
    expect(backoffMs(1)).toBe(DEFAULT_BASE_MS);          // 30s
    expect(backoffMs(2)).toBe(DEFAULT_BASE_MS * 2);      // 60s
    expect(backoffMs(3)).toBe(DEFAULT_BASE_MS * 4);      // 120s
    expect(backoffMs(4)).toBe(DEFAULT_BASE_MS * 8);      // 240s
    expect(backoffMs(99)).toBe(DEFAULT_CAP_MS);          // capped
  });
  it('a bogus/low attempt floors at 1', () => {
    expect(backoffMs(0)).toBe(DEFAULT_BASE_MS);
    expect(backoffMs(-5)).toBe(DEFAULT_BASE_MS);
    expect(backoffMs(NaN)).toBe(DEFAULT_BASE_MS);
  });
  it('honours injected tuning', () => {
    expect(backoffMs(3, { baseMs: 10, factor: 3, capMs: 1000 })).toBe(90);
    expect(backoffMs(9, { baseMs: 10, factor: 3, capMs: 1000 })).toBe(1000);
  });
});

describe('parseInfraStore — tolerant read', () => {
  it('empty / whitespace / malformed / null → []', () => {
    for (const t of ['', '   ', null, undefined, 'not json {', 'null']) expect(parseInfraStore(t)).toEqual([]);
  });
  it('tolerates a {blocked:[...]} wrapper, drops rows with no num, dedups by normalized num', () => {
    const parsed = parseInfraStore(JSON.stringify({ blocked: [
      { num: '2659', ref: 'lane/2659-x', attempt: 2 },
      { nope: 1 },
      { num: '02659', ref: 'lane/2659-dup' }, // same normalized num → dropped (first wins)
    ] }));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ num: '2659', ref: 'lane/2659-x', attempt: 2, base: 'main' });
  });
  it('defaults a missing attempt to 1 and base to main', () => {
    const [e] = parseInfraStore('[{"num":"7","ref":"lane/7-y"}]');
    expect(e.attempt).toBe(1);
    expect(e.base).toBe('main');
  });
});

describe('recordInfraBlock — idempotent create with the resumable handle', () => {
  it('records attempt=1 + the backoff schedule off the injected clock', () => {
    const s = recordInfraBlock([], { num: '2659', ref: 'lane/2659-x', sha: 'abc', base: 'main', cause: 'GitHub outage', body: 'B' }, T0);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ num: '2659', ref: 'lane/2659-x', sha: 'abc', cause: 'GitHub outage', body: 'B', attempt: 1 });
    expect(s[0].firstFailedAt).toBe(new Date(T0).toISOString());
    expect(Date.parse(s[0].nextRetryAt) - T0).toBe(backoffMs(1)); // due after the first backoff
  });
  it('re-recording an already-blocked num is a NO-OP (the retry loop owns progression) — same array ref', () => {
    const s1 = recordInfraBlock([], { num: '2659', ref: 'lane/2659-x' }, T0);
    const s2 = recordInfraBlock(s1, { num: '2659', ref: 'lane/2659-x', cause: 'network' }, T0 + 5000);
    expect(s2).toBe(s1); // unchanged — no reset of the backoff, no double-count
  });
  it('a blank num, or a record with no resumable ref, is a no-op (nothing to resume → nothing to track)', () => {
    expect(recordInfraBlock([], { num: '', ref: 'lane/x' }, T0)).toEqual([]);
    expect(recordInfraBlock([], { num: '2659', ref: null }, T0)).toEqual([]);
  });
  it('infraHas is padding/#-tolerant', () => {
    const s = recordInfraBlock([], { num: '2659', ref: 'lane/2659-x' }, T0);
    expect(infraHas(s, '02659')).toBe(true);
    expect(infraHas(s, '#2659')).toBe(true);
    expect(infraHas(s, '99')).toBe(false);
  });
});

describe('markRetryAttempt — a FAILED resume bumps the attempt and reschedules (doubled backoff)', () => {
  it('attempt+1, lastAttemptAt=now, nextRetryAt=now+backoff(attempt)', () => {
    const s1 = recordInfraBlock([], { num: '2659', ref: 'lane/2659-x' }, T0);
    const s2 = markRetryAttempt(s1, '2659', T0 + 999, { cause: 'network' });
    expect(s2[0].attempt).toBe(2);
    expect(s2[0].cause).toBe('network');
    expect(s2[0].lastAttemptAt).toBe(new Date(T0 + 999).toISOString());
    expect(Date.parse(s2[0].nextRetryAt) - (T0 + 999)).toBe(backoffMs(2)); // the doubled wait
  });
  it('an absent num is a no-op', () => {
    const s = recordInfraBlock([], { num: '2659', ref: 'lane/2659-x' }, T0);
    expect(markRetryAttempt(s, '404', T0)).toEqual(s);
  });
  it('updateCause changes only the cause; removeInfraBlock drops by num (padding-tolerant)', () => {
    let s = recordInfraBlock([], { num: '2659', ref: 'lane/2659-x' }, T0);
    s = updateCause(s, '2659', 'GitHub outage (transient)');
    expect(s[0].cause).toBe('GitHub outage (transient)');
    expect(removeInfraBlock(s, '02659')).toEqual([]);
    expect(removeInfraBlock(s, '404')).toEqual(s); // absent → same contents (a new array, equal by value)
  });
});

describe('retryDecision — the wait → retry → surface state machine', () => {
  const entry = (attempt, nextRetryAt) => ({ attempt, nextRetryAt: new Date(nextRetryAt).toISOString() });
  it('still backing off (now < nextRetryAt) → wait, with the remaining ms', () => {
    const d = retryDecision(entry(1, T0 + 30_000), { now: T0 });
    expect(d.action).toBe('wait');
    expect(d.waitMs).toBe(30_000);
  });
  it('backoff elapsed (now >= nextRetryAt) → retry', () => {
    expect(retryDecision(entry(1, T0), { now: T0 }).action).toBe('retry');
    expect(retryDecision(entry(3, T0 - 1), { now: T0 }).action).toBe('retry');
  });
  it('attempt cap reached → surface (never loop a doomed resume forever)', () => {
    const d = retryDecision(entry(DEFAULT_MAX_ATTEMPTS, T0 - 999), { now: T0 });
    expect(d.action).toBe('surface');
    expect(d.reason).toBe('attempt-cap');
  });
  it('the cap dominates even when a retry would otherwise be due', () => {
    expect(retryDecision(entry(DEFAULT_MAX_ATTEMPTS, T0 - 10 ** 9), { now: T0 }).action).toBe('surface');
  });
  it('a custom max-attempts is honoured', () => {
    expect(retryDecision(entry(2, T0 - 1), { now: T0, maxAttempts: 2 }).action).toBe('surface');
    expect(retryDecision(entry(1, T0 - 1), { now: T0, maxAttempts: 2 }).action).toBe('retry');
  });
});

describe('deriveInfraByNum — the per-item lane detail status-board reads (#2660 shape)', () => {
  it('produces { cause, attempt, nextRetrySec, capped } keyed by normalized num', () => {
    const store = recordInfraBlock([], { num: '2659', ref: 'lane/2659-x', cause: 'GitHub outage' }, T0);
    const by = deriveInfraByNum(store, T0); // now == firstFailed → next retry is backoff(1)/1000s away
    expect(by['2659']).toEqual({ cause: 'GitHub outage', attempt: 1, nextRetrySec: DEFAULT_BASE_MS / 1000, capped: false });
  });
  it('a capped entry reports capped:true + nextRetrySec:null (auto-retry exhausted)', () => {
    const store = [{ num: '2659', ref: 'lane/2659-x', cause: 'GitHub outage', attempt: DEFAULT_MAX_ATTEMPTS, nextRetryAt: new Date(T0).toISOString() }];
    expect(deriveInfraByNum(store, T0)['2659']).toMatchObject({ attempt: DEFAULT_MAX_ATTEMPTS, capped: true, nextRetrySec: null });
  });
  it('countdown never goes negative (a due-in-the-past retry clamps to 0)', () => {
    const store = [{ num: '7', ref: 'lane/7-y', attempt: 2, nextRetryAt: new Date(T0 - 99_000).toISOString() }];
    expect(deriveInfraByNum(store, T0)['7'].nextRetrySec).toBe(0);
  });
  it('an empty store → {}', () => {
    expect(deriveInfraByNum([], T0)).toEqual({});
  });
});

describe('serializeInfraStore — round-trips through parseInfraStore', () => {
  it('emits a bare newline-terminated JSON array that parses back equal', () => {
    const s = recordInfraBlock([], { num: '2659', ref: 'lane/2659-x', sha: 'abc', body: 'B' }, T0);
    const text = serializeInfraStore(s);
    expect(text.endsWith('\n')).toBe(true);
    expect(parseInfraStore(text)).toEqual(s);
  });
});

describe('fs roundtrip — atomic write, tolerant read, idempotent record-IO', () => {
  let dir;
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

  it('writes .conveyor/infra-blocked.json (creating the dir), reads it back, no leftover temp file', () => {
    dir = mkdtempSync(join(tmpdir(), 'ib-fs-'));
    const path = join(dir, '.conveyor', 'infra-blocked.json');
    const s = recordInfraBlock([], { num: '2659', ref: 'lane/2659-x' }, T0);
    writeInfraStore(s, path);
    expect(existsSync(path)).toBe(true);
    expect(readInfraStore(path)).toEqual(s);
    expect(readdirSync(join(dir, '.conveyor')).some((f) => f.endsWith('.tmp'))).toBe(false);
  });

  it('readInfraStore on a missing path → []', () => {
    dir = mkdtempSync(join(tmpdir(), 'ib-fs-'));
    expect(readInfraStore(join(dir, 'nope', 'infra-blocked.json'))).toEqual([]);
  });

  it('recordInfraBlockIO persists on first record and is a no-op on the second (idempotent)', () => {
    dir = mkdtempSync(join(tmpdir(), 'ib-fs-'));
    const path = join(dir, '.conveyor', 'infra-blocked.json');
    expect(recordInfraBlockIO({ num: '2659', ref: 'lane/2659-x' }, { now: T0, path }).recorded).toBe(true);
    expect(recordInfraBlockIO({ num: '2659', ref: 'lane/2659-x' }, { now: T0 + 5000, path }).recorded).toBe(false);
    expect(readInfraStore(path)).toHaveLength(1);
    // the on-disk content is complete JSON (the atomic rename guarantees it)
    expect(JSON.parse(readFileSync(path, 'utf8'))).toHaveLength(1);
  });

  it('withInfraLock runs fn, returns its result, and leaves NO leftover lock file (#2659 review 1)', () => {
    dir = mkdtempSync(join(tmpdir(), 'ib-fs-'));
    const path = join(dir, '.conveyor', 'infra-blocked.json');
    const r = withInfraLock(path, () => 42);
    expect(r).toBe(42);
    expect(existsSync(`${path}.lock`)).toBe(false); // released in the finally
  });

  it('withInfraLock STEALS a stale lock rather than deadlocking a tick (crashed holder)', () => {
    dir = mkdtempSync(join(tmpdir(), 'ib-fs-'));
    const path = join(dir, '.conveyor', 'infra-blocked.json');
    // a pre-existing lock older than the stale window must be stolen, not waited on forever.
    writeInfraStore([], path); // ensure the dir exists
    const stale = `${path}.lock`;
    writeFileSync(stale, '99999');
    // a 0ms stale window forces the "steal" branch immediately.
    let ran = false;
    withInfraLock(path, () => { ran = true; }, { staleMs: 0, timeoutMs: 100 });
    expect(ran).toBe(true);
    expect(existsSync(stale)).toBe(false);
  });

  it('mutateInfraStore re-reads the CURRENT on-disk store (no stale snapshot) then applies the transform', () => {
    dir = mkdtempSync(join(tmpdir(), 'ib-fs-'));
    const path = join(dir, '.conveyor', 'infra-blocked.json');
    // a record lands on disk AFTER an imaginary stale snapshot was taken elsewhere…
    writeInfraStore(recordInfraBlock([], { num: '2701', ref: 'lane/2701-b' }, T0), path);
    // …mutateInfraStore adds #2659 by transforming the FRESH read → both survive (the concurrent record is kept).
    const next = mutateInfraStore((s) => recordInfraBlock(s, { num: '2659', ref: 'lane/2659-a' }, T0), { path });
    expect(next.map((e) => e.num).sort()).toEqual(['2659', '2701']);
    expect(readInfraStore(path).map((e) => e.num).sort()).toEqual(['2659', '2701']);
  });
});

// ── SOURCE GUARDS — the retry/resume loop NEVER merges locally (memory rule 104: the drain is the sole writer
//    to main). "Resume" only re-invokes the producer pr-land; there is no git-merge / gh-pr-merge path here. ──
describe('infra-blocked source guards — resume never strands work and never merges locally', () => {
  const src = readFileSync(join(process.cwd(), 'scripts/conveyor/infra-blocked.mjs'), 'utf8');
  it('resume-open re-invokes the producer pr-land --label-on-green and NEVER passes --fallback-git', () => {
    expect(src).toMatch(/pr-land\.mjs/);
    expect(src).toMatch(/--label-on-green/);
    expect(src).not.toMatch(/--fallback-git/); // never the local-merge break-glass path
  });
  it('there is NO local git merge / gh pr merge / break-glass path (never a second writer to main)', () => {
    expect(src).not.toMatch(/'pr', 'merge'/);
    expect(src).not.toMatch(/merge', '--no-ff'/);
    expect(src).not.toMatch(/WE_MERGE_BREAK_GLASS/);
  });
  it('a resume FAILURE bumps the attempt (backs off) — it never drops the record (nothing stranded)', () => {
    // the retry loop only removes an entry when the resume OPENED a PR (r.ok); a failure calls markRetryAttempt.
    expect(src).toMatch(/if \(r\.ok\) \{ mutateInfraStore\(\(s\) => removeInfraBlock/);
    expect(src).toMatch(/else \{ mutateInfraStore\(\(s\) => markRetryAttempt/);
  });
  it('#2659 review 1 — every store write re-reads under a lock (no stale-snapshot clobber) — no final whole-store write', () => {
    // the retry loop must NOT snapshot the store then clobber it after a minutes-long resume; each mutation
    // goes through mutateInfraStore (fresh read under withInfraLock), and there is NO trailing writeInfraStore(store).
    expect(src).toMatch(/mutateInfraStore/);
    expect(src).not.toMatch(/writeInfraStore\(store, path\)/);
    expect(src).toMatch(/withInfraLock/);
  });
  it('#2659 review 2 — a cross-repo record is never resumed against the WRONG repo (skip, not a burned attempt)', () => {
    expect(src).toMatch(/entry\.repo && localSlug && entry\.repo !== localSlug/);
    expect(src).toMatch(/if \(r\.skip\)/); // a skip surfaces it, it does NOT markRetryAttempt
  });
  it('#2659 review 3 — a resume that OPENED a PR (a pr number in the result) clears the record, even if CI went red', () => {
    // execFileSync throws on pr-land's non-zero exit (red/timeout); the catch still reads a pr number off stdout.
    expect(src).toMatch(/if \(res\.pr != null\) return \{ ok: true/);
  });
});
