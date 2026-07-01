#!/usr/bin/env node
/**
 * lane-pool.mjs — provision & refresh the persistent lane-clone pool for the #1933 clone-based
 * parallel batch orchestrator (slice 2).
 *
 * The #1933 model replaces guard-blocked `git worktree` isolation with N independent CLONES: each lane
 * is a full clone with its OWN HEAD (so the user-global git-branch guard, which protects the shared
 * checkout's HEAD, never fires on it), and convergence happens through the remote — a lane pushes its
 * work to a throwaway `lane/*` ref (allowed by the #1934 guard carve-out) and the central integrator
 * merges those into `main`. This script owns the *pool*: it creates/refreshes the clones the
 * orchestrator dispatches into; it does NOT dispatch, push, or merge (that's slice 3).
 *
 * Why a PERSISTENT pool (per #1933 design choice 1): re-cloning a large repo every batch is slow, so the
 * lanes are long-lived under `~/workspace/.lanes/<repo>/lane-<n>` and merely fetch + hard-reset to
 * origin/main between batches. Git OBJECTS are shared with the primary checkout via `git clone
 * --reference`, so a lane costs little disk and clones fast (objects come from the local primary, not the
 * network). Node deps (`node_modules`) are NOT shared — `ensureDeps` runs `npm ci` per lane on a fresh
 * clone or when the lockfile changes, so each lane can run its own gate.
 *
 * Repo-parameterized: the pool is keyed by repo NAME, so cross-repo slice 4 (lanes of
 * frontierui / plateau-app — the constellation) reuses this unchanged via `--repo=<checkout-path>`.
 *
 * Usage:
 *   node scripts/lane-pool.mjs provision --count=N [--no-install]   # ensure N lanes exist (clone missing) + refresh all + ensure deps
 *   node scripts/lane-pool.mjs refresh           [--no-install]     # fetch + hard-reset existing lanes to origin/main (no creation)
 *   node scripts/lane-pool.mjs status  [--json]                     # per-lane: path / head / clean / behind origin/main / deps
 *   node scripts/lane-pool.mjs list    [--json]                     # existing lane paths (for the orchestrator to dispatch into)
 *   node scripts/lane-pool.mjs path    --lane=N                     # print one lane's absolute path
 *   node scripts/lane-pool.mjs remove  (--lane=N | --all)           # tear down lane(s)
 *
 * Repo / pool overrides (apply to any command):
 *   --repo=<path>        a checkout to derive the lane repo from (default: the cwd's git toplevel)
 *   --origin=<url>       clone source (default: that checkout's `origin` remote URL)
 *   --reference=<path>   object-sharing reference repo for `git clone --reference` (default: --repo path)
 *   --name=<slug>        pool key under the root (default: derived from the origin URL basename)
 *   --branch=<ref>       integration branch (default: detected origin/HEAD, else `main`)
 *   env LANE_POOL_ROOT   pool root (default: ~/workspace/.lanes)
 */
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join, basename, resolve } from 'node:path';

// ── tiny arg parsing ──────────────────────────────────────────────────────────────────────────────
const [, , cmd, ...rest] = process.argv;
const flags = {};
const positionals = [];
for (const a of rest) {
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  } else positionals.push(a);
}

// ── git helpers (throw-on-error wrappers) ───────────────────────────────────────────────────────────
const git = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitQuiet = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'ignore', 'inherit'] });
const tryGit = (args, cwd) => {
  try {
    return git(args, cwd);
  } catch {
    return null;
  }
};

const expandHome = (p) => (p && p.startsWith('~') ? join(homedir(), p.slice(1)) : p);
const POOL_ROOT = expandHome(process.env.LANE_POOL_ROOT) || join(homedir(), 'workspace', '.lanes');

// ── repo descriptor resolution ──────────────────────────────────────────────────────────────────────
function resolveRepo() {
  const repoPath = resolve(expandHome(flags.repo) || process.cwd());
  const referencePath = resolve(expandHome(flags.reference) || repoPath);
  const topLevel = tryGit(['rev-parse', '--show-toplevel'], referencePath) || referencePath;
  const originUrl = flags.origin || tryGit(['remote', 'get-url', 'origin'], topLevel);
  if (!originUrl) {
    fail(`could not determine an origin URL — pass --origin=<url> (looked in ${topLevel})`);
  }
  const name = flags.name || basename(originUrl).replace(/\.git$/, '');
  // Default integration branch: the reference's origin/HEAD if known, else `main`.
  const head = tryGit(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], topLevel);
  const branch = flags.branch || (head ? head.replace(/^origin\//, '') : 'main');
  return { name, originUrl, referencePath: topLevel, branch, poolDir: join(POOL_ROOT, name) };
}

const laneDir = (repo, n) => join(repo.poolDir, `lane-${n}`);

// ── per-lane dev-server ports (#1997, per #1996 Fork 2) ──────────────────────────────────────────────
// A lane boots its own `npm run dev` on a deterministic per-index port pair, so N clones never collide.
// The formula is a PURE function of the lane index (no free-port scan, no registry — the pool index IS
// the allocator, #1996 Fork 2(a)): index N → BAND_BASE + 100 + N*10. The primary checkout keeps the band
// base (e.g. WE's 3000/8080 — the human's `npm start`). Config reads these via `.env.local` (vite.config
// reads `process.env`, the dev script reads `${WE_*_PORT:-default}`), with `strictPort` so a squatted
// port fails loud rather than silently binding the next one (which would desync the 11ty proxy target).
//
// Per-repo bands (#1996): WE `3000`/`8080`; plateau-app `4000`; FUI `6000`/`6080`. Only repos whose dev
// servers are env-driven need an entry here; a repo with no band writes no `.env.local` (harmless no-op).
const PORT_BANDS = {
  'web-everything': { WE_VITE_PORT: 3000, WE_ELEVENTY_PORT: 8080 },
  webeverything: { WE_VITE_PORT: 3000, WE_ELEVENTY_PORT: 8080 },
};
function laneEnvLocal(repo, n) {
  const band = PORT_BANDS[repo.name];
  if (!band) return null; // repo has no env-driven dev band → nothing to generate
  const body = Object.entries(band)
    .map(([key, base]) => `${key}=${base + 100 + n * 10}`)
    .join('\n');
  return (
    `# Generated by scripts/lane-pool.mjs (#1997) — deterministic per-lane dev-server ports.\n` +
    `# Lane ${n} of pool "${repo.name}"; regenerated on provision/refresh, do not edit by hand.\n` +
    body +
    '\n'
  );
}
// Write AFTER refreshLane's `git clean -fd` (which would otherwise remove this untracked file). `.env.local`
// is git-ignored so a lane never commits it.
function writeLaneEnv(repo, n) {
  const contents = laneEnvLocal(repo, n);
  if (contents === null) return;
  writeFileSync(join(laneDir(repo, n), '.env.local'), contents);
}

// Lanes currently on disk, sorted by index.
function existingLanes(repo) {
  if (!existsSync(repo.poolDir)) return [];
  return execFileSync('ls', ['-1', repo.poolDir], { encoding: 'utf8' })
    .split('\n')
    .map((d) => d.trim())
    .filter((d) => /^lane-\d+$/.test(d))
    .map((d) => Number(d.slice(5)))
    .sort((a, b) => a - b);
}

// ── deps (node_modules) — not shared by --reference, so installed per lane on fresh-clone / lockfile change ──
const DEPS_MARKER = (dir) => join(dir, '.git', '.lane-pool-deps'); // inside .git ⇒ never tracked or git-cleaned
function lockHash(dir) {
  const lock = join(dir, 'package-lock.json');
  const pkg = join(dir, 'package.json');
  const file = existsSync(lock) ? lock : existsSync(pkg) ? pkg : null;
  if (!file) return null;
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}
function depsReady(dir) {
  const want = lockHash(dir);
  if (want === null) return 'n/a'; // no package.json → nothing to install
  if (!existsSync(join(dir, 'node_modules'))) return 'missing';
  const have = existsSync(DEPS_MARKER(dir)) ? readFileSync(DEPS_MARKER(dir), 'utf8').trim() : null;
  return have === want ? 'ok' : 'stale';
}
function ensureDeps(dir) {
  const state = depsReady(dir);
  if (state === 'n/a' || state === 'ok') return state;
  const useCi = existsSync(join(dir, 'package-lock.json'));
  log(`  deps ${state} → npm ${useCi ? 'ci' : 'install'} in ${dir} …`);
  execFileSync('npm', [useCi ? 'ci' : 'install'], { cwd: dir, stdio: 'inherit' });
  writeFileSync(DEPS_MARKER(dir), lockHash(dir));
  return 'installed';
}

// ── core ops ──────────────────────────────────────────────────────────────────────────────────────
function cloneLane(repo, n) {
  const dest = laneDir(repo, n);
  log(`  clone lane-${n} ← ${repo.originUrl} (--reference ${repo.referencePath}) …`);
  gitQuiet(['clone', '--quiet', '--reference', repo.referencePath, repo.originUrl, dest]);
  // Pin a stable local default branch so refresh's hard-reset target is unambiguous.
  tryGit(['checkout', '--quiet', '-B', repo.branch, `origin/${repo.branch}`], dest);
}

function refreshLane(repo, n) {
  const dir = laneDir(repo, n);
  git(['fetch', 'origin', '--prune', '--quiet'], dir);
  git(['reset', '--hard', `origin/${repo.branch}`, '--quiet'], dir);
  git(['clean', '-fd', '--quiet'], dir); // remove untracked, KEEP ignored (node_modules) — no -x
}

function laneStatus(repo, n) {
  const dir = laneDir(repo, n);
  if (!existsSync(dir)) return { lane: n, path: dir, exists: false };
  const head = tryGit(['rev-parse', '--short', 'HEAD'], dir);
  const branch = tryGit(['rev-parse', '--abbrev-ref', 'HEAD'], dir);
  const porcelain = tryGit(['status', '--porcelain'], dir);
  const behind = tryGit(['rev-list', '--count', `HEAD..origin/${repo.branch}`], dir);
  return {
    lane: n,
    path: dir,
    exists: true,
    head,
    branch,
    clean: porcelain === '',
    behind: behind === null ? '?' : Number(behind),
    deps: depsReady(dir),
  };
}

// ── output ──────────────────────────────────────────────────────────────────────────────────────────
const log = (m) => process.stderr.write(m + '\n');
function fail(m) {
  process.stderr.write(`✗ ${m}\n`);
  process.exit(1);
}

// ── commands ──────────────────────────────────────────────────────────────────────────────────────
function cmdProvision(repo) {
  const count = Number(flags.count);
  if (!Number.isInteger(count) || count < 1) fail('provision needs --count=<positive integer>');
  mkdirSync(repo.poolDir, { recursive: true });
  log(`provisioning ${count} lane(s) for "${repo.name}" under ${repo.poolDir} (branch ${repo.branch})`);
  for (let n = 1; n <= count; n++) {
    if (!existsSync(laneDir(repo, n))) cloneLane(repo, n);
    else log(`  lane-${n} exists`);
    refreshLane(repo, n);
    writeLaneEnv(repo, n);
    if (!flags['no-install']) ensureDeps(laneDir(repo, n));
  }
  printStatus(repo);
}

function cmdRefresh(repo) {
  const lanes = existingLanes(repo);
  if (lanes.length === 0) fail(`no lanes to refresh under ${repo.poolDir} (run provision first)`);
  log(`refreshing ${lanes.length} lane(s) for "${repo.name}" → origin/${repo.branch}`);
  for (const n of lanes) {
    refreshLane(repo, n);
    writeLaneEnv(repo, n);
    if (!flags['no-install']) ensureDeps(laneDir(repo, n));
  }
  printStatus(repo);
}

function printStatus(repo) {
  const rows = existingLanes(repo).map((n) => laneStatus(repo, n));
  if (flags.json) {
    process.stdout.write(JSON.stringify({ repo: repo.name, root: repo.poolDir, lanes: rows }, null, 2) + '\n');
    return;
  }
  if (rows.length === 0) {
    log(`(no lanes provisioned for "${repo.name}" under ${repo.poolDir})`);
    return;
  }
  log(`pool "${repo.name}" @ ${repo.poolDir} (integration branch: origin/${repo.branch})`);
  for (const r of rows) {
    log(
      `  lane-${r.lane}: ${r.head} [${r.branch}] ${r.clean ? 'clean' : 'DIRTY'}` +
        ` · ${r.behind === 0 ? 'up-to-date' : `${r.behind} behind`} · deps ${r.deps}`,
    );
  }
}

function cmdList(repo) {
  const paths = existingLanes(repo).map((n) => laneDir(repo, n));
  if (flags.json) process.stdout.write(JSON.stringify(paths, null, 2) + '\n');
  else paths.forEach((p) => process.stdout.write(p + '\n'));
}

function cmdPath(repo) {
  const n = Number(flags.lane);
  if (!Number.isInteger(n) || n < 1) fail('path needs --lane=<positive integer>');
  const dir = laneDir(repo, n);
  if (!existsSync(dir)) fail(`lane-${n} does not exist (${dir})`);
  process.stdout.write(dir + '\n');
}

function cmdRemove(repo) {
  let targets;
  if (flags.all) targets = existingLanes(repo);
  else if (flags.lane !== undefined) targets = [Number(flags.lane)];
  else return fail('remove needs --lane=N or --all');
  for (const n of targets) {
    const dir = laneDir(repo, n);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      log(`removed lane-${n} (${dir})`);
    }
  }
}

// ── dispatch ──────────────────────────────────────────────────────────────────────────────────────
const COMMANDS = {
  provision: cmdProvision,
  refresh: cmdRefresh,
  status: printStatus,
  list: cmdList,
  path: cmdPath,
  remove: cmdRemove,
};

if (!cmd || cmd === 'help' || cmd === '--help' || !COMMANDS[cmd]) {
  if (cmd && cmd !== 'help' && cmd !== '--help') process.stderr.write(`unknown command: ${cmd}\n`);
  process.stderr.write(
    'usage: lane-pool.mjs <provision|refresh|status|list|path|remove> [--count=N] [--lane=N] [--all] ' +
      '[--repo=<path>] [--origin=<url>] [--reference=<path>] [--name=<slug>] [--branch=<ref>] [--no-install] [--json]\n',
  );
  process.exit(cmd && COMMANDS[cmd] === undefined && cmd !== 'help' ? 1 : 0);
}

COMMANDS[cmd](resolveRepo());
