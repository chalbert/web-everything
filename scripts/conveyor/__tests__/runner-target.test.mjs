/**
 * @file scripts/conveyor/__tests__/runner-target.test.mjs
 * @description Unit-tests the WE #3478 fix: resolving which checkout's sidecar the LIVE conveyor runner is
 *   actually rooted in, never the caller's own cwd. `classifyRunnerEntries` is pure (in-memory fixtures, no
 *   fs); `listRunnerLockEntries` is exercised against a real temp lock root (the impure fs shell);
 *   `resolveLiveRunnerCheckout` is exercised with both dependencies injected, so the whole composition is
 *   tested without a real runner process or `lsof`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  classifyRunnerEntries, listRunnerLockEntries, resolveLiveRunnerCheckout,
} from '../runner-target.mjs';

const NOW = Date.parse('2026-09-05T12:00:00Z');
const liveEntry = (over = {}) => ({ owner: 'host:111:conveyor-runner', pid: 111, heartbeatAt: new Date(NOW - 60_000).toISOString(), ...over });
const staleEntry = (over = {}) => ({ owner: 'host:222:conveyor-runner', pid: 222, heartbeatAt: new Date(NOW - 60 * 60_000).toISOString(), ...over });

describe('classifyRunnerEntries — pure decision, no fs', () => {
  it('no entries at all → no-live-runner', () => {
    expect(classifyRunnerEntries([], NOW)).toEqual({ ok: false, reason: 'no-live-runner', entries: [] });
  });

  it('only a stale entry → no-live-runner (a crashed runner is not a live one)', () => {
    expect(classifyRunnerEntries([staleEntry()], NOW)).toEqual({ ok: false, reason: 'no-live-runner', entries: [] });
  });

  it('exactly one live entry → resolves to it, unambiguously', () => {
    const live = liveEntry();
    const verdict = classifyRunnerEntries([live], NOW);
    expect(verdict).toEqual({ ok: true, entry: live });
  });

  it('one live entry alongside stale cruft → still resolves to the live one, not ambiguous', () => {
    const live = liveEntry();
    const verdict = classifyRunnerEntries([staleEntry(), live, staleEntry({ owner: 'host:333:conveyor-runner', pid: 333 })], NOW);
    expect(verdict).toEqual({ ok: true, entry: live });
  });

  it('two live entries → ambiguous, refuses to pick one', () => {
    const a = liveEntry();
    const b = liveEntry({ owner: 'host:444:conveyor-runner', pid: 444 });
    const verdict = classifyRunnerEntries([a, b], NOW);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('ambiguous');
    expect(verdict.entries).toEqual([a, b]);
  });
});

describe('listRunnerLockEntries — impure fs shell against a real temp lock root', () => {
  let root;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'runner-locks-')); });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('a missing lock root → empty array, never throws', () => {
    expect(listRunnerLockEntries(join(root, 'does-not-exist'))).toEqual([]);
  });

  it('an empty lock root → empty array', () => {
    expect(listRunnerLockEntries(root)).toEqual([]);
  });

  it('reads every subdirectory’s lock.json, not just one fixed key', () => {
    for (const [id, entry] of [['aaa', liveEntry()], ['bbb', staleEntry()]]) {
      mkdirSync(join(root, id), { recursive: true });
      writeFileSync(join(root, id, 'lock.json'), JSON.stringify(entry));
    }
    const entries = listRunnerLockEntries(root);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.owner).sort()).toEqual(['host:111:conveyor-runner', 'host:222:conveyor-runner']);
  });

  it('a corrupt lock.json is skipped, never thrown', () => {
    mkdirSync(join(root, 'corrupt'), { recursive: true });
    writeFileSync(join(root, 'corrupt', 'lock.json'), '{ not json');
    mkdirSync(join(root, 'ok'), { recursive: true });
    writeFileSync(join(root, 'ok', 'lock.json'), JSON.stringify(liveEntry()));
    expect(listRunnerLockEntries(root)).toHaveLength(1);
  });
});

describe('resolveLiveRunnerCheckout — composition, dependencies injected', () => {
  it('a) live lock present + a resolvable cwd → resolves to that checkout, not the caller’s own', () => {
    const live = liveEntry();
    const result = resolveLiveRunnerCheckout({
      nowMs: NOW,
      listEntries: () => [live],
      resolveCwd: (pid) => (pid === live.pid ? '/some/other/checkout' : null),
    });
    expect(result).toEqual({ ok: true, checkoutRoot: '/some/other/checkout', pid: live.pid, owner: live.owner, heartbeatAt: live.heartbeatAt });
  });

  it('b) no live lock found → refuses, no checkout resolved', () => {
    const result = resolveLiveRunnerCheckout({ nowMs: NOW, listEntries: () => [staleEntry()], resolveCwd: () => '/wrong' });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no-live-runner');
  });

  it('c) multiple live lock dirs → ambiguity surfaced, never silently resolved to one of them', () => {
    const result = resolveLiveRunnerCheckout({
      nowMs: NOW,
      listEntries: () => [liveEntry(), liveEntry({ owner: 'host:555:conveyor-runner', pid: 555 })],
      resolveCwd: () => '/would-be-a-guess',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('ambiguous');
  });

  it('a live lock with no recorded pid → refuses rather than resolving a null pid', () => {
    const result = resolveLiveRunnerCheckout({
      nowMs: NOW,
      listEntries: () => [liveEntry({ pid: null })],
      resolveCwd: () => '/should-not-be-called',
    });
    expect(result).toEqual({ ok: false, reason: 'pid-unknown', entry: liveEntry({ pid: null }) });
  });

  it('a live lock whose pid’s cwd cannot be resolved → refuses rather than guessing', () => {
    const result = resolveLiveRunnerCheckout({ nowMs: NOW, listEntries: () => [liveEntry()], resolveCwd: () => null });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('cwd-unresolvable');
  });
});
