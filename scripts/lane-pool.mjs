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
 *   node scripts/lane-pool.mjs provision --count=N [--acquirable] [--no-install] [--force]   # ensure N lanes exist (clone missing) + refresh all + ensure deps + ensure the WE pool's FUI render-sibling (#2166); --acquirable grows PAST foreign-leased lanes so N ACQUIRABLE ones result (#2426)
 *   node scripts/lane-pool.mjs refresh           [--no-install] [--force]     # fetch + hard-reset existing lanes to origin/main (no creation)
 *   node scripts/lane-pool.mjs status  [--json]                     # per-lane: path / head / clean / behind origin/main / deps / lease
 *   node scripts/lane-pool.mjs list    [--json] [--acquirable]      # existing lane paths (for the orchestrator to dispatch into); --acquirable filters out foreign-leased / busy lanes (#2426)
 *   node scripts/lane-pool.mjs path    --lane=N                     # print one lane's absolute path
 *   node scripts/lane-pool.mjs acquire [--purpose=<slug>] [--session=<slug>] [--lane=N] [--ttl-minutes=N] [--no-reset] [--base=<ref>] [--scope=<repo:path,...>] [--json]  # #2275 lease a free lane (exclusive) + reset to origin/main (or, with #2386 --base=<ref>, to a predecessor lane's pushed tip); stdout = its path. #2413: --purpose=workflow-lane MARKS the lease (workflowLane:true) → the guard requires a sibling to assert its minted slug before a destructive op. #2560: --scope=<repo:path,...> declares this lane's ADVISORY predicted file-scope — persisted into the marker (the live scope-lease collector reads it) + warns on overlap, but NEVER gates the acquire (the whole-clone lease is the real lock).
 *   node scripts/lane-pool.mjs release (--lane=N | --all) [--session=<slug>] [--force]   # #2275 hand a leased lane back to the pool (own lease, or --force)
 *   node scripts/lane-pool.mjs remove  (--lane=N | --all)           # tear down lane(s)
 *   node scripts/lane-pool.mjs map     --lane=N --item=NNN[,NNN…]   # register item(s) → lane page-port (#2139 proxy)
 *   node scripts/lane-pool.mjs unmap   (--item=NNN[,…] | --lane=N | --all)   # drop lane-ports registry entries
 *
 * Repo / pool overrides (apply to any command):
 *   --repo=<path>        a checkout to derive the lane repo from (default: the cwd's git toplevel)
 *   --origin=<url>       clone source (default: that checkout's `origin` remote URL)
 *   --reference=<path>   object-sharing reference repo for `git clone --reference` (default: --repo path)
 *   --name=<slug>        pool key under the root (default: derived from the origin URL basename)
 *   --branch=<ref>       integration branch (default: detected origin/HEAD, else `main`)
 *   env LANE_POOL_ROOT   pool root (default: ~/workspace/.lanes)
 *
 * SAFETY (#2267): a lane is safe scratch ONLY for work that is clean-and-up-to-date, or that this guard
 * has skipped. `refresh`/`provision` never silently discard a lane that is DIRTY (uncommitted edits) or
 * AHEAD of origin/<branch> (locally-committed-but-unpushed commits) — such a lane is SKIPPED (left
 * untouched) and reported, because `reset --hard` + `clean -fd` would otherwise destroy that work with no
 * recovery. Pass --force to restore the old unconditional reset-everything behavior for a dirty/ahead lane.
 * The only state a lane can rely on surviving a concurrent refresh/provision is what has ALREADY been
 * pushed to origin (i.e. landed via `pr-land` onto its `lane/*` ref, per #1934) — treat anything else as
 * ephemeral and push early.
 *
 * SAFETY (#2275/#2337): a LIVE lease (an exclusive hold stamped by `acquire`, presumed alive within TTL) is
 * a STRONGER guard than dirty/ahead — it protects an active consumer, not just tree residue. `--force`
 * overrides the dirty/ahead staleness guard but NEVER a live lease: `refresh --force` / `provision --force`
 * SKIP a live-leased lane with a loud log (never reset it); `acquire --lane=N --force` on a live-leased lane
 * HARD-FAILS, pointing at the deliberate override — `release --force` (drop the lease), then re-acquire. No
 * separate `--force-lease` flag exists; `release --force` is the one escape hatch for a live lease.
 */
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync, lstatSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir, hostname } from 'node:os';
import { join, basename, resolve, dirname } from 'node:path';
import {
  LEASE_FILENAME,
  DEFAULT_LEASE_TTL_MINUTES,
  WORKFLOW_LANE_PURPOSE,
  isLeaseStale,
  isLaneAcquirable,
  chooseFreeLane,
  leaseBody,
  describeLease,
  leaseOwnedBy,
} from './lib/lane-lease.mjs';
// #2560 — lane-pool may freely import readiness (confirmed no circular import): the advisory scope-lease check
// at acquire. normScope normalizes the declared `--scope`; candidateLaunch is the pure overlap-at-launch query.
import { normScope } from './readiness/scope-lease.mjs';
import { candidateLaunch } from './readiness/scope-lease-live.mjs';

// #2560 — `--scope=a,b,c` → a normalized, repo-qualified array (empty when the flag is absent/blank).
const parseScopeFlag = (v) => (typeof v === 'string' && v ? normScope(v.split(',')) : []);

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

// ── constellation sibling clones for the WE pool (#2166 → #2282 → #2349) ─────────────────────────────
// Every WE grid page SSRs through the pinned FUI build-artifact, resolved by
// `scripts/lib/component-render-build-hook.cjs` at the FIXED relative path `../frontierui/dist/tools/
// component-render/cli.mjs` — i.e. a `frontierui` checkout SIBLING of the WE repo root. In the primary
// checkout that sibling is `~/workspace/frontierui`; but a lane clone lives at `<poolDir>/lane-N`, whose
// parent (`<poolDir>`) has no `frontierui` — so `build:docs` / `eleventy --serve` / any rendered
// verification HARD-FAILS in a solo/interactive WE lane ("pinned FUI artifact missing"). The #1943
// orchestrator only provisions per-repo pools for items whose *impl* spans FUI; this render dependency is
// UNCONDITIONAL (independent of whether the edited item touches FUI), so it can't be gated behind that
// affected-repo detection — the pool itself must carry the sibling. A plain `plateau-app` sibling similarly
// un-breaks a lane's Vite dev-panel import (`vite.config.mts` → `../plateau-app/…`).
//
// Original fix (#2166): a SYMLINK at `<poolDir>/frontierui` to the primary checkout's real `frontierui`
// sibling. Ratified in #2282 (docs/agent/platform-decisions.md#pool-siblings-real-built-clones) and
// generalized here (#2349): the pool-root sibling is now a REAL, PUSHABLE git clone, not a symlink — one
// clone per sibling repo serves BOTH consumers at the same `../<name>` path a lane resolves — WE-lane
// render reads its BUILT `dist/`, and the drain's cross-repo rebase-drop (`merge-ai-prs.mjs`
// `siblingCloneDir`, unchanged — it already resolves `../<name>`) fetches/pushes its `origin`. Safe to
// share: rebase-drop is pure git plumbing (merge-tree → commit-tree → push, no checkout), so it only
// mutates git objects/refs — disjoint from render's `dist/` reads. The symlink's one lost behavior: render
// no longer reflects the primary checkout's uncommitted FUI WIP, only its committed `main` — freshness
// ownership moves to this provisioner, which rebuilds `dist/` (via the sibling's own `build:tools`, where
// it has one — frontierui does, plateau-app doesn't) on every provision/refresh.
//
// Idempotent: a clean, up-to-date clone is fetched + fast-forwarded + rebuilt (cheap — ~1.2s for FUI); a
// missing clone is created (`--reference` the primary sibling for fast local object-sharing, same pattern
// as `cloneLane`); a legacy pre-#2282 symlink is replaced with a real clone; a DIRTY or AHEAD clone (like a
// lane, #2267) is left untouched rather than reset-away, since it is now real, pushable, mutable state.
// Only the WE pool (identified by a PORT_BANDS entry — the same signal that marks the env-driven dev band)
// provisions siblings; other pools no-op. If the primary sibling is absent (no local checkout to derive an
// origin URL from) we WARN (not fail) — the pool is still usable for non-render work.
const SIBLING_REPO_NAMES = ['frontierui', 'plateau-app'];

function primarySiblingPath(repo, name) {
  // A sibling repo is the sibling of the PRIMARY WE checkout (the pool's reference repo), e.g.
  // ~/workspace/webeverything → ~/workspace/frontierui / ~/workspace/plateau-app.
  return join(dirname(repo.referencePath), name);
}

function siblingHasBuildTools(dir) {
  try {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    return !!(pkg && pkg.scripts && pkg.scripts['build:tools']);
  } catch {
    return false;
  }
}

function buildSibling(dir, name) {
  if (!siblingHasBuildTools(dir)) return; // e.g. plateau-app — a plain clone is enough (#2282)
  // A sibling with a `build:tools` needs its OWN `node_modules` first: the clone is `--reference`d
  // (shared git objects, NOT node_modules) and FUI's build-tools.mjs statically `import esbuild` + runs
  // `npx tsc`, so on a fresh clone it throws ERR_MODULE_NOT_FOUND before it can emit `dist/`. Install deps
  // exactly as WE lanes do (idempotent via the .git deps marker → no reinstall on a warm refresh, #2349).
  try {
    ensureDeps(dir);
  } catch (e) {
    log(`  ⚠ ${name} sibling deps install failed — build:tools will likely fail too (${e.message})`);
  }
  log(`  building ${name} sibling (npm run build:tools) …`);
  try {
    execFileSync('npm', ['run', 'build:tools'], { cwd: dir, stdio: 'inherit' });
  } catch (e) {
    log(`  ⚠ ${name} sibling build:tools failed — WE-lane render may see a stale/missing dist/ (${e.message})`);
  }
}

function ensureOneSibling(repo, name, { force = false } = {}) {
  const dest = join(repo.poolDir, name);
  const primary = primarySiblingPath(repo, name);

  // Replace a pre-#2282 render-only symlink (or any other symlink) with a real clone.
  let existing = null;
  try {
    existing = lstatSync(dest);
  } catch {
    existing = null;
  }
  if (existing && existing.isSymbolicLink()) {
    rmSync(dest, { force: true });
    existing = null;
    log(`  replacing legacy ${dest} symlink with a real pushable clone (#2282)`);
  }

  if (existing && !existsSync(join(dest, '.git'))) {
    // A real dir/file squats the sibling path that isn't a git repo — don't clobber it.
    log(`  ⚠ ${dest} exists and is not a git clone — leaving it; ${name} sibling not (re)provisioned.`);
    return;
  }

  if (!existing) {
    const originUrl = existsSync(primary) ? tryGit(['remote', 'get-url', 'origin'], primary) : null;
    if (!originUrl) {
      log(
        `  ⚠ ${name} sibling source ${primary} not found/has no origin — WE lane build:docs/dev-serve or ` +
          `the drain's cross-repo rebase-drop will skip ${name} until it is present.`,
      );
      return;
    }
    log(`  clone ${name} sibling ← ${originUrl} (--reference ${primary}) …`);
    try {
      gitQuiet(['clone', '--quiet', '--reference', primary, originUrl, dest]);
    } catch (e) {
      // Unlike the old symlink (pure filesystem, no network), this is a real `git clone` of `originUrl` —
      // best-effort: a network blip / auth failure / moved remote must WARN and move on, not crash the
      // whole provision/refresh (which would otherwise abort AFTER every WE lane already succeeded, #2349).
      log(`  ⚠ ${name} sibling clone failed — WE lane build:docs/dev-serve or the drain's cross-repo ` + `rebase-drop will skip ${name} until it is provisioned (${e.message})`);
      rmSync(dest, { recursive: true, force: true }); // don't leave a partial/broken clone behind
      return;
    }
  }

  const branchRef = tryGit(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], dest);
  const branch = branchRef ? branchRef.replace(/^origin\//, '') : 'main';
  tryGit(['fetch', 'origin', '--prune', '--quiet'], dest);

  if (!force) {
    // #2267-style data-loss guard, now load-bearing here too: this clone is real & pushable (unlike the
    // #2166 symlink it replaces), so an unconditional reset/clean could destroy in-flight local state.
    const { dirty, ahead } = laneDirtyOrAhead(dest, branch);
    if (dirty || ahead > 0) {
      log(`  ${name} sibling: SKIPPED reset (dirty/ahead) — use --force to override; skipping rebuild too`);
      return;
    }
  }

  tryGit(['checkout', '--quiet', '-B', branch, `origin/${branch}`], dest);
  tryGit(['reset', '--hard', `origin/${branch}`, '--quiet'], dest);
  tryGit(['clean', '-fd', '--quiet'], dest);
  buildSibling(dest, name);
}

function ensureRepoSiblings(repo, opts = {}) {
  if (!PORT_BANDS[repo.name]) return; // not the WE pool → no unconditional sibling dependency
  for (const name of SIBLING_REPO_NAMES) ensureOneSibling(repo, name, opts);
}

// ── lane-ports registry (#2139) — item → lane page-port mapping for the main-checkout proxy ─────────
// The primary checkout's Vite server (vite.config.mts `lanePageProxy`) keeps `:3000` the single review
// URL by forwarding a lane-claimed item's `/backlog/<NNN>…/` page to the owning lane's dev server. The
// mapping lives in `.claude/lane-ports.json` in the PRIMARY checkout (the pool's reference repo): the
// dispatcher `map`s an item when it assigns it to a lane, and entries are cleared on `unmap`, lane
// `remove`, and `refresh` (a reset lane no longer renders the item). Only pools with a PORT_BANDS entry
// have page ports; `map` on a band-less pool fails loud.
const registryPath = (repo) => join(repo.referencePath, '.claude', 'lane-ports.json');
function lanePagePort(repo, n) {
  const band = PORT_BANDS[repo.name];
  if (!band) return null;
  const [, base] = Object.entries(band)[0]; // first band key is the repo's front-door (Vite) port
  return base + 100 + n * 10;
}
function readPortRegistry(repo) {
  const file = registryPath(repo);
  if (!existsSync(file)) return {};
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function writePortRegistry(repo, entries) {
  const file = registryPath(repo);
  mkdirSync(join(repo.referencePath, '.claude'), { recursive: true });
  writeFileSync(file, JSON.stringify(entries, null, 2) + '\n');
}
function unmapLanes(repo, lanes) {
  const entries = readPortRegistry(repo);
  const dropped = Object.keys(entries).filter((num) => lanes.includes(entries[num].lane));
  if (dropped.length === 0) return;
  for (const num of dropped) delete entries[num];
  writePortRegistry(repo, entries);
  log(`  unmapped item(s) ${dropped.join(', ')} (lane ${lanes.join(', ')}) from ${registryPath(repo)}`);
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

// ── lease (#2275) — an exclusive hold so a lane is never recycled or double-acquired while in use ─────
// The marker lives INSIDE `.git` (like DEPS_MARKER) so it is never tracked, never `git clean`-ed, and
// never seen by `git status --porcelain` (so it doesn't itself make a lane look dirty). A held lane is
// off-limits to `refresh`/`provision`'s `reset --hard` AND to another session's `acquire`, until `release`
// (or TTL-reclaim). See scripts/lib/lane-lease.mjs for the pure decision logic.
const LEASE_MARKER = (dir) => join(dir, '.git', LEASE_FILENAME);
function readLease(dir) {
  const file = LEASE_MARKER(dir);
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null; // a corrupt marker is treated as no live lease (isLeaseStale also fails-open)
  }
}
const ttlMinutesFromFlags = () =>
  flags['ttl-minutes'] !== undefined && Number.isFinite(Number(flags['ttl-minutes']))
    ? Number(flags['ttl-minutes'])
    : DEFAULT_LEASE_TTL_MINUTES;
const ttlMsFromFlags = () => ttlMinutesFromFlags() * 60_000;
// A lane holds a LIVE lease when a marker exists and hasn't outlived its TTL (owner presumed alive).
function liveLease(dir, nowMs, ttlMs) {
  const lease = readLease(dir);
  return lease && !isLeaseStale(lease, nowMs, ttlMs) ? lease : null;
}
// Session identity must be STABLE across a consumer's separate `acquire` then `release` invocations, yet
// DISTINCT between concurrent sessions on one host (the whole point — session B must not release session A's
// lane). A per-process pid is unstable (each CLI call is a new pid); a bare hostname collides across
// sessions. So: an explicit `--session` (what every flow should pass) wins; else `LANE_SESSION` env; else
// the parent shell's pid (`ppid` — the same shell drives a flow's acquire+release, and differs per session).
const defaultSession = () => flags.session || process.env.LANE_SESSION || `${hostname()}:${process.ppid}`;

// ── core ops ──────────────────────────────────────────────────────────────────────────────────────
function cloneLane(repo, n) {
  const dest = laneDir(repo, n);
  log(`  clone lane-${n} ← ${repo.originUrl} (--reference ${repo.referencePath}) …`);
  gitQuiet(['clone', '--quiet', '--reference', repo.referencePath, repo.originUrl, dest]);
  // Pin a stable local default branch so refresh's hard-reset target is unambiguous.
  tryGit(['checkout', '--quiet', '-B', repo.branch, `origin/${repo.branch}`], dest);
}

// Dirty-or-ahead guard (#2267 — data-loss guard): a lane's ONLY durable state is what has already been
// PUSHED to origin (i.e. landed via pr-land); anything else (uncommitted edits, or commits made locally
// but not yet pushed to its `lane/*` ref) lives nowhere else and is destroyed by `reset --hard` + `clean
// -fd`. Compute this AFTER the fetch (so "ahead" reflects the latest origin/<branch>) but BEFORE any
// destructive git call.
function laneDirtyOrAhead(dir, branch) {
  const porcelain = tryGit(['status', '--porcelain'], dir);
  const uncommitted = porcelain ? porcelain.split('\n').filter(Boolean).length : 0;
  const aheadRaw = tryGit(['rev-list', '--count', `origin/${branch}..HEAD`], dir);
  const ahead = aheadRaw === null ? 0 : Number(aheadRaw);
  return { dirty: uncommitted > 0, uncommitted, ahead };
}

// Returns { skipped: boolean, dirty, uncommitted, ahead } so callers can tell an actually-reset lane
// (safe to unmap its stale item mapping, #2139) from a skipped one (still serving its in-flight item).
function refreshLane(repo, n, { force = false } = {}) {
  const dir = laneDir(repo, n);
  git(['fetch', 'origin', '--prune', '--quiet'], dir);
  // #2337(b) — a LIVE lease is an ownership hold (a process is presumed alive within TTL), distinct from the
  // dirty/ahead STALENESS guard below. `--force` exists to recycle stale residue, not to stomp an active
  // consumer, so the lease check runs REGARDLESS of `--force`: a leased lane is always skipped (loud), never
  // reset. The deliberate override is `release --force` (drop the lease), not this flag.
  const lease = liveLease(dir, Date.now(), ttlMsFromFlags());
  if (lease) {
    log(`  lane-${n}: SKIPPED (${describeLease(lease)}) — LIVE lease; --force does not override it (#2337); use \`release --lane=${n} --force\` first`);
    return { skipped: true, leased: true, dirty: false, uncommitted: 0, ahead: 0 };
  }
  if (!force) {
    // #2267 — dirty/ahead is a property of the TREE (possibly abandoned residue from a dead session), which
    // `--force` exists to recycle. Skippable by `--force`, unlike the lease check above.
    const { dirty, uncommitted, ahead } = laneDirtyOrAhead(dir, repo.branch);
    if (dirty || ahead > 0) {
      log(`  lane-${n}: SKIPPED (dirty/ahead — ${uncommitted} uncommitted, ${ahead} ahead) — use --force to override`);
      return { skipped: true, dirty, uncommitted, ahead };
    }
  }
  git(['reset', '--hard', `origin/${repo.branch}`, '--quiet'], dir);
  git(['clean', '-fd', '--quiet'], dir); // remove untracked, KEEP ignored (node_modules) — no -x
  return { skipped: false, dirty: false, uncommitted: 0, ahead: 0 };
}

function laneStatus(repo, n) {
  const dir = laneDir(repo, n);
  if (!existsSync(dir)) return { lane: n, path: dir, exists: false };
  const head = tryGit(['rev-parse', '--short', 'HEAD'], dir);
  const branch = tryGit(['rev-parse', '--abbrev-ref', 'HEAD'], dir);
  const porcelain = tryGit(['status', '--porcelain'], dir);
  const behind = tryGit(['rev-list', '--count', `HEAD..origin/${repo.branch}`], dir);
  const lease = readLease(dir);
  return {
    lane: n,
    path: dir,
    exists: true,
    head,
    branch,
    clean: porcelain === '',
    behind: behind === null ? '?' : Number(behind),
    deps: depsReady(dir),
    // #2275 — surface the hold so a picker can filter (and a human sees who owns a lane). `leased` is only
    // true for a LIVE lease; a stale marker reads as free (reclaimable), matching acquire's own logic.
    lease: lease || null,
    leased: lease ? !isLeaseStale(lease, Date.now(), ttlMsFromFlags()) : false,
  };
}

// #2426 — the lease/dirty snapshot a lease-aware picker (`list --acquirable`, `provision --acquirable`) needs to
// decide whether a lane is safe to couple an item onto. Shape matches `isLaneAcquirable(info, now, ttl)` in
// lane-lease.mjs: `exists`, the raw `lease` marker, and `dirtyOrAhead` (someone's un-pushed work). It reads the
// LOCAL `origin/<branch>` ref (no fetch — a cheap snapshot; a stale-looking "ahead" only fails safe by skipping).
function laneAcquirableInfo(repo, n) {
  const dir = laneDir(repo, n);
  if (!existsSync(dir)) return { lane: n, exists: false };
  return { lane: n, exists: true, lease: readLease(dir), dirtyOrAhead: laneDirtyOrAhead(dir, repo.branch) };
}

// ── output ──────────────────────────────────────────────────────────────────────────────────────────
const log = (m) => process.stderr.write(m + '\n');
function fail(m) {
  process.stderr.write(`✗ ${m}\n`);
  process.exit(1);
}

// ── commands ──────────────────────────────────────────────────────────────────────────────────────
// Provision one lane (clone if missing, refresh, write env, ensure deps). Returns refreshLane's result so the
// caller can tell an actually-reset lane (safe to unmap its stale item mapping) from a skipped/leased one.
function provisionLane(repo, n, force) {
  if (!existsSync(laneDir(repo, n))) cloneLane(repo, n);
  else log(`  lane-${n} exists`);
  const result = refreshLane(repo, n, { force });
  writeLaneEnv(repo, n);
  if (!flags['no-install']) ensureDeps(laneDir(repo, n));
  return result;
}

// #2426 — headroom past --count when growing to N ACQUIRABLE lanes, so a run with many foreign-leased lanes can
// still cover N usable ones without cloning unboundedly (a corrupt lease that never reads acquirable would loop).
const ACQUIRABLE_PROVISION_HEADROOM = 32;

function cmdProvision(repo) {
  const count = Number(flags.count);
  if (!Number.isInteger(count) || count < 1) fail('provision needs --count=<positive integer>');
  mkdirSync(repo.poolDir, { recursive: true });
  const force = !!flags.force;
  const resetLanes = []; // only lanes actually reset lose their stale mapping — a skipped lane still serves it

  // #2426 — `--acquirable` provisions until `count` lanes are ACQUIRABLE (not foreign-leased / busy), growing the
  // pool PAST held lanes rather than stopping at lane-<count>. This is what lets the parallel /workflow couple N
  // items to N usable lanes even when a sibling session holds some of the low-index ones: without it, provision
  // clones lane-1..N, a leased lane among them is skipped (correctly, never clobbered) but still occupies a
  // coupling slot, so its item is carried with zero work.
  if (flags.acquirable) {
    const nowMs = Date.now();
    const ttlMs = ttlMsFromFlags();
    const cap = count + ACQUIRABLE_PROVISION_HEADROOM;
    log(`provisioning up to ${count} ACQUIRABLE lane(s) for "${repo.name}" under ${repo.poolDir} (branch ${repo.branch}; cap lane-${cap})`);
    let acquirable = 0;
    let n = 0;
    while (acquirable < count && n < cap) {
      n++;
      const result = provisionLane(repo, n, force);
      if (!result.skipped) resetLanes.push(n);
      if (isLaneAcquirable(laneAcquirableInfo(repo, n), nowMs, ttlMs)) acquirable++;
    }
    if (acquirable < count) {
      log(`⚠ only ${acquirable}/${count} lane(s) acquirable after provisioning through lane-${n} (rest hold a foreign lease / un-pushed work) — the orchestrator will log the contention and carry the overflow, never double up a lane.`);
    } else {
      log(`ensured ${count} acquirable lane(s) (provisioned through lane-${n}; skipped foreign-leased/busy lanes)`);
    }
  } else {
    log(`provisioning ${count} lane(s) for "${repo.name}" under ${repo.poolDir} (branch ${repo.branch})`);
    for (let n = 1; n <= count; n++) {
      const result = provisionLane(repo, n, force);
      if (!result.skipped) resetLanes.push(n);
    }
  }
  unmapLanes(repo, resetLanes); // refreshed lanes lose stale mappings (#2139); skipped lanes keep theirs
  ensureRepoSiblings(repo, { force }); // pushable+built constellation siblings at the pool root (#2166/#2282/#2349)
  printStatus(repo);
}

function cmdRefresh(repo) {
  const lanes = existingLanes(repo);
  if (lanes.length === 0) fail(`no lanes to refresh under ${repo.poolDir} (run provision first)`);
  log(`refreshing ${lanes.length} lane(s) for "${repo.name}" → origin/${repo.branch}`);
  const force = !!flags.force;
  const resetLanes = []; // only lanes actually reset lose their stale mapping — a skipped lane still serves it
  for (const n of lanes) {
    const result = refreshLane(repo, n, { force });
    if (!result.skipped) resetLanes.push(n);
    writeLaneEnv(repo, n);
    if (!flags['no-install']) ensureDeps(laneDir(repo, n));
  }
  unmapLanes(repo, resetLanes); // a reset lane no longer renders its old item (#2139); a skipped one still does
  ensureRepoSiblings(repo, { force }); // keep the WE pool's constellation siblings current on refresh too
  printStatus(repo);
}

// ── acquire / release (#2275) — the exclusive-lease allocator any flow consumes ─────────────────────
// A consumer (`/drain`, `/merge`, `/batch`, solo `#2123`, `/prepare`, `/decision`) does:
//   export LANE_SESSION=<slug>                                                  # ties acquire↔release together
//   LANE=$(node scripts/lane-pool.mjs acquire --purpose=drain) && cd "$LANE"    # leased, reset to origin/main
//   …work, land its PR…
//   node scripts/lane-pool.mjs release --lane=<n>                              # hand it back to the pool
// The lease is what lets a use-agnostic pool lane safely stand in for the hand-rolled `../we-drain-clean`
// clone: held ⇒ refresh/provision won't reset it out from under the drain (item 2's "a lane may sit on main"
// is just the reset-to-origin/main state below, now protected by the hold).

// Try to claim a specific lane's marker atomically (O_EXCL). Returns true iff THIS call created the marker.
// A live lease owned by someone else ⇒ false (taken — #2337(b), NOT overridable by `--force`; the deliberate
// override is `release --force` then re-acquire, per the ruling's "no new flag" contract). A stale marker ⇒
// reclaimed (rm + retry, the small documented race). Own live lease ⇒ true (idempotent re-acquire).
function tryClaimLane(dir, session, nowMs, ttlMs) {
  // #2367 — stamp a DURABLE session identity (`CLAUDE_CODE_SESSION_ID`, exposed to this subprocess) so a later
  // guard can tell "my own lease" from another live session's AUTHORITATIVELY — it is stable across a session's
  // separate Bash-tool calls yet distinct between concurrent sessions, and does NOT false-match two independent
  // sessions that merely share an upper process ancestor (terminal / a parallel-lane orchestrator). This is the
  // SOLE ownership signal (r2 removed the pid-ancestry fallback, whose chain overlap over-matched exactly that
  // shared-ancestor topology and so failed open while looking protective — see `isForeignLease`, lane-lease.mjs).
  // `pid` stays as an informational-only field (human-readable `status`/debug), never used for ownership.
  const body = JSON.stringify(
    leaseBody({
      session, purpose: flags.purpose, acquiredAt: new Date(nowMs).toISOString(), ttlMinutes: ttlMinutesFromFlags(),
      host: hostname(), pid: process.pid,
      ownerSession: process.env.CLAUDE_CODE_SESSION_ID || null,
      // #2413 — `--purpose=workflow-lane` MARKS the lease: it stamps the dedicated `workflowLane: true` field
      // (not free-text purpose) that switches the destructive-op guard fail-closed for this lane, requiring a
      // sibling parallel lane to assert this lease's own minted `session` slug before it can clobber the clone.
      workflowLane: flags.purpose === WORKFLOW_LANE_PURPOSE,
      // #2560 — persist the ADVISORY predicted file-scope declared via `acquire --scope=` (omitted when empty,
      // so a scope-less acquire's marker is unchanged). This is the real predicted-scope source the live
      // scope-lease collector/observer reads; it NEVER gates the claim (the O_EXCL marker below is the lock).
      predictedScope: parseScopeFlag(flags.scope),
    }),
    null, 2,
  ) + '\n';
  const file = LEASE_MARKER(dir);
  try {
    writeFileSync(file, body, { flag: 'wx' }); // atomic create-or-fail — the race-free happy path
    return true;
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  const existing = readLease(dir);
  if (leaseOwnedBy(existing, session)) { writeFileSync(file, body); return true; } // refresh our own hold
  if (isLeaseStale(existing, nowMs, ttlMs)) {
    rmSync(file, { force: true });                 // reclaim a stale lease (unlink→create race: acceptable)
    try { writeFileSync(file, body, { flag: 'wx' }); return true; } catch { return false; }
  }
  return false; // a LIVE lease held by another session — this lane is taken, even with --force
}

function cmdAcquire(repo) {
  // #2386 — `--base` and `--no-reset` are mutually exclusive: `--base=<ref>` means "reset this clone to <ref>",
  // and `--no-reset` skips the reset entirely. Honoring both would skip the reset yet still report the base as
  // applied (log line + JSON `base`), so an orchestrator stacking a serial batch would believe the lane sits on
  // the predecessor tip when HEAD was never moved. Reject the combo BEFORE claiming any lane (touches nothing) —
  // failing loud beats silently misreporting for a primitive other automation trusts.
  if (flags.base && flags['no-reset']) {
    fail(`--base=${flags.base} and --no-reset are mutually exclusive: --base resets the clone to that ref, which --no-reset would skip. Pass one or the other.`);
  }
  const session = defaultSession();
  const nowMs = Date.now();
  const ttlMs = ttlMsFromFlags();
  // #2560 — the ADVISORY predicted file-scope this acquire declares (empty when no `--scope`). Persisted into the
  // marker (via tryClaimLane) AND used for the strictly-non-blocking overlap warning below. It NEVER gates.
  const declaredScope = parseScopeFlag(flags.scope);
  const lanes = existingLanes(repo);
  if (lanes.length === 0) fail(`no lanes provisioned for "${repo.name}" — run \`provision --count=N\` first`);

  // Candidate infos from LOCAL refs (no per-lane fetch): `dirty` is live (working tree), `ahead` is vs the
  // last-known origin — conservative (over-protects an ahead lane). We fetch+reset only the winner.
  const infoFor = (n) => {
    const dir = laneDir(repo, n);
    if (!existsSync(dir)) return { lane: n, exists: false };
    return { lane: n, exists: true, dirtyOrAhead: laneDirtyOrAhead(dir, repo.branch), lease: readLease(dir) };
  };

  let chosen = null;
  if (flags.lane !== undefined) {
    // Explicit lane: honor it or fail loudly (don't silently divert to another).
    const n = Number(flags.lane);
    const dir = laneDir(repo, n);
    if (!existsSync(dir)) fail(`lane-${n} does not exist (${dir})`);
    if (!tryClaimLane(dir, session, nowMs, ttlMs)) {
      const lease = readLease(dir);
      // #2337(b) — a LIVE lease hard-fails `acquire --lane=N --force` too (force never overrides a live
      // lease); point at the deliberate override (`release --force`) instead of implying --force helps.
      if (lease && !isLeaseStale(lease, nowMs, ttlMs)) {
        fail(
          `lane-${n} is ${describeLease(lease)} — a LIVE lease; --force does not override it (#2337). ` +
            `Release it first (\`release --lane=${n} --force\`), then acquire, or pick another lane.`,
        );
      }
      fail(`lane-${n} is ${describeLease(lease) || 'held'} — pick another lane`);
    }
    chosen = n;
  } else {
    // Auto-pick: lowest acquirable, then atomically claim; on a lost race retry the next candidate.
    const excluded = new Set();
    while (chosen === null) {
      const infos = lanes.filter((n) => !excluded.has(n)).map(infoFor);
      const pick = chooseFreeLane(infos, nowMs, ttlMs);
      if (pick === null) fail(`no free lane in pool "${repo.name}" (${lanes.length} all held/dirty) — release one or \`provision\` more`);
      if (tryClaimLane(laneDir(repo, pick), session, nowMs, ttlMs)) chosen = pick;
      else excluded.add(pick); // a concurrent acquire won this one — try the next
    }
  }

  // #2560 (§3i-A4 Fork 1) — ADVISORY, STRICTLY NON-BLOCKING scope-overlap check. Runs AFTER the atomic O_EXCL
  // claim above (the whole-clone lease is the REAL lock): this only WARNS to stderr if the declared scope
  // overlaps a sibling lane's predicted scope. It does NOT gate, block, delay, or change which lane won — the
  // lane is already claimed. Wrapped so a scope-check failure can NEVER throw into the acquire path.
  if (declaredScope.length) {
    const others = existingLanes(repo)
      .filter((n) => n !== chosen)
      .map((n) => ({ n, lease: liveLease(laneDir(repo, n), nowMs, ttlMs) }))
      .filter((x) => x.lease)
      .map((x) => ({ lane: x.n, predictedScope: x.lease.predictedScope ?? [], observedScope: [] }));
    try {
      const res = candidateLaunch({ candidateScope: declaredScope, leases: others });
      if (res.outcome !== 'launch') {
        log(`  ⚠ advisory (non-blocking): lane-${chosen} declared scope overlaps lane(s) ${res.waitOn?.length ? res.waitOn.join(', ') : '(see picture)'} — the whole-clone lease is the real lock; proceeding.`);
      }
    } catch { /* advisory only — never let a scope-check failure affect the acquire */ }
  }

  // Ready the leased lane: land on origin/<branch> (item 2 — a lane may sit on main), regen env + deps so it
  // is immediately gate-able, exactly like a provisioned lane. `--no-reset` keeps HEAD.
  // #2386 — `--base=<ref>` lands the clone at a PREDECESSOR LANE'S TIP instead, the building block for
  // overlap-stacked serial batches (a later lane's work builds on an earlier lane's not-yet-merged commits).
  // Still a pool clone — this never touches the primary checkout (#2219/#104): the ref is resolved and reset
  // to INSIDE this lane's own clone, same as the origin/<branch> default path it replaces.
  const dir = laneDir(repo, chosen);
  if (!flags['no-reset']) {
    git(['fetch', 'origin', '--prune', '--quiet'], dir);
    const baseRef = flags.base ? resolveBaseRef(dir, flags.base, chosen) : `origin/${repo.branch}`;
    // #2419 — `checkout -B <branch> <baseRef>`, NOT `reset --hard <baseRef>`. A bare reset moves whatever
    // branch HEAD happens to be attached to (it does not touch which branch that is), so a lane left
    // attached to a STRAY `lane/*` tip (a leftover from an earlier rebase-drop or a manual checkout — #2419's
    // primary cause) stayed attached to that stray branch forever after, just with fresher content. Every
    // downstream reader that assumes a lane sits on `repo.branch` (e.g. the drain's post-land `pull --ff-only`,
    // which needs an attached branch WITH an upstream) then silently no-ops or numbers off the wrong parent.
    // `checkout -B` creates-or-resets `repo.branch` (e.g. `main`) to `baseRef` AND checks it out in the same
    // atomic step, so every reset/acquire always leaves the lane on its own well-known local branch — never a
    // stray one — closing the strand at its source rather than only papering over it downstream. `--force` is
    // REQUIRED here (pre-PR review catch, #2419): unlike `reset --hard`, a bare `checkout -B` still runs the
    // ordinary safe-checkout tree-merge and REFUSES ("local changes would be overwritten by checkout") on a
    // dirty tracked-file conflict — reproduced live against a scratch repo. `acquire` has never gated this
    // reset on tree cleanliness (unlike `refreshLane`'s explicit `laneDirtyOrAhead` guard) — it must
    // unconditionally reclaim a lane regardless of stray edits left by a prior crashed/interrupted session, so
    // `--force` restores that same never-refuses guarantee `reset --hard` always gave it.
    git(['checkout', '-B', repo.branch, baseRef, '--quiet', '--force'], dir);
    git(['clean', '-fd', '--quiet'], dir);
    unmapLanes(repo, [chosen]); // a reset lane no longer renders its old item (#2139)
  }
  writeLaneEnv(repo, chosen);
  if (!flags['no-install']) ensureDeps(dir);
  // NOTE: do NOT re-run ensureRepoSiblings here. It resolves each sibling's primary from the *reference*
  // checkout's parent — correct only when run from the primary; run from INSIDE a lane (a consumer's cwd) it
  // mis-points the shared pool-root sibling clones at itself. The pool-root siblings are a provision/refresh
  // concern; a leased lane borrows a pool those already set up. (Regressed a live acquire until caught — #2275.)
  log(`acquired lane-${chosen} for ${session}${flags.purpose ? ` (${flags.purpose})` : ''}${flags.base ? ` @ base=${flags.base}` : ''} → ${dir}`);
  if (flags.json) process.stdout.write(JSON.stringify({ lane: chosen, path: dir, session, purpose: flags.purpose || null, branch: repo.branch, base: flags.base || null }, null, 2) + '\n');
  else process.stdout.write(dir + '\n'); // stdout = path only, so `LANE=$(… acquire)` captures it clean
}

// #2386 — resolve `--base=<ref>` inside a lane's own clone, AFTER its `fetch origin` so a predecessor lane's
// pushed `lane/*` tip is visible as `origin/<ref>`. Tries `origin/<ref>` FIRST — this is the freshly-fetched,
// authoritative source for "a predecessor lane's PUSHED tip" — falling back to the ref as literally given only
// if that doesn't resolve (a raw SHA, or a ref the caller already fully qualified, e.g. `origin/lane/…`).
// Order matters: trying the bare ref first would resolve `--base=main` to THIS LANE'S OWN stale local `main`
// branch (wherever it was left by the last reset, e.g. a prior `--base` acquire) instead of the origin tip this
// `fetch` just pulled — `fetch` only updates remote-tracking refs, never a checked-out local branch of the same
// name, so a same-named local ref silently shadowing the fresh origin one would be a hard-to-notice stale-data
// bug, not a loud failure. Caught live: acquiring with `--base=main` after origin/main advanced past the lane's
// last reset returned the OLD content with no error until this ordering was flipped.
function resolveBaseRef(dir, ref, laneNum) {
  const withOrigin = `origin/${ref}`;
  if (tryGit(['rev-parse', '--verify', '--quiet', withOrigin], dir)) return withOrigin;
  if (tryGit(['rev-parse', '--verify', '--quiet', ref], dir)) return ref;
  fail(
    `--base=${ref} does not resolve in lane-${laneNum}'s clone (tried "${withOrigin}" and "${ref}") — ` +
      `push it to origin first (a local-only ref on another checkout is not visible here), or pass a ref ` +
      `that already exists on origin.`,
  );
}

function cmdRelease(repo) {
  const session = defaultSession();
  const force = !!flags.force;
  let targets;
  if (flags.all) targets = existingLanes(repo).filter((n) => readLease(laneDir(repo, n))); // every held lane
  else if (flags.lane !== undefined) targets = [Number(flags.lane)];
  else return fail('release needs --lane=N or --all');
  let released = 0;
  for (const n of targets) {
    const dir = laneDir(repo, n);
    const lease = readLease(dir);
    if (!lease) { log(`  lane-${n}: no lease to release`); continue; }
    if (!force && !leaseOwnedBy(lease, session)) {
      log(`  lane-${n}: ${describeLease(lease)} — not yours; pass --force to break`);
      continue;
    }
    rmSync(LEASE_MARKER(dir), { force: true });
    log(`  released lane-${n} (was ${describeLease(lease)})`);
    released++;
  }
  if (flags.json) process.stdout.write(JSON.stringify({ released, targets }, null, 2) + '\n');
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
        ` · ${r.behind === 0 ? 'up-to-date' : `${r.behind} behind`} · deps ${r.deps}` +
        (r.leased ? ` · ${describeLease(r.lease)}` : ''),
    );
  }
}

function cmdList(repo) {
  let lanes = existingLanes(repo);
  // #2426 — `--acquirable` drops any lane a picker must not couple an item onto: one holding a LIVE (foreign)
  // lease or someone's un-pushed work. The parallel /workflow dispatch used the bare list and assigned items to
  // held lanes by position, so a foreign-leased lane's item was carried with zero work. Filtering here (same
  // decision core `acquire` uses) is the throughput fix — the batch holds no leases, so every live lease it sees
  // is foreign; `isLaneAcquirable` excludes all live leases, which is exactly the set to skip.
  if (flags.acquirable) {
    const nowMs = Date.now();
    const ttlMs = ttlMsFromFlags();
    lanes = lanes.filter((n) => isLaneAcquirable(laneAcquirableInfo(repo, n), nowMs, ttlMs));
  }
  const paths = lanes.map((n) => laneDir(repo, n));
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
  unmapLanes(repo, targets); // a torn-down lane must stop receiving proxied page requests (#2139)
  for (const n of targets) {
    const dir = laneDir(repo, n);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      log(`removed lane-${n} (${dir})`);
    }
  }
}

// ── map / unmap (#2139) — maintain the item → lane page-port registry ───────────────────────────────
function cmdMap(repo) {
  const n = Number(flags.lane);
  if (!Number.isInteger(n) || n < 1) fail('map needs --lane=<positive integer>');
  const items = String(flags.item ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s));
  if (items.length === 0) fail('map needs --item=NNN[,NNN…]');
  const port = lanePagePort(repo, n);
  if (port === null) fail(`pool "${repo.name}" has no PORT_BANDS entry — no page port to map`);
  const entries = readPortRegistry(repo);
  for (const num of items) entries[String(Number(num))] = { port, lane: n, repo: repo.name };
  writePortRegistry(repo, entries);
  log(`mapped ${items.join(', ')} → lane-${n} (port ${port}) in ${registryPath(repo)}`);
}

function cmdUnmap(repo) {
  if (flags.all) {
    writePortRegistry(repo, {});
    log(`cleared ${registryPath(repo)}`);
    return;
  }
  if (flags.lane !== undefined) return unmapLanes(repo, [Number(flags.lane)]);
  const items = String(flags.item ?? '')
    .split(',')
    .map((s) => String(Number(s.trim())))
    .filter((s) => s !== 'NaN');
  if (items.length === 0) fail('unmap needs --item=NNN[,NNN…], --lane=N, or --all');
  const entries = readPortRegistry(repo);
  const dropped = items.filter((num) => num in entries);
  for (const num of dropped) delete entries[num];
  writePortRegistry(repo, entries);
  log(dropped.length ? `unmapped ${dropped.join(', ')}` : '(nothing to unmap)');
}

// ── dispatch ──────────────────────────────────────────────────────────────────────────────────────
const COMMANDS = {
  provision: cmdProvision,
  refresh: cmdRefresh,
  status: printStatus,
  list: cmdList,
  path: cmdPath,
  acquire: cmdAcquire,
  release: cmdRelease,
  remove: cmdRemove,
  map: cmdMap,
  unmap: cmdUnmap,
};

if (!cmd || cmd === 'help' || cmd === '--help' || !COMMANDS[cmd]) {
  if (cmd && cmd !== 'help' && cmd !== '--help') process.stderr.write(`unknown command: ${cmd}\n`);
  process.stderr.write(
    'usage: lane-pool.mjs <provision|refresh|status|list|path|acquire|release|remove|map|unmap> [--count=N] [--lane=N] [--all] ' +
      '[--item=NNN[,NNN…]] [--purpose=<slug>] [--session=<slug>] [--scope=<repo:path,...>] [--ttl-minutes=N] [--no-reset] [--repo=<path>] [--origin=<url>] ' +
      '[--reference=<path>] [--name=<slug>] [--branch=<ref>] [--no-install] [--force] [--json]\n',
  );
  process.exit(cmd && COMMANDS[cmd] === undefined && cmd !== 'help' ? 1 : 0);
}

COMMANDS[cmd](resolveRepo());
