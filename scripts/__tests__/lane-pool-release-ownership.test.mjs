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

    // #2452 review — `--json` is REQUIRED for this to assert anything: `log()` writes to stderr, so without
    // it stdout is empty. The original assertion sat behind a truthiness check on stdout, which was therefore
    // always false — the test could (and did) pass while releasing zero lanes. Ask for the machine-readable
    // result and assert the release count unconditionally.
    const release = runPool(['release', '--lane=1', ...poolArgs(), '--session=released-as-host-B', '--json'], 'sess-uuid-mine');
    expect(release.code).toBe(0);
    expect(release.out + release.err).not.toMatch(/not yours/);
    expect(release.out.trim()).not.toBe('');
    expect(JSON.parse(release.out).released).toBe(1);
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

  // #2452 review — the SWEEP blast radius. `ownerSession` is stamped on EVERY lease, and sibling conveyor
  // lanes (`conveyor-delivery` / `conveyor-fix` / …) are UNMARKED yet share one `ownerSession`, because #2413
  // says a spawned subagent inherits the parent id verbatim. Before this fix, an un-forced `release --all` from
  // any of those siblings dropped ALL of their live leases — after which a fresh `acquire` runs
  // `checkout -B --force` + `clean -fd` on a clone another sub-flow was still working in. The sweep must stay
  // on the exact-`session` rule; only naming the lane may use the `ownerSession` fallback.
  it('`release --all` does NOT drop a sibling lease that merely shares the caller\'s CLAUDE_CODE_SESSION_ID', () => {
    const provision = runPool(['provision', '--count=1', ...poolArgs()], 'sess-uuid-shared');
    expect(provision.code).toBe(0);

    // the sibling acquires under the shared session id, with its own host:pid-style `session` string
    const acquire = runPool(['acquire', ...poolArgs(), '--no-reset', '--session=sibling-host-A'], 'sess-uuid-shared');
    expect(acquire.code).toBe(0);

    // a DIFFERENT sub-flow of the same session sweeps: same CLAUDE_CODE_SESSION_ID, different `session` string
    const sweep = runPool(['release', '--all', ...poolArgs(), '--session=sweeper-host-B', '--json'], 'sess-uuid-shared');
    expect(sweep.code).toBe(0);
    expect(JSON.parse(sweep.out).released).toBe(0);
    expect(sweep.out + sweep.err).toMatch(/not yours/);
    // …and the message points at the escape hatch rather than just refusing
    expect(sweep.out + sweep.err).toMatch(/release --lane=1/);

    // the lease really is still held — a targeted release still finds it there to drop
    const targeted = runPool(['release', '--lane=1', ...poolArgs(), '--session=sweeper-host-B', '--json'], 'sess-uuid-shared');
    expect(targeted.code).toBe(0);
    expect(JSON.parse(targeted.out).released).toBe(1);
  });

  it('`release --all` still releases a lease whose exact `session` string matches the caller', () => {
    const provision = runPool(['provision', '--count=1', ...poolArgs()], 'sess-uuid-shared');
    expect(provision.code).toBe(0);
    const acquire = runPool(['acquire', ...poolArgs(), '--no-reset', '--session=same-slug'], 'sess-uuid-shared');
    expect(acquire.code).toBe(0);

    const sweep = runPool(['release', '--all', ...poolArgs(), '--session=same-slug', '--json'], 'sess-uuid-shared');
    expect(sweep.code).toBe(0);
    expect(JSON.parse(sweep.out).released).toBe(1);
  });
});

// ── #2997 — the TARGETED release hole #2452's `targeted` gate did not close ──────────────────────────────
//
// THE LIVE OCCURRENCE (2026-08-14, ordinary delivery work, no probe and no override flag): a subagent finished
// its task and ran `lane-pool.mjs release --lane=5` intending to drop its OWN lease
// (`Mac:39367 file-memory-rewrite-gap`). It released a DIFFERENT concurrent holder's
// (`Mac:39423 review-1222-r2`) and the pool accepted it, because both leases carried the same parent
// `CLAUDE_CODE_SESSION_ID` and the ownership check resolved to "same session, therefore mine". Nothing was lost
// only because that holder had already finished — a released lane is immediately re-issuable and the next
// `acquire` runs `checkout -B --force` + `clean -fd` on it. So `release` alone is a data-loss path, and a fix
// that only guarded destructive git ops would not have closed it.
//
// #2452 saw the mechanism and gated the `ownerSession` fallback behind `targeted`. But naming a lane only
// proves the caller MEANT that lane, never that it HOLDS it — and this release named one.
describe('lane-pool #2997 — a TARGETED release of a CONTESTED lease needs the minted holder slug', () => {
  const acquireTwoSiblings = () => {
    expect(runPool(['provision', '--count=2', ...poolArgs()], 'sess-uuid-shared').code).toBe(0);
    // Two ordinary subagents of ONE session, each acquiring its own lane — the default shape of a delivery
    // session, and the shape #2413's `workflowLane` marker never covers (nothing here passes that purpose).
    const a = runPool(['acquire', ...poolArgs(), '--no-reset', '--purpose=file-memory-rewrite-gap', '--json'], 'sess-uuid-shared');
    const b = runPool(['acquire', ...poolArgs(), '--no-reset', '--purpose=review-1222-r2', '--json'], 'sess-uuid-shared');
    expect(a.code).toBe(0);
    expect(b.code).toBe(0);
    return { a: JSON.parse(a.out), b: JSON.parse(b.out) };
  };

  it('EVERY acquire now mints a per-holder slug and hands it to the acquirer (#2997)', () => {
    const { a, b } = acquireTwoSiblings();
    expect(a.holder).toBeTruthy();
    expect(b.holder).toBeTruthy();
    expect(a.holder).not.toBe(b.holder); // the one signal ownerSession structurally cannot provide
    expect(a.holder).toMatch(/^file-memory-rewrite-gap-lane-\d+-[0-9a-f]{8}$/);
  });

  it('THE INCIDENT: a sibling\'s targeted `release --lane=N` no longer drops the other holder\'s lease', () => {
    const { a, b } = acquireTwoSiblings();
    // agent A releases B's lane by mistake — same CLAUDE_CODE_SESSION_ID, and it named the lane.
    const wrong = runPool(['release', `--lane=${b.lane}`, ...poolArgs(), `--session=${a.holder}`, '--json'], 'sess-uuid-shared');
    expect(wrong.code).toBe(0); // release logs + skips, it never hard-fails
    expect(JSON.parse(wrong.out).released).toBe(0);
    expect(wrong.out + wrong.err).toMatch(/CONTESTED/);
    // the deny must NAME the remedy, or it becomes the next false-deny footgun (#2986/#2994)
    expect(wrong.out + wrong.err).toMatch(new RegExp(`release --lane=${b.lane} --session=${b.holder}`));
  });

  it('the TRUE holder still releases its own contested lane, with no --force, by asserting its slug', () => {
    const { b } = acquireTwoSiblings();
    const right = runPool(['release', `--lane=${b.lane}`, ...poolArgs(), `--session=${b.holder}`, '--json'], 'sess-uuid-shared');
    expect(right.code).toBe(0);
    expect(JSON.parse(right.out).released).toBe(1);
    expect(right.out + right.err).not.toMatch(/not yours/);
  });

  it('the OPERATOR escape is intact — --force still breaks a contested lease (stale-lane cleanup keeps working)', () => {
    const { a, b } = acquireTwoSiblings();
    const forced = runPool(['release', `--lane=${b.lane}`, '--force', ...poolArgs(), `--session=${a.holder}`, '--json'], 'sess-uuid-shared');
    expect(forced.code).toBe(0);
    expect(JSON.parse(forced.out).released).toBe(1);
  });

  it('MUST-ALLOW: an UNCONTESTED release is untouched — the #2452 ownerSession fallback still works alone', () => {
    // One holder, no sibling ⇒ not contested ⇒ the durable-id fallback answers, exactly as #2452 shipped it.
    expect(runPool(['provision', '--count=2', ...poolArgs()], 'sess-uuid-solo').code).toBe(0);
    const solo = JSON.parse(runPool(['acquire', ...poolArgs(), '--no-reset', '--purpose=solo', '--json'], 'sess-uuid-solo').out);
    const release = runPool(['release', `--lane=${solo.lane}`, ...poolArgs(), '--session=different-host-B', '--json'], 'sess-uuid-solo');
    expect(release.code).toBe(0);
    expect(JSON.parse(release.out).released).toBe(1);
  });

  it('a lease held by a genuinely DIFFERENT session is still refused, contested or not (no refusal weakened)', () => {
    expect(runPool(['provision', '--count=2', ...poolArgs()], 'sess-uuid-A').code).toBe(0);
    const theirs = JSON.parse(runPool(['acquire', ...poolArgs(), '--no-reset', '--purpose=theirs', '--json'], 'sess-uuid-A').out);
    const release = runPool(['release', `--lane=${theirs.lane}`, ...poolArgs(), '--session=mine-host-B'], 'sess-uuid-B');
    expect(release.out + release.err).toMatch(/not yours/);
  });
});
