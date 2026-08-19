/**
 * @file bootstrap-session.test.mjs — a fresh machine gets the setup its HOST needs, once, idempotently.
 *   Pure over injected env / settings / existence probes; no io, so the ephemeral plan is testable from a
 *   laptop and the laptop plan from a container.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  REPO_ROOT,
  gitDirStatus,
  detectHost,
  memoryDirs,
  planSteps,
  selfKey,
  siblingsFor,
  lanePool,
  primaryCheckout,
  withPrimaryGitDir,
  skillsDeployScript,
  mayWriteUserTree,
  knownGitDirs,
  withBootstrapHook,
  withoutBootstrapHook,
  bootstrapStatus,
  main,
} from '../bootstrap-session.mjs';

const step = (steps, id) => steps.find((s) => s.id === id);

describe('detectHost', () => {
  it('reads a cloud container from either runner signal alone', () => {
    expect(detectHost({ CLAUDE_CODE_CONTAINER_ID: 'container_01X' }).ephemeral).toBe(true);
    expect(detectHost({ CCR_AGENT_PROXY_ENABLED: '1' }).ephemeral).toBe(true);
  });

  // Requiring BOTH would fail closed the moment the runner renames one — and failing closed here means the
  // laptop plan (lane pool, guard) runs on a VM that has neither.
  it('names which signals fired, so a rename is diagnosable rather than silent', () => {
    const { signals } = detectHost({ CLAUDE_CODE_CONTAINER_ID: 'c', CCR_AGENT_PROXY_ENABLED: '1' });
    expect(signals).toEqual(['CLAUDE_CODE_CONTAINER_ID', 'CCR_AGENT_PROXY_ENABLED']);
  });

  it('treats a bare workstation env as durable', () => {
    expect(detectHost({ HOME: '/Users/someone' })).toEqual({ ephemeral: false, signals: [] });
  });

  // The proxy flag is set to '1', not merely present; '0' must not read as a container.
  it('does not read a disabled proxy flag as a container', () => {
    expect(detectHost({ CCR_AGENT_PROXY_ENABLED: '0' }).ephemeral).toBe(false);
  });
});

describe('memoryDirs', () => {
  it('derives the user-level key exactly as check-memory.mjs does', () => {
    const { user, repo } = memoryDirs('/workspace/web-everything', '/root');
    expect(user).toBe('/root/.claude/projects/-workspace-web-everything/memory');
    expect(repo).toBe('/workspace/web-everything/.claude/agent-memory');
  });
});

describe('planSteps', () => {
  it('deploys every skill on an ephemeral host and only the present ones on a laptop', () => {
    expect(step(planSteps({ ephemeral: true }), 'skills').argv).toEqual(['--all']);
    expect(step(planSteps({ ephemeral: false }), 'skills').argv).toEqual([]);
  });

  // The pool exists to dodge a branch guard, share objects via --reference and persist between batches.
  // A cloud VM has none of those, so provisioning one costs an `npm ci` per lane for nothing.
  it('skips the lane pool on an ephemeral host, with the reason attached', () => {
    const lanes = step(planSteps({ ephemeral: true }), 'lanes');
    expect(lanes.skip).toMatch(/reclaimed on idle/);
  });

  it('never plans to install the guard on an ephemeral host', () => {
    expect(step(planSteps({ ephemeral: true }), 'guard').skip).toBeTruthy();
  });

  it('resolves memory to the in-repo copy when the user-level dir is absent', () => {
    const exists = (p) => p.endsWith('/.claude/agent-memory');
    const found = step(planSteps({ ephemeral: true, root: '/workspace/web-everything', home: '/root', exists }), 'memory').verify();
    expect(found).toEqual({ via: 'repo', dir: '/workspace/web-everything/.claude/agent-memory' });
  });

  it('prefers the user-level dir when the laptop reserved lane is mounted', () => {
    const found = step(planSteps({ ephemeral: false, root: '/ws/webeverything', home: '/home/n', exists: () => true }), 'memory').verify();
    expect(found.via).toBe('user');
  });

  it('reports memory as absent rather than guessing a path', () => {
    expect(step(planSteps({ ephemeral: true, exists: () => false }), 'memory').verify()).toBeNull();
  });

  // Cloud siblings arrive via the harness's add_repo + credential-proxied clone; no script here can do it.
  it('reports missing siblings as siblings of the repo root, never clones them', () => {
    const found = step(planSteps({ ephemeral: true, root: '/workspace/web-everything', exists: () => false }), 'siblings').verify();
    expect(found.map((s) => s.name)).toEqual(['frontierui', 'plateau-app']);
    expect(found.map((s) => s.path)).toEqual(['/workspace/frontierui', '/workspace/plateau-app']);
    expect(found.every((s) => s.present === false)).toBe(true);
  });
});

// This script must survive its own relocation: the lane/delivery machinery is Plateau's product, and WE is a
// public PEER that dogfoods it. Anything that hard-codes "I am WE" inverts silently on the day of the move.
describe('relocation', () => {
  it('derives which constellation repo it is in, under either WE directory name', () => {
    expect(selfKey('/workspace/web-everything')).toBe('we');
    expect(selfKey('/Users/n/workspace/webeverything')).toBe('we');
    expect(selfKey('/workspace/plateau-app')).toBe('plateau-app');
  });

  it('returns null for an unrecognised checkout rather than assuming WE', () => {
    expect(selfKey('/workspace/some-fork')).toBeNull();
  });

  // The whole point: moved to plateau-app, WE becomes the sibling. A hard-coded list would have reported
  // plateau-app as missing from itself and never mentioned WE at all.
  it('names WE as a sibling once it lives in plateau-app', () => {
    const found = siblingsFor('/workspace/plateau-app', () => false);
    expect(found.map((s) => s.name)).toEqual(['we', 'frontierui']);
    expect(found.find((s) => s.name === 'we').path).toBe('/workspace/web-everything');
  });

  it('never lists the checkout it is in as its own sibling', () => {
    for (const root of ['/workspace/web-everything', '/workspace/frontierui', '/workspace/plateau-app']) {
      expect(siblingsFor(root, () => false).map((s) => s.name)).not.toContain(selfKey(root));
    }
  });

  it('lists the whole constellation from an unrecognised checkout, rather than a confident subset', () => {
    expect(siblingsFor('/workspace/some-fork', () => false).map((s) => s.name)).toEqual(['we', 'frontierui', 'plateau-app']);
  });

  it('resolves a sibling at whichever directory name it actually occupies', () => {
    const exists = (p) => p === '/ws/webeverything';
    expect(siblingsFor('/ws/plateau-app', exists).find((s) => s.name === 'we')).toMatchObject({ path: '/ws/webeverything', present: true });
  });
});

/**
 * #xsarpbt — THE COMMON CASE WAS THE BROKEN ONE. A lane clone is where agent work actually happens, so
 * `basename(root)` is `lane-9` far more often than it is `web-everything`, and `lane-9` names no repo. The
 * resulting `null` is not inert: `siblingKeys(null)` returns the WHOLE table, so one run reported the
 * checkout it was standing in as an unrecognised repo AND as a missing sibling of itself. Both halves are
 * asserted here, because fixing only the naming would leave every sibling located inside the lane pool.
 */
describe('a lane clone answers for the repo its POOL was cloned from', () => {
  const LANE = '/ws/.lanes/web-everything/lane-9';

  it('resolves the lane to its repo instead of reading `lane-9` as a directory name', () => {
    expect(selfKey(LANE)).toBe('we');
    expect(selfKey('/ws/.lanes/plateau-app/lane-3')).toBe('plateau-app');
  });

  it('does NOT list the repo the caller is standing in as a missing sibling', () => {
    const found = siblingsFor(LANE, () => false);
    expect(found.map((s) => s.name)).toEqual(['frontierui', 'plateau-app']);
    expect(found.map((s) => s.name)).not.toContain('we');
  });

  // BOTH parents are live, so both are probed. The laptop puts siblings beside the PRIMARY…
  it('finds a sibling beside the primary checkout', () => {
    const exists = (p) => p === '/ws/webeverything' || p === '/ws/frontierui';
    const found = siblingsFor(LANE, exists);
    expect(found.find((s) => s.name === 'frontierui')).toMatchObject({ path: '/ws/frontierui', present: true });
    expect(found.find((s) => s.name === 'plateau-app')).toMatchObject({ path: '/ws/plateau-app', present: false });
  });

  // …and the cloud VM puts them inside the POOL, beside the lanes that need them. Resolving from the primary
  // alone is the tidier rule and it is wrong here: measured on this repo's VM, a `--dry-run` from lane-1
  // reported both siblings MISSING under that rule and both PRESENT once the pool was probed too.
  it('finds a sibling that lives inside the lane pool, beside the lanes', () => {
    const exists = (p) => p.startsWith('/ws/.lanes/web-everything/');
    const found = siblingsFor(LANE, exists);
    expect(found.find((s) => s.name === 'frontierui'))
      .toMatchObject({ path: '/ws/.lanes/web-everything/frontierui', present: true });
    expect(found.find((s) => s.name === 'plateau-app'))
      .toMatchObject({ path: '/ws/.lanes/web-everything/plateau-app', present: true });
  });

  // An ABSENT sibling is reported where the operator should put it — beside the primary — not at whichever
  // candidate happened to be probed last.
  it('reports a genuinely missing sibling at the primary-relative path', () => {
    const found = siblingsFor(LANE, () => false);
    expect(found.map((s) => s.path)).toEqual(['/ws/frontierui', '/ws/plateau-app']);
  });

  // Fail-closed is the pre-existing contract for an unrecognised checkout, and a lane must not weaken it —
  // note the workspace here is itself named `web-everything`, which a naive `basename(primaryCheckout(…))`
  // would happily read as WE even though the pool says otherwise.
  it('still returns null for a lane of a pool naming no known repo', () => {
    expect(selfKey('/ws/.lanes/mystery/lane-1')).toBeNull();
    expect(selfKey('/ws/web-everything/.lanes/mystery/lane-1')).toBeNull();
  });
});

describe('lanePool', () => {
  it('is null for a checkout that is not a lane at all', () => {
    for (const root of ['/ws/web-everything', '/ws/webeverything', '/']) expect(lanePool(root)).toBeNull();
  });

  it('names the pool and the workspace around it', () => {
    expect(lanePool('/ws/.lanes/web-everything/lane-9')).toEqual({ workspace: '/ws', pool: 'web-everything' });
  });

  // Counting backwards from the end reads `lane-9` as the pool the moment a caller stands one level deeper,
  // which is why the parse runs FORWARD from the marker.
  it('reads the pool from a subdirectory of a lane too', () => {
    expect(lanePool('/ws/.lanes/web-everything/lane-9/scripts/lib')).toEqual({ workspace: '/ws', pool: 'web-everything' });
    expect(selfKey('/ws/.lanes/web-everything/lane-9/scripts/lib')).toBe('we');
  });

  it('is null for the pool DIRECTORY itself — nobody works there', () => {
    expect(lanePool('/ws/.lanes/web-everything')).toBeNull();
  });
});

// The grant that used to be an absolute `/Users/<name>/…` literal in the COMMITTED settings file: wrong for
// everyone else, dead in every VM. It is machine state, so it is derived and written at machine level.
describe('primaryCheckout', () => {
  it('is the checkout itself when that is not a lane', () => {
    expect(primaryCheckout('/ws/webeverything')).toBe('/ws/webeverything');
  });

  it('resolves a lane clone back to the primary it was cloned from', () => {
    expect(primaryCheckout('/ws/.lanes/plateau-app/lane-3', () => true)).toBe('/ws/plateau-app');
  });

  // The POOL directory is named from the origin slug (`web-everything`) while the laptop's primary checkout
  // is `webeverything`. Deriving the primary's name from the pool's produced a path resolving nowhere.
  it('probes for the primary directory rather than assuming it matches the pool name', () => {
    const exists = (p) => p === '/ws/webeverything';
    expect(primaryCheckout('/ws/.lanes/web-everything/lane-9', exists)).toBe('/ws/webeverything');
  });

  it('falls back to the workspace when the lane names no known repo', () => {
    expect(primaryCheckout('/ws/.lanes/mystery/lane-1', () => true)).toBe('/ws');
  });
});

// The fix for the revoked-grant bug depends on this enumerating every path the script could have written.
// Mutation probe (converge finding, 2026-08-18): the earlier suite imported `knownGitDirs` but only ever
// passed hand-built `known` arrays to withPrimaryGitDir — so returning [] from here reddened nothing.
describe('knownGitDirs', () => {
  it('enumerates the .git of every constellation checkout beside this one, under each name it answers to', () => {
    const got = knownGitDirs('/ws/webeverything');
    expect(got).toContain('/ws/webeverything/.git');
    expect(got).toContain('/ws/web-everything/.git');
    expect(got).toContain('/ws/frontierui/.git');
    expect(got).toContain('/ws/plateau-app/.git');
  });

  it('resolves from the PRIMARY when called inside a lane, not from the pool directory', () => {
    expect(knownGitDirs('/ws/.lanes/web-everything/lane-4')).toContain('/ws/frontierui/.git');
  });

  it('never returns empty — an empty set silently disables the repair it gates', () => {
    expect(knownGitDirs('/ws/webeverything').length).toBeGreaterThan(0);
  });
});

describe('withPrimaryGitDir', () => {
  it('grants the derived .git directory', () => {
    const out = withPrimaryGitDir({}, '/ws/webeverything/.git');
    expect(out.permissions.additionalDirectories).toEqual(['/ws/webeverything/.git']);
  });

  // REPAIR, not append — a moved checkout must not leave a dead grant beside the live one.
  it('replaces a stale .git grant rather than accumulating', () => {
    const known = ['/Users/someone/workspace/webeverything/.git'];
    let s = withPrimaryGitDir({}, '/Users/someone/workspace/webeverything/.git');
    s = withPrimaryGitDir(s, '/ws/webeverything/.git', known);
    expect(s.permissions.additionalDirectories).toEqual(['/ws/webeverything/.git']);
  });

  // Converge finding, 2026-08-18: the first cut dropped ANY entry ending in `/.git`, so a re-run silently
  // REVOKED an operator's hand-added grant for an unrelated repo. Only grants we can prove are ours may go.
  it("never revokes an operator's .git grant for a repo this script does not own", () => {
    const before = { permissions: { additionalDirectories: ['/elsewhere/other-repo/.git'] } };
    const out = withPrimaryGitDir(before, '/ws/webeverything/.git', ['/ws/webeverything/.git']);
    expect(out.permissions.additionalDirectories).toContain('/elsewhere/other-repo/.git');
    expect(out.permissions.additionalDirectories).toContain('/ws/webeverything/.git');
  });

  it('leaves the operator’s non-.git directories alone', () => {
    const before = { permissions: { additionalDirectories: ['/ws/notes'] } };
    const out = withPrimaryGitDir(before, '/ws/webeverything/.git');
    expect(out.permissions.additionalDirectories).toEqual(['/ws/notes', '/ws/webeverything/.git']);
  });

  it('does not mutate the settings it was given', () => {
    const before = { permissions: { additionalDirectories: [] } };
    withPrimaryGitDir(before, '/ws/webeverything/.git');
    expect(before.permissions.additionalDirectories).toHaveLength(0);
  });
});

describe('skillsDeployScript', () => {
  it('uses this checkout when it carries the CLI', () => {
    const exists = (p) => p === '/ws/webeverything/scripts/sync-skills-deploy.mjs';
    expect(skillsDeployScript('/ws/webeverything', exists)).toBe('/ws/webeverything/scripts/sync-skills-deploy.mjs');
  });

  // Converge finding, 2026-08-18: searching siblings and execFileSync-ing whatever was found is a cross-repo
  // code-execution path. Siblings arrive unvetted via the harness on a VM, and the search ran on every
  // automatic SessionStart. A sibling's copy must NEVER be selected, however convenient.
  it('never selects a sibling checkout, even when this one lacks the CLI', () => {
    const exists = (p) => p.startsWith('/ws/web-everything');
    expect(skillsDeployScript('/ws/plateau-app', exists)).toBeNull();
  });

  it('reports absence rather than returning a path that resolves nowhere', () => {
    expect(skillsDeployScript('/ws/plateau-app', () => false)).toBeNull();
  });
});

// The committed project SessionStart hook makes a default run automatic on first open of the repo, so what a
// default run may touch is a consent question — and a workstation is where it bites.
describe('mayWriteUserTree', () => {
  it('does not write on a durable host without an explicit install', () => {
    expect(mayWriteUserTree({ ephemeral: false })).toBe(false);
  });

  it('writes on an ephemeral host, whose $HOME is a container reclaimed on idle', () => {
    expect(mayWriteUserTree({ ephemeral: true })).toBe(true);
  });

  it('writes on a durable host when install was asked for explicitly', () => {
    expect(mayWriteUserTree({ ephemeral: false, explicitInstall: true })).toBe(true);
  });
});

describe('withBootstrapHook', () => {
  it('registers the script under SessionStart with an absolute path', () => {
    const out = withBootstrapHook({}, '/ws/webeverything/scripts/bootstrap-session.mjs');
    expect(bootstrapStatus(out, () => true)).toEqual([
      { path: '/ws/webeverything/scripts/bootstrap-session.mjs', resolves: true, absolute: true },
    ]);
  });

  // REPAIR, not append. Re-running after the checkout moves must replace the stale path — a second
  // registration pointing nowhere looks installed while doing nothing.
  it('replaces an existing entry rather than adding a second', () => {
    let s = withBootstrapHook({}, '/old/scripts/bootstrap-session.mjs');
    s = withBootstrapHook(s, '/ws/webeverything/scripts/bootstrap-session.mjs');
    const found = bootstrapStatus(s, () => true);
    expect(found).toHaveLength(1);
    expect(found[0].path).toBe('/ws/webeverything/scripts/bootstrap-session.mjs');
  });

  it('preserves SessionStart hooks it does not own', () => {
    const before = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node other.mjs' }] }] } };
    const out = withBootstrapHook(before, '/ws/scripts/bootstrap-session.mjs');
    const commands = out.hooks.SessionStart.flatMap((b) => b.hooks.map((h) => h.command));
    expect(commands).toContain('node other.mjs');
  });

  it('leaves other hook types untouched', () => {
    const before = { hooks: { PreToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'node scripts/guard-lane.mjs' }] }] } };
    const out = withBootstrapHook(before, '/ws/scripts/bootstrap-session.mjs');
    expect(out.hooks.PreToolUse).toEqual(before.hooks.PreToolUse);
  });

  it('does not mutate the settings it was given', () => {
    const before = { hooks: { SessionStart: [] } };
    withBootstrapHook(before, '/ws/scripts/bootstrap-session.mjs');
    expect(before.hooks.SessionStart).toHaveLength(0);
  });

  it('round-trips: uninstall removes exactly what install added', () => {
    const before = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node other.mjs' }] }] } };
    const out = withoutBootstrapHook(withBootstrapHook(before, '/ws/scripts/bootstrap-session.mjs'));
    expect(out).toEqual(before);
  });
});

describe('bootstrapStatus', () => {
  it('flags an entry whose path no longer resolves', () => {
    const s = withBootstrapHook({}, '/moved/scripts/bootstrap-session.mjs');
    expect(bootstrapStatus(s, () => false)[0].resolves).toBe(false);
  });

  it('reports nothing for settings that register no bootstrap', () => {
    expect(bootstrapStatus({})).toEqual([]);
    expect(bootstrapStatus({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node other.mjs' }] }] } })).toEqual([]);
  });
});

/**
 * The `gitdir` step's status decision (converge round 4, `review-pr` correctness juror on #1463).
 *
 * The bug this pins: the branch reported `planned` on EVERY read-only path, so `--check`'s "report drift
 * only … exit 1 if any" contract was unreachable for this step — a missing grant printed exactly what a
 * correct one printed, and the exit code keys off `drift`. It lived inline in the un-exported `main`, which
 * is precisely why no test caught it.
 */
describe('the gitdir step decides status without writing', () => {
  const GITDIR = '/ws/webeverything/.git';
  const withGrant = { permissions: { additionalDirectories: [GITDIR] } };
  const noGrant = { permissions: { additionalDirectories: ['/somewhere/else/.git'] } };

  it('reports `planned` for --dry-run, which reads nothing', () => {
    expect(gitDirStatus({ gitDir: GITDIR, settings: null, write: false, dryRun: true }))
      .toEqual({ status: 'planned', detail: GITDIR, grant: false });
  });

  it('REPORTS DRIFT when a read-only run finds no grant — the contract that could never fire', () => {
    const r = gitDirStatus({ gitDir: GITDIR, settings: noGrant, write: false });
    expect(r.status).toBe('drift');
    expect(r.grant).toBe(false);
    expect(r.detail).toMatch(/NOT granted/);
  });

  it('reports `ok` when a read-only run finds the grant already present', () => {
    const r = gitDirStatus({ gitDir: GITDIR, settings: withGrant, write: false });
    expect(r.status).toBe('ok');
    expect(r.grant).toBe(false);
  });

  it('never asks for a write on a read-only path, present or absent', () => {
    for (const settings of [withGrant, noGrant, {}, null]) {
      expect(gitDirStatus({ gitDir: GITDIR, settings, write: false }).grant).toBe(false);
    }
  });

  it('grants exactly once on a writing path — and not again when already present', () => {
    expect(gitDirStatus({ gitDir: GITDIR, settings: noGrant, write: true }))
      .toEqual({ status: 'ok', detail: `${GITDIR} (granted)`, grant: true });
    expect(gitDirStatus({ gitDir: GITDIR, settings: withGrant, write: true }))
      .toEqual({ status: 'ok', detail: `${GITDIR} (already granted)`, grant: false });
  });

  it('treats absent/malformed settings as no grant rather than throwing', () => {
    for (const settings of [{}, null, undefined, { permissions: {} }]) {
      expect(gitDirStatus({ gitDir: GITDIR, settings, write: false }).status).toBe('drift');
    }
  });
});

/**
 * The post-merge hook must not CREATE the operator's machine-global commands tree.
 *
 * `--all` does not mean "deploy every command" — it means "create the tree on a machine that has never
 * chosen to have one" (`if (!all && !exists(destRoot)) return null`). Passing it from an unattended hook
 * turned a routine `git pull` into an unasked write into `~/.claude/commands`, live in every unrelated repo
 * the operator opens. The skills line above it passes no `--all` and structurally cannot do this.
 */
describe('the post-merge hook is consent-preserving', () => {
  const hook = readFileSync(join(REPO_ROOT, '.githooks', 'post-merge'), 'utf8');
  const commandsLine = hook.split('\n').find((l) => l.includes('sync-commands-deploy.mjs') && !l.trimStart().startsWith('#'));

  it('invokes the commands deploy WITHOUT --all', () => {
    expect(commandsLine).toBeTruthy();
    expect(commandsLine).not.toMatch(/--all/);
  });

  it('keeps the skills line free of --all too, so the two stay symmetric', () => {
    const skillsLine = hook.split('\n').find((l) => l.includes('sync-skills-deploy.mjs') && !l.trimStart().startsWith('#'));
    expect(skillsLine).toBeTruthy();
    expect(skillsLine).not.toMatch(/--all/);
  });

  it('does not tell the operator to hand-run --all in its failure message either', () => {
    expect(commandsLine).not.toMatch(/commands:sync -- --all/);
  });
});

/**
 * #3197 — the ORCHESTRATION, not the decisions.
 *
 * `gitDirStatus`, `mayWriteUserTree` and `planSteps` were already pure and tested. What had no test was the
 * `main()` that calls them: which steps run, what `--dry-run` reports without writing, whether a drift
 * actually reaches the exit code. An installer is precisely the code a human runs once and trusts, so the
 * sequencing is the part that must not be wrong — and it was the part nothing pinned.
 *
 * Every handle is injected. Nothing here spawns a process or touches a settings file; a test that needed to
 * would be testing the machine, and would not run on the other kind of host.
 */
describe('main() — the installer orchestration', () => {
  const spyIo = (over = {}) => {
    const io = {
      lines: [], writes: [], skills: [], hooks: [],
      readSettings: () => ({}),
      writeSettings: (next) => io.writes.push(next),
      installHook: () => { io.hooks.push('install'); return 'registered'; },
      uninstallHook: () => { io.hooks.push('uninstall'); return 'removed'; },
      runSkills: (script, argv, opts) => { io.skills.push({ script, argv, ...opts }); return { ok: true, out: 'in sync' }; },
      exists: () => true,
      env: {},
      out: (line) => io.lines.push(line),
      ...over,
    };
    return io;
  };
  const LAPTOP = {};                                   // no runner signals → durable host
  const VM = { CLAUDE_CODE_CONTAINER_ID: 'container_01X' };
  const report = (io) => JSON.parse(io.lines.join('\n'));

  const run = (argv, env, over = {}) => { const io = spyIo({ env, ...over }); const code = main(argv, io); return { io, code }; };

  it('reports the host it detected and the checkout it is in', () => {
    const vm = run(['--json'], VM);
    expect(vm.code).toBe(0);
    expect(report(vm.io)).toMatchObject({ host: 'ephemeral', signals: ['CLAUDE_CODE_CONTAINER_ID'] });
    expect(report(run(['--json'], LAPTOP).io)).toMatchObject({ host: 'laptop', signals: [] });
  });

  // THE CONSENT INVARIANT, at the orchestration level. A durable host is REPORTED ON. The committed
  // SessionStart hook means this runs the moment anyone opens the repo, so a default run that wrote would
  // grant a directory and install a USER-level hook in every unrelated repo on that machine.
  it('writes NOTHING on a durable host without the explicit `install`', () => {
    const io = spyIo({ env: LAPTOP });
    main([], io);
    expect(io.writes).toEqual([]);
    expect(io.hooks).toEqual([]);
    expect(io.lines.join('\n')).toMatch(/reported only/);
  });

  it('registers the SessionStart hook once `install` is given explicitly', () => {
    const io = spyIo({ env: LAPTOP });
    main(['install', '--json'], io);
    expect(io.hooks).toEqual(['install']);
    expect(report(io).hook).toBe('registered');
  });

  it('uninstall short-circuits — no plan is run and nothing else is touched', () => {
    const io = spyIo({ env: VM });
    expect(main(['uninstall'], io)).toBe(0);
    expect(io.hooks).toEqual(['uninstall']);
    expect(io.skills).toEqual([]);
    expect(io.writes).toEqual([]);
  });

  // `--dry-run` must PLAN and not perform. Reporting what it would do is the whole value; doing any of it is
  // the whole defect.
  it('--dry-run reports the deploy it would run and does not run it', () => {
    const io = spyIo({ env: VM });
    expect(main(['--dry-run', '--json'], io)).toBe(0);
    const steps = report(io).steps;
    expect(steps.find((s) => s.id === 'skills')).toMatchObject({ status: 'planned' });
    expect(steps.find((s) => s.id === 'commands')).toMatchObject({ status: 'planned' });
    expect(io.skills).toEqual([]);
    expect(io.writes).toEqual([]);
    expect(io.hooks).toEqual([]);
  });

  it('runs the deploys in plan order on a host that may write', () => {
    const io = spyIo({ env: VM });
    main(['--json'], io);
    expect(io.skills.map((s) => s.script.split('/').at(-1)))
      .toEqual(['sync-skills-deploy.mjs', 'sync-commands-deploy.mjs']);
    expect(io.skills.every((s) => s.write)).toBe(true);
  });

  // `--check` is read-only, so the CLI it shells has to be too: `write: false` is what makes the deploy script
  // report drift instead of repairing it.
  it('--check reports drift and exits non-zero rather than repairing it', () => {
    const io = spyIo({ env: VM, runSkills: (script, argv, opts) => { io.skills.push({ script, ...opts }); return { ok: false, out: '3 skills out of date' }; } });
    expect(main(['--check', '--json'], io)).toBe(1);
    expect(report(io).steps.find((s) => s.id === 'skills')).toMatchObject({ status: 'drift', detail: '3 skills out of date' });
    expect(io.skills.every((s) => s.write === false)).toBe(true);
    expect(io.writes).toEqual([]);
  });

  // A drift is only an EXIT CODE under --check. A plain run reports it and returns 0, because a plain run is
  // not a gate and a non-zero there would fail every SessionStart that found anything to do.
  it('does not turn a drift into a failure outside --check', () => {
    const io = spyIo({ env: VM, runSkills: () => ({ ok: false, out: 'out of date' }) });
    expect(main(['--json'], io)).toBe(0);
  });

  it('skips a deploy whose CLI is not in this checkout, and says so', () => {
    const io = spyIo({ env: VM, exists: () => false });
    main(['--json'], io);
    expect(report(io).steps.find((s) => s.id === 'skills'))
      .toMatchObject({ status: 'skipped', detail: expect.stringMatching(/not here/) });
    expect(io.skills).toEqual([]);
  });

  it('honours --laptop and --ephemeral over what it detected', () => {
    const vmForcedLaptop = spyIo({ env: VM }); main(['--laptop', '--json'], vmForcedLaptop);
    expect(report(vmForcedLaptop)).toMatchObject({ host: 'laptop', writes: false });
    const laptopForcedVm = spyIo({ env: LAPTOP }); main(['--ephemeral', '--json'], laptopForcedVm);
    expect(report(laptopForcedVm)).toMatchObject({ host: 'ephemeral', writes: true });
  });
});
