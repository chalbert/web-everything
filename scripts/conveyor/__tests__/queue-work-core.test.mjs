/**
 * @file scripts/conveyor/__tests__/queue-work-core.test.mjs
 * @description Unit tests for the pure decision core behind `queue-work.mjs` (WE #3478) — no fs, no real
 *   process, every lock entry / clock / pid→cwd / pid→identity lookup injected.
 */
import { describe, it, expect } from 'vitest';
import { classifyRunnerLocks, resolveQueueTarget, describeRefusal } from '../queue-work-core.mjs';
import { DEFAULT_LEASE_MINUTES } from '../../readiness/file-locks.mjs';

const NOW = Date.parse('2026-09-05T12:00:00.000Z');
const FRESH = new Date(NOW - (DEFAULT_LEASE_MINUTES / 2) * 60_000).toISOString(); // well inside the lease
const EXPIRED = new Date(NOW - DEFAULT_LEASE_MINUTES * 2 * 60_000).toISOString(); // well past the lease

describe('classifyRunnerLocks', () => {
  it('no entries at all → no-lock', () => {
    expect(classifyRunnerLocks([], NOW)).toEqual({ status: 'no-lock' });
  });

  it('one live entry → live, carrying that entry', () => {
    const e = { dir: 'a', entry: { owner: 'host:123:conveyor-runner', pid: 123, heartbeatAt: FRESH } };
    expect(classifyRunnerLocks([e], NOW)).toEqual({ status: 'live', live: e });
  });

  it('only expired entries → stale, listing every one', () => {
    const e1 = { dir: 'a', entry: { owner: 'host:1:x', pid: 1, heartbeatAt: EXPIRED } };
    const e2 = { dir: 'b', entry: { owner: 'host:2:x', pid: 2, heartbeatAt: EXPIRED } };
    const out = classifyRunnerLocks([e1, e2], NOW);
    expect(out.status).toBe('stale');
    expect(out.stale).toEqual([e1, e2]);
  });

  it('more than one live entry → ambiguous', () => {
    const e1 = { dir: 'a', entry: { owner: 'host:1:x', pid: 1, heartbeatAt: FRESH } };
    const e2 = { dir: 'b', entry: { owner: 'host:2:x', pid: 2, heartbeatAt: FRESH } };
    const out = classifyRunnerLocks([e1, e2], NOW);
    expect(out.status).toBe('ambiguous');
    expect(out.live).toEqual([e1, e2]);
  });

  it('a mix of one live + one stale → live wins (only the live one counts)', () => {
    const live = { dir: 'a', entry: { owner: 'host:1:x', pid: 1, heartbeatAt: FRESH } };
    const dead = { dir: 'b', entry: { owner: 'host:2:x', pid: 2, heartbeatAt: EXPIRED } };
    expect(classifyRunnerLocks([live, dead], NOW)).toEqual({ status: 'live', live });
  });

  it('a corrupt lock dir (entry:null) is ignored, not counted as stale or live', () => {
    const corrupt = { dir: 'a', entry: null };
    expect(classifyRunnerLocks([corrupt], NOW)).toEqual({ status: 'no-lock' });
  });
});

describe('resolveQueueTarget', () => {
  const cwdForPid = (pid) => (pid === 123 ? '/checkouts/live-one' : pid === 777 ? '/checkouts/not-a-checkout' : null);
  const isRunnerProcess = (pid) => pid === 123 || pid === 999 || pid === 777; // 999's cwd fails, 777's checkout marker fails
  const looksLikeCheckout = (cwd) => cwd !== '/checkouts/not-a-checkout';

  it('live + resolvable cwd + a pid that still looks like the runner → ok, names the checkout', () => {
    const classification = { status: 'live', live: { dir: 'a', entry: { owner: 'host:123:x', pid: 123, heartbeatAt: FRESH } } };
    expect(resolveQueueTarget(classification, cwdForPid, isRunnerProcess, looksLikeCheckout)).toEqual({
      ok: true, checkoutRoot: '/checkouts/live-one', owner: 'host:123:x', pid: 123,
    });
  });

  it('no-lock classification → refuses with reason no-lock, never guesses', () => {
    expect(resolveQueueTarget({ status: 'no-lock' }, cwdForPid, isRunnerProcess, looksLikeCheckout)).toEqual({
      ok: false, reason: 'no-lock', detail: { status: 'no-lock' },
    });
  });

  it('stale classification → refuses with reason stale', () => {
    const classification = { status: 'stale', stale: [{ dir: 'a', entry: {} }] };
    const out = resolveQueueTarget(classification, cwdForPid, isRunnerProcess, looksLikeCheckout);
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('stale');
  });

  it('ambiguous classification → refuses with reason ambiguous, surfacing every live entry', () => {
    const classification = { status: 'ambiguous', live: [{ dir: 'a', entry: {} }, { dir: 'b', entry: {} }] };
    const out = resolveQueueTarget(classification, cwdForPid, isRunnerProcess, looksLikeCheckout);
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('ambiguous');
    expect(out.detail.live).toHaveLength(2);
  });

  it('live entry with no pid recorded → refuses with reason lock-missing-pid', () => {
    const classification = { status: 'live', live: { dir: 'a', entry: { owner: 'host:?:x', pid: null, heartbeatAt: FRESH } } };
    const out = resolveQueueTarget(classification, cwdForPid, isRunnerProcess, looksLikeCheckout);
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('lock-missing-pid');
  });

  it('live entry whose pid no longer looks like the runner → refuses with reason pid-identity-mismatch, before ever consulting cwd', () => {
    const classification = { status: 'live', live: { dir: 'a', entry: { owner: 'host:456:x', pid: 456, heartbeatAt: FRESH } } };
    const out = resolveQueueTarget(classification, cwdForPid, isRunnerProcess, looksLikeCheckout); // isRunnerProcess(456) === false
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('pid-identity-mismatch');
    expect(out.detail).toEqual({ pid: 456, owner: 'host:456:x' });
  });

  it('live entry whose pid cwd cannot be resolved → refuses with reason cwd-unresolvable', () => {
    const classification = { status: 'live', live: { dir: 'a', entry: { owner: 'host:999:x', pid: 999, heartbeatAt: FRESH } } };
    const out = resolveQueueTarget(classification, cwdForPid, isRunnerProcess, looksLikeCheckout); // cwdForPid(999) === null
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('cwd-unresolvable');
    expect(out.detail).toEqual({ pid: 999, owner: 'host:999:x' });
  });

  it('live entry whose resolved cwd is not a real checkout → refuses with reason checkout-unverifiable, after cwd resolves', () => {
    const classification = { status: 'live', live: { dir: 'a', entry: { owner: 'host:777:x', pid: 777, heartbeatAt: FRESH } } };
    const out = resolveQueueTarget(classification, cwdForPid, isRunnerProcess, looksLikeCheckout); // looksLikeCheckout(...) === false
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('checkout-unverifiable');
    expect(out.detail).toEqual({ pid: 777, owner: 'host:777:x', cwd: '/checkouts/not-a-checkout' });
  });
});

describe('describeRefusal', () => {
  it('names each reason in plain language (never a bare code)', () => {
    for (const reason of ['no-lock', 'stale', 'ambiguous', 'lock-missing-pid', 'pid-identity-mismatch', 'cwd-unresolvable', 'checkout-unverifiable']) {
      const msg = describeRefusal({ ok: false, reason, detail: {} });
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(10);
    }
  });
});
