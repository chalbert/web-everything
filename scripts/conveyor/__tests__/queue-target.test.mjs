/**
 * @file scripts/conveyor/__tests__/queue-target.test.mjs
 * @description Unit + end-to-end proof of WE #3478's live-runner-cwd resolution: (a) a live runner lock whose
 *   pid resolves to a cwd via an injected `lsof` → that resolved checkout, not the caller's; (b) no live lock
 *   at all (missing root, or only a stale entry) → refuses (`no-live-runner`), never silently succeeds; (c)
 *   more than one live lock → refuses (`ambiguous-runner-lock`) rather than picking one; plus the no-pid and
 *   unresolvable-cwd refusals. The pure classifiers (`liveRunnerLockEntries` / `resolveRunnerLockVerdict` /
 *   `parseLsofCwd`) are driven directly with plain values; the end-to-end `resolveLiveRunnerCwd` drives a real
 *   temp lock-dir tree with an injected `lsof` so no real fs/process surface outside a tmpdir is touched.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  liveRunnerLockEntries,
  resolveRunnerLockVerdict,
  parseLsofCwd,
  resolveLiveRunnerCwd,
} from '../queue-target.mjs';

const NOW = Date.parse('2026-09-05T12:00:00Z');
const FRESH = new Date(NOW - 60_000).toISOString(); // 1 min old — well within the 15 min lease
const STALE = new Date(NOW - 20 * 60_000).toISOString(); // 20 min old — past the 15 min lease

const lockText = (owner, heartbeatAt, pid = 4242) => JSON.stringify({ owner, heartbeatAt, pid });

describe('liveRunnerLockEntries — pure lease-liveness filter', () => {
  it('keeps a fresh entry, drops a stale one and an unparseable one', () => {
    const raw = [
      { dir: 'a', text: lockText('host:1:conveyor-runner', FRESH) },
      { dir: 'b', text: lockText('host:2:conveyor-runner', STALE) },
      { dir: 'c', text: 'not json {' },
      { dir: 'd', text: '' },
    ];
    const live = liveRunnerLockEntries(raw, NOW);
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({ dir: 'a', pid: 4242 });
  });

  it('empty/missing input → []', () => {
    expect(liveRunnerLockEntries([], NOW)).toEqual([]);
    expect(liveRunnerLockEntries(undefined, NOW)).toEqual([]);
  });
});

describe('resolveRunnerLockVerdict — pure classification', () => {
  it('zero live entries → no-live-runner', () => {
    expect(resolveRunnerLockVerdict([])).toEqual({ ok: false, reason: 'no-live-runner' });
  });

  it('more than one live entry → ambiguous-runner-lock, never a silent pick', () => {
    const entries = [
      { dir: 'a', owner: 'host:1:conveyor-runner', pid: 1 },
      { dir: 'b', owner: 'host:2:conveyor-runner', pid: 2 },
    ];
    const v = resolveRunnerLockVerdict(entries);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('ambiguous-runner-lock');
    expect(v.candidates).toHaveLength(2);
  });

  it('exactly one live entry with a pid → ok, carries pid + owner', () => {
    const v = resolveRunnerLockVerdict([{ dir: 'a', owner: 'host:4242:conveyor-runner', pid: 4242 }]);
    expect(v).toEqual({ ok: true, pid: 4242, owner: 'host:4242:conveyor-runner' });
  });

  it('exactly one live entry but no recorded pid → no-pid-recorded', () => {
    const v = resolveRunnerLockVerdict([{ dir: 'a', owner: 'host:?:conveyor-runner', pid: null }]);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('no-pid-recorded');
  });

  it('a non-positive pid (0 or negative — only reachable via a corrupted/hand-crafted lock.json) → no-pid-recorded, never shelled to lsof', () => {
    expect(resolveRunnerLockVerdict([{ dir: 'a', owner: 'x', pid: 0 }]).reason).toBe('no-pid-recorded');
    expect(resolveRunnerLockVerdict([{ dir: 'a', owner: 'x', pid: -1 }]).reason).toBe('no-pid-recorded');
  });
});

describe('parseLsofCwd — pure `-Fn` output parsing', () => {
  it('extracts the n-prefixed field line', () => {
    expect(parseLsofCwd('p4242\nfcwd\nn/Users/x/checkout\n')).toBe('/Users/x/checkout');
  });

  it('no n-line / empty output → null', () => {
    expect(parseLsofCwd('p4242\nfcwd\n')).toBeNull();
    expect(parseLsofCwd('')).toBeNull();
    expect(parseLsofCwd(undefined)).toBeNull();
  });
});

describe('resolveLiveRunnerCwd — end to end over a real temp lock-dir tree', () => {
  let dir;
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

  it('a live lock + a resolvable pid → the resolved checkout, not the caller\'s cwd', () => {
    dir = mkdtempSync(join(tmpdir(), 'queue-target-'));
    mkdirSync(join(dir, 'runner-lease'));
    writeFileSync(join(dir, 'runner-lease', 'lock.json'), lockText('host:4242:conveyor-runner', FRESH, 4242));

    const v = resolveLiveRunnerCwd({
      lockRoot: dir, nowMs: NOW, lsof: (pid) => (pid === 4242 ? '/some/other/checkout' : null),
    });
    expect(v).toEqual({ ok: true, pid: 4242, owner: 'host:4242:conveyor-runner', cwd: '/some/other/checkout' });
  });

  it('no lock root at all → no-live-runner, never a guess', () => {
    dir = mkdtempSync(join(tmpdir(), 'queue-target-'));
    rmSync(dir, { recursive: true, force: true }); // root itself absent
    const v = resolveLiveRunnerCwd({ lockRoot: dir, nowMs: NOW, lsof: () => '/wrong' });
    expect(v).toEqual({ ok: false, reason: 'no-live-runner' });
  });

  it('only a stale lock present → no-live-runner (a crashed runner is not a live one)', () => {
    dir = mkdtempSync(join(tmpdir(), 'queue-target-'));
    mkdirSync(join(dir, 'runner-lease'));
    writeFileSync(join(dir, 'runner-lease', 'lock.json'), lockText('host:1:conveyor-runner', STALE, 1));
    const v = resolveLiveRunnerCwd({ lockRoot: dir, nowMs: NOW, lsof: () => '/wrong' });
    expect(v).toEqual({ ok: false, reason: 'no-live-runner' });
  });

  it('two live locks present → ambiguous-runner-lock, never picks one', () => {
    dir = mkdtempSync(join(tmpdir(), 'queue-target-'));
    mkdirSync(join(dir, 'a'));
    mkdirSync(join(dir, 'b'));
    writeFileSync(join(dir, 'a', 'lock.json'), lockText('host:1:conveyor-runner', FRESH, 1));
    writeFileSync(join(dir, 'b', 'lock.json'), lockText('host:2:conveyor-runner', FRESH, 2));
    const v = resolveLiveRunnerCwd({ lockRoot: dir, nowMs: NOW, lsof: () => '/wrong' });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('ambiguous-runner-lock');
  });

  it('a live lock whose pid cannot be resolved to a cwd → runner-cwd-unresolvable', () => {
    dir = mkdtempSync(join(tmpdir(), 'queue-target-'));
    mkdirSync(join(dir, 'runner-lease'));
    writeFileSync(join(dir, 'runner-lease', 'lock.json'), lockText('host:4242:conveyor-runner', FRESH, 4242));
    const v = resolveLiveRunnerCwd({ lockRoot: dir, nowMs: NOW, lsof: () => null });
    expect(v).toEqual({ ok: false, reason: 'runner-cwd-unresolvable', pid: 4242 });
  });

  it('a live lock entry with no pid field at all → no-pid-recorded (end to end, not just the pure classifier)', () => {
    dir = mkdtempSync(join(tmpdir(), 'queue-target-'));
    mkdirSync(join(dir, 'runner-lease'));
    writeFileSync(join(dir, 'runner-lease', 'lock.json'), JSON.stringify({ owner: 'host:?:conveyor-runner', heartbeatAt: FRESH }));
    const v = resolveLiveRunnerCwd({ lockRoot: dir, nowMs: NOW, lsof: () => '/wrong' });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('no-pid-recorded');
  });

  it('one stale + one live lock → resolves to the live one; staleness is filtered before ambiguity is judged', () => {
    dir = mkdtempSync(join(tmpdir(), 'queue-target-'));
    mkdirSync(join(dir, 'dead'));
    mkdirSync(join(dir, 'alive'));
    writeFileSync(join(dir, 'dead', 'lock.json'), lockText('host:1:conveyor-runner', STALE, 1));
    writeFileSync(join(dir, 'alive', 'lock.json'), lockText('host:4242:conveyor-runner', FRESH, 4242));
    const v = resolveLiveRunnerCwd({
      lockRoot: dir, nowMs: NOW, lsof: (pid) => (pid === 4242 ? '/live/checkout' : null),
    });
    expect(v).toEqual({ ok: true, pid: 4242, owner: 'host:4242:conveyor-runner', cwd: '/live/checkout' });
  });
});
