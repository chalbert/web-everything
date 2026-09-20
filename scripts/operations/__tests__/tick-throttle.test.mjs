/** #3383 — The last-tick throttle record: coalescing, attempted vs successful, crashed claimants, fail-closed reads. */
import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import * as realFs from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTickThrottle, parseMinIntervalMs, DEFAULT_MIN_INTERVAL_MS, DEFAULT_CLAIM_STALE_MS } from '../tick-throttle.mjs';
import { coordinationPaths } from '../coordination-root.mjs';
import { tryAcquireTickMutex } from '../tick-mutex.mjs';
import { CoordinationUnavailableError } from '../action-record.mjs';

const MIN = 60_000;
let clock, root, tokens;
const make = (opts = {}) => createTickThrottle({ root, now: () => clock, minIntervalMs: MIN, newToken: () => `t${++tokens}`, isPidAlive: () => true, ...opts });
const record = () => JSON.parse(readFileSync(coordinationPaths(root).tickThrottle, 'utf8'));
beforeEach(() => { clock = 1_000_000; tokens = 0; root = process.env.WE_COORDINATION_ROOT; });

describe('claiming and coalescing', () => {
  it('the first claim creates the record; a second wakeup while it is in flight coalesces', () => {
    const t = make();
    expect(t.claim({ owner: { driverId: 'a' } })).toMatchObject({ ok: true, token: 't1', rev: 1 });
    expect(record()).toMatchObject({ version: 1, rev: 1, claim: { token: 't1', driverId: 'a', pid: process.pid, host: hostname() },
      lastAttempt: { token: 't1', outcome: 'in-flight' }, lastSuccess: null });
    expect(t.claim({ owner: { driverId: 'b' } })).toMatchObject({ ok: false, reason: 'in-flight' });
    expect(record().rev).toBe(1); // a coalesced wakeup writes nothing
  });
  it('a success throttles every wakeup inside the min interval, then lets one through', () => {
    const t = make();
    const c = t.claim({ owner: { driverId: 'a' } });
    expect(t.complete(c, { success: true, tickId: 'a#1', driverId: 'a' }).ok).toBe(true);
    clock += 10_000;
    expect(t.claim({})).toMatchObject({ ok: false, reason: 'throttled', retryAfterMs: MIN - 10_000 });
    clock += MIN - 10_000 - 1;
    expect(t.claim({}).ok).toBe(false);
    clock += 1;
    expect(t.claim({}).ok).toBe(true);
  });
  it('the interval is configurable per throttle and defaults to 60 s', () => {
    expect(DEFAULT_MIN_INTERVAL_MS).toBe(60_000);
    const t = make({ minIntervalMs: 5_000 });
    t.complete(t.claim({}), { success: true });
    clock += 5_001;
    expect(t.claim({}).ok).toBe(true);
    expect(parseMinIntervalMs(undefined)).toBe(60_000);
    expect(parseMinIntervalMs('0')).toBe(0);
    expect(parseMinIntervalMs('2500')).toBe(2500);
    for (const bad of ['abc', '-1', 'NaN', 'Infinity']) expect(() => parseMinIntervalMs(bad)).toThrow(TypeError);
  });
  it('peek reports what a claim would do and writes nothing', () => {
    const t = make();
    expect(t.peek()).toMatchObject({ ok: true, action: 'claim' });
    expect(existsSync(coordinationPaths(root).tickThrottle)).toBe(false);
    t.claim({});
    expect(t.peek()).toMatchObject({ ok: false, reason: 'in-flight' });
    expect(record().rev).toBe(1);
  });
});

describe('attempted and successful ticks are recorded separately', () => {
  it('a failed tick does not throttle the next wakeup and leaves lastSuccess alone', () => {
    const t = make();
    t.complete(t.claim({ owner: { driverId: 'a' } }), { success: true, tickId: 'a#1' });
    const successAt = clock;
    clock += MIN + 1;
    const failed = t.claim({ owner: { driverId: 'a' } });
    clock += 5;
    expect(t.complete(failed, { success: false, reason: 'lease-lost' }).ok).toBe(true);
    expect(record()).toMatchObject({ claim: null, lastAttempt: { outcome: 'failed', reason: 'lease-lost', at: clock }, lastSuccess: { at: successAt, tickId: 'a#1' } });
    expect(t.claim({}).ok).toBe(true); // immediately: the failure did not start a throttle window
  });
  it('a first-ever failure also leaves no success and no throttle', () => {
    const t = make();
    t.complete(t.claim({}), { success: false, reason: 'busy' });
    expect(record().lastSuccess).toBeNull();
    expect(t.claim({}).ok).toBe(true);
  });
});

describe('token and rev fence', () => {
  it('a wrong token or stale rev changes nothing', () => {
    const t = make();
    const c = t.claim({});
    const before = readFileSync(coordinationPaths(root).tickThrottle, 'utf8');
    expect(t.complete({ token: 'other', rev: c.rev }, { success: true })).toMatchObject({ ok: false, reason: 'owner-lost' });
    expect(t.complete({ token: c.token, rev: c.rev + 1 }, { success: true })).toMatchObject({ ok: false, reason: 'owner-lost' });
    expect(readFileSync(coordinationPaths(root).tickThrottle, 'utf8')).toBe(before);
    expect(t.complete(c, { success: true }).ok).toBe(true);
    expect(t.complete(c, { success: true })).toMatchObject({ ok: false, reason: 'owner-lost' }); // already finished
  });
  it('a lost create-exclusive race is a coalesced wakeup, not a second claim', () => {
    let raced = false;
    const fs = { ...realFs, openSync: (p, flag, ...rest) => {
      if (flag === 'wx' && !raced) { raced = true; realFs.writeFileSync(p, '{}'); }
      return realFs.openSync(p, flag, ...rest);
    } };
    expect(make({ fs }).claim({})).toMatchObject({ ok: false, reason: 'contended' });
  });
  it('two throttles on one root: exactly one claim wins', () => {
    const results = [make(), make()].map((t, i) => t.claim({ owner: { driverId: `d${i}` } }));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok).reason).toBe('in-flight');
  });
});

describe('a crashed claimant expires by suspicion + reconcile, not a bare TTL', () => {
  const crash = () => { const t = make(); t.claim({ owner: { driverId: 'dead-driver' } }); return t; };
  it('a claim inside the stale window is never reconciled, even if its pid looks dead', () => {
    crash(); clock += DEFAULT_CLAIM_STALE_MS;
    expect(make({ isPidAlive: () => false }).claim({})).toMatchObject({ ok: false, reason: 'in-flight' });
  });
  it('an expired claim whose same-host pid is positively dead is abandoned (an attempt, not a success)', () => {
    const t = make(); t.complete(t.claim({}), { success: true, tickId: 'ok#1' });
    clock += MIN; t.claim({ owner: { driverId: 'dead-driver' } });
    clock += DEFAULT_CLAIM_STALE_MS + 1;
    const next = make({ isPidAlive: () => false }).claim({ owner: { driverId: 'b' } });
    expect(next.ok).toBe(true);
    expect(record()).toMatchObject({ claim: { driverId: 'b' }, lastSuccess: { tickId: 'ok#1' } });
    expect(record().rev).toBe(next.rev);
  });
  it('the abandonment is written before the new claim, so a crash between them leaves an honest record', () => {
    crash(); clock += DEFAULT_CLAIM_STALE_MS + 1;
    let writes = 0;
    const fs = { ...realFs, renameSync: (a, b) => { if (String(b).endsWith('tick-throttle.json') && ++writes === 2) throw new Error('crash'); return realFs.renameSync(a, b); } };
    expect(() => make({ isPidAlive: () => false, fs }).claim({})).toThrow(CoordinationUnavailableError);
    expect(record()).toMatchObject({ claim: null, lastAttempt: { outcome: 'abandoned', reason: 'claimant-dead' }, lastSuccess: null });
  });
  it('an expired claim whose pid is alive but not holding the tick mutex is held, not stolen', () => {
    crash(); clock += DEFAULT_CLAIM_STALE_MS + 1;
    expect(make({ isPidAlive: () => true }).claim({})).toMatchObject({ ok: false, reason: 'claim-unknown' });
    expect(make({ isPidAlive: () => true }).peek()).toMatchObject({ ok: false, action: 'held', reason: 'claim-unknown' });
  });
  it('an expired claim whose claimant still holds the tick mutex is alive (a long tick), held', () => {
    crash();
    expect(tryAcquireTickMutex({ root, owner: { driverId: 'dead-driver', pid: process.pid, host: hostname() }, tickId: 'x#1', now: () => clock, isPidAlive: () => true }).ok).toBe(true);
    clock += DEFAULT_CLAIM_STALE_MS + 1;
    expect(make({ isPidAlive: () => true }).claim({})).toMatchObject({ ok: false, reason: 'claim-alive' });
  });
  it('a claim from another host is never proven dead from here', () => {
    const t = make(); t.claim({});
    const path = coordinationPaths(root).tickThrottle, r = record();
    writeFileSync(path, JSON.stringify({ ...r, claim: { ...r.claim, host: 'some-other-host' } }));
    clock += 10 * DEFAULT_CLAIM_STALE_MS;
    expect(make({ isPidAlive: () => false }).claim({})).toMatchObject({ ok: false, reason: 'claim-unknown' });
  });
  it('a backwards clock is never expiry and never throttles', () => {
    const t = make(); t.claim({});
    clock -= 10 * DEFAULT_CLAIM_STALE_MS;
    expect(make({ isPidAlive: () => false }).claim({})).toMatchObject({ ok: false, reason: 'in-flight' });
    const t2 = make(); clock = 5_000_000; // fresh record below
    mkdirSync(root, { recursive: true });
    writeFileSync(coordinationPaths(root).tickThrottle, JSON.stringify({ version: 1, rev: 3, claim: null, lastAttempt: null, lastSuccess: { token: 'x', at: clock + 10 * MIN } }));
    expect(t2.claim({}).ok).toBe(true);
  });
});

describe('fail closed', () => {
  it.each([['not json', '{oops'], ['wrong version', JSON.stringify({ version: 2, rev: 1, claim: null, lastAttempt: null, lastSuccess: null })],
    ['bad claim', JSON.stringify({ version: 1, rev: 1, claim: { token: 5 }, lastAttempt: null, lastSuccess: null })],
    ['missing fields', JSON.stringify({ version: 1 })]])('a %s record is coordination-unavailable, never "no record"', (_name, body) => {
    mkdirSync(root, { recursive: true });
    writeFileSync(coordinationPaths(root).tickThrottle, body);
    for (const call of [(t) => t.claim({}), (t) => t.peek(), (t) => t.read()]) expect(() => call(make())).toThrow(CoordinationUnavailableError);
  });
  it('an unwritable root is coordination-unavailable', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'tt-')), 'afile'); writeFileSync(file, 'x');
    expect(() => make({ root: join(file, 'sub') }).claim({})).toThrow(CoordinationUnavailableError);
  });
});

describe('determinism', () => {
  it('the same clock, tokens and driver produce byte-identical records', () => {
    const run = () => {
      const r = mkdtempSync(join(tmpdir(), 'tt-det-'));
      const t = createTickThrottle({ root: r, now: () => clock, minIntervalMs: MIN, newToken: (() => { let n = 0; return () => `t${++n}`; })(), isPidAlive: () => true });
      t.complete(t.claim({ owner: { driverId: 'a' } }), { success: true, tickId: 'a#1', driverId: 'a' });
      clock += MIN; const c = t.claim({ owner: { driverId: 'a' } }); t.complete(c, { success: false, reason: 'busy', driverId: 'a' });
      return readFileSync(coordinationPaths(r).tickThrottle, 'utf8');
    };
    const start = clock;
    const a = run(); clock = start; const b = run();
    expect(a).toBe(b);
  });
});
