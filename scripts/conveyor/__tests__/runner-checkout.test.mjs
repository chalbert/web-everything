/**
 * @file scripts/conveyor/__tests__/runner-checkout.test.mjs
 * @description Unit proof of the live-runner-checkout resolver (WE #3478). Pins the three "Done when" cases:
 *   (a) a single live lock entry resolves to its pid's cwd, (b) no live entry refuses `no-live-runner`, and
 *   (c) more than one live entry refuses `ambiguous` rather than guessing. The pure decision
 *   ({@link resolveRunnerPid}) is driven with plain fixtures; {@link resolveLiveRunnerCwd}'s IO (listing
 *   entries, turning a pid into a cwd) is injected so the suite never depends on a real runner lease or a
 *   real `lsof` call except in the one end-to-end case that deliberately exercises it against a real child
 *   process.
 */
import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveRunnerPid, liveLockEntries, pidCwd, resolveLiveRunnerCwd } from '../runner-checkout.mjs';

const FRESH = () => new Date().toISOString();
const STALE = () => new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h old — past the 15m default lease

describe('resolveRunnerPid — pure decision', () => {
  it('a single live entry resolves to its pid', () => {
    expect(resolveRunnerPid([{ pid: 4242, heartbeatAt: FRESH() }], Date.now())).toEqual({ ok: true, pid: 4242 });
  });

  it('no entries at all → no-live-runner', () => {
    expect(resolveRunnerPid([], Date.now())).toEqual({ ok: false, reason: 'no-live-runner' });
  });

  it('only a stale (lease-expired) entry → no-live-runner, never guesses the dead pid', () => {
    expect(resolveRunnerPid([{ pid: 4242, heartbeatAt: STALE() }], Date.now())).toEqual({ ok: false, reason: 'no-live-runner' });
  });

  it('more than one live entry → ambiguous, names every candidate pid', () => {
    const out = resolveRunnerPid([{ pid: 111, heartbeatAt: FRESH() }, { pid: 222, heartbeatAt: FRESH() }], Date.now());
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('ambiguous');
    expect(out.pids.sort()).toEqual([111, 222]);
  });

  it('a stale entry alongside a live one is NOT counted — only the live pid wins, no ambiguity', () => {
    const out = resolveRunnerPid([{ pid: 111, heartbeatAt: STALE() }, { pid: 222, heartbeatAt: FRESH() }], Date.now());
    expect(out).toEqual({ ok: true, pid: 222 });
  });

  it('an entry with no pid is ignored (metadata-only / legacy lock)', () => {
    expect(resolveRunnerPid([{ pid: null, heartbeatAt: FRESH() }], Date.now())).toEqual({ ok: false, reason: 'no-live-runner' });
  });
});

describe('resolveLiveRunnerCwd — orchestrator, injected IO', () => {
  it('ok:true carries the resolved pid + checkout when the decision resolves and the cwd is found', () => {
    const out = resolveLiveRunnerCwd({
      listEntries: () => [{ pid: 999, heartbeatAt: FRESH() }],
      resolveCwd: (pid) => (pid === 999 ? '/some/checkout' : null),
    });
    expect(out).toEqual({ ok: true, pid: 999, checkout: '/some/checkout' });
  });

  it('propagates a no-live-runner / ambiguous refusal from the decision without calling resolveCwd', () => {
    let called = false;
    const out = resolveLiveRunnerCwd({ listEntries: () => [], resolveCwd: () => { called = true; return '/x'; } });
    expect(out).toEqual({ ok: false, reason: 'no-live-runner' });
    expect(called).toBe(false);
  });

  it('cwd-unresolvable when the pid is live but its cwd cannot be read', () => {
    const out = resolveLiveRunnerCwd({
      listEntries: () => [{ pid: 999, heartbeatAt: FRESH() }],
      resolveCwd: () => null,
    });
    expect(out).toEqual({ ok: false, reason: 'cwd-unresolvable', pid: 999 });
  });
});

describe('liveLockEntries — thin fs shell', () => {
  it('reads every lock.json under the root, skipping a corrupt one, never throwing on a missing root', () => {
    const dir = mkdtempSync(join(tmpdir(), 'runner-lock-root-'));
    try {
      expect(liveLockEntries(join(dir, 'does-not-exist'))).toEqual([]);

      const good = join(dir, 'good');
      mkdirSync(good, { recursive: true });
      writeFileSync(join(good, 'lock.json'), JSON.stringify({ owner: 'h:1:conveyor-runner', pid: 111, heartbeatAt: FRESH() }));

      const corrupt = join(dir, 'corrupt');
      mkdirSync(corrupt, { recursive: true });
      writeFileSync(join(corrupt, 'lock.json'), '{ not json');

      const entries = liveLockEntries(dir);
      expect(entries).toHaveLength(1);
      expect(entries[0].pid).toBe(111);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('pidCwd — real lsof, end-to-end resolution against a real child process', () => {
  it('resolves a live child process pid to the cwd it was spawned in', async () => {
    const scratch = mkdtempSync(join(tmpdir(), 'runner-checkout-e2e-'));
    const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], { cwd: scratch, stdio: 'ignore' });
    try {
      await new Promise((r) => setTimeout(r, 200)); // give lsof something to see
      const cwd = pidCwd(child.pid);
      // macOS resolves `/tmp`-style paths through `/private` — compare realpaths, not raw strings.
      expect(cwd).toBe(realpathSync(scratch));
    } finally {
      child.kill();
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it('a dead pid resolves to null rather than throwing', () => {
    // a pid essentially guaranteed not to be alive right now
    expect(pidCwd(999999)).toBeNull();
  });
});
