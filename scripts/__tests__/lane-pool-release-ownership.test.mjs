/**
 * @file scripts/__tests__/lane-pool-release-ownership.test.mjs
 * @description Proof of the #2452 Gap 2 fix: `cmdRelease` used to key ownership off `defaultSession()`
 *   (`--session` / `LANE_SESSION` / else `${hostname()}:${process.ppid}`), NOT the durable `ownerSession`
 *   (`CLAUDE_CODE_SESSION_ID`) signal `isForeignLease` adopted in #2367. Since a shell's `ppid` differs across
 *   separate invocations, the very session that ACQUIRED a lease read as "not yours" on a later `release` call
 *   with no explicit `--session`/`LANE_SESSION` — observed live 2026-07-12 (lane-20, lane-21) — and had to pass
 *   `--force`. This spawns the real CLI twice as genuinely SEPARATE processes (acquire, then release, with no
 *   shared `--session`/`LANE_SESSION`) but the SAME `CLAUDE_CODE_SESSION_ID` env var, matching the real scenario:
 *   one interactive session, driving `acquire` then `release` through separate Bash-tool invocations.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = resolve(process.cwd(), 'scripts/lane-pool.mjs');

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

let base, originDir, referenceDir, poolRoot;

// Runs the CLI as a genuinely separate process each call — never passing --session/LANE_SESSION — so
// `defaultSession()` falls back to `${hostname()}:${process.ppid}`, which necessarily differs between this
// call and the next (each `spawnSync` is its own process, so `process.ppid` as seen from inside node differs
// run to run). `ownerSessionId` stands in for `CLAUDE_CODE_SESSION_ID` — stable across both calls, exactly the
// signal one interactive Claude Code session's separate Bash-tool invocations share.
function runPool(args, ownerSessionId) {
  // LANE_POOL_ROOT MUST be this test's private tmp dir — without it every command falls back to the
  // real default pool root (~/workspace/.lanes), colliding with any other lane pool of the same --name.
  const env = { ...process.env, LANE_POOL_ROOT: poolRoot };
  delete env.LANE_SESSION;
  if (ownerSessionId !== undefined) env.CLAUDE_CODE_SESSION_ID = ownerSessionId;
  else delete env.CLAUDE_CODE_SESSION_ID;
  const r = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8', env });
  return { code: r.status ?? 1, out: String(r.stdout || ''), err: String(r.stderr || '') };
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'lane-pool-release-owner-'));
  originDir = join(base, 'origin.git');
  referenceDir = join(base, 'reference');
  poolRoot = join(base, 'pool');

  git(['init', '--quiet', '--bare', '--initial-branch=trunk', originDir]);
  git(['clone', '--quiet', originDir, referenceDir]);
  git(['config', 'user.email', 't@t.com'], referenceDir);
  git(['config', 'user.name', 't'], referenceDir);
  writeFileSync(join(referenceDir, 'file.txt'), 'v1\n');
  git(['add', 'file.txt'], referenceDir);
  git(['commit', '--quiet', '-m', 'v1'], referenceDir);
  git(['push', '--quiet', originDir, 'HEAD:refs/heads/lane/seed'], referenceDir);
  git(['update-ref', 'refs/heads/trunk', 'refs/heads/lane/seed'], originDir);
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

const poolArgs = () => [`--origin=${originDir}`, `--reference=${referenceDir}`, '--name=releaseowner', '--branch=trunk', '--no-install'];

describe('lane-pool release ownership via ownerSession (#2452 Gap 2)', () => {
  // Both `acquire` and `release` below pass an EXPLICIT, DELIBERATELY-DIFFERENT `--session=` string
  // (`acquired-as-host-A` vs. `released-as-host-B`) — standing in for `defaultSession()`'s real
  // `${hostname()}:${process.ppid}` fallback, which genuinely differs between two separate shell
  // invocations (the exact bug: acquire's pid is long gone by the time release runs). Without this
  // explicit mismatch, both calls here would spawn from the SAME vitest worker process and so share
  // one `process.ppid` — accidentally passing via the trivial exact-session-match path and never
  // exercising the `ownerSession` fallback this test exists to prove.
  it('the ACQUIRING session releases its own lease WITHOUT --force, via ownerSession alone (session strings deliberately differ)', () => {
    const provision = runPool(['provision', '--count=1', ...poolArgs()], 'sess-uuid-mine');
    expect(provision.code).toBe(0);

    const acquire = runPool(['acquire', ...poolArgs(), '--no-reset', '--session=acquired-as-host-A'], 'sess-uuid-mine');
    expect(acquire.code).toBe(0);

    const release = runPool(['release', '--lane=1', ...poolArgs(), '--session=released-as-host-B'], 'sess-uuid-mine');
    expect(release.code).toBe(0);
    expect(release.out + release.err).not.toMatch(/not yours/);
    if (release.out.trim()) {
      const parsed = JSON.parse(release.out);
      expect(parsed.released).toBe(1);
    }
  });

  it('a DIFFERENT ownerSession is still refused without --force (a genuinely foreign lease stays protected)', () => {
    const provision = runPool(['provision', '--count=1', ...poolArgs()], 'sess-uuid-A');
    expect(provision.code).toBe(0);

    const acquire = runPool(['acquire', ...poolArgs(), '--no-reset', '--session=acquired-as-host-A'], 'sess-uuid-A');
    expect(acquire.code).toBe(0);

    const release = runPool(['release', '--lane=1', ...poolArgs(), '--session=released-as-host-B'], 'sess-uuid-B');
    expect(release.code).toBe(0); // release doesn't hard-fail; it logs + skips
    expect(release.out + release.err).toMatch(/not yours/);

    const forced = runPool(['release', '--lane=1', '--force', ...poolArgs(), '--session=released-as-host-B'], 'sess-uuid-B');
    expect(forced.code).toBe(0);
    expect(forced.out + forced.err).not.toMatch(/not yours/);
  });
});
