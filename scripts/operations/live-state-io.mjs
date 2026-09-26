/**
 * @file scripts/operations/live-state-io.mjs
 * @description Card xvz55jf (epic #3931) — the IO shell for the `live-state` operation. Every real read lives
 *   here, injectable exactly like `daemon-status-io.mjs`/`heavy-queue-io.mjs`'s own shape — and, per those two
 *   files' own header discipline, THIS FILE ADDS NO SECOND IMPLEMENTATION of any read another module already
 *   owns:
 *
 *   1. `collectDaemonStatus` + `assessDaemonStatus` (`./daemon-status-io.mjs` / `./daemon-status.mjs`, #4067) —
 *      called and ASSESSED here, not just collected; `./live-state.mjs` reads the already-assessed shape.
 *   2. `collectHeavyQueue` + `assessHeavyQueue` (`./heavy-queue-io.mjs` / `./heavy-queue.mjs`, card xb0iuxq) —
 *      same reuse-the-assessment shape as (1).
 *   3. `openHealthEpisodesData` (`../conveyor/health-watch-section.mjs`) — the structured sibling of the
 *      `--with-health` lines `operator-queue.mjs` already prints, added alongside it by this same card rather
 *      than re-reading `.conveyor/health/state.json` a second way.
 *   4. `readJsonlTail` (`./land-advance-io.mjs`) — the SAME bounded jsonl-tail reader `land-advance-io.mjs`'s
 *      own drain-history read already uses (that module's own header: "this module never reads
 *      `plateau:.drain-daemon/history.jsonl` itself [directly with fs]" — it goes through this same helper).
 *      This file uses it for the SAME file, one directory default pinned to the path the card names
 *      (`/Users/nicolasgilbert/workspace/plateau-app/.drain-daemon/history.jsonl`), overridable for tests.
 *   5. `readGithubAppStatus` / `defaultStatusPath` (`../lib/github-app-auth-env.mjs`) — the SAME shared status
 *      file `we:scripts/conveyor/github-app-status.mjs` already reports off of.
 *   6. `node scripts/lane-pool.mjs status --json` — the SAME real subprocess read every existing lane-pool
 *      consumer uses (`we:scripts/readiness/scope-lease-collect.mjs#readPoolStatus`, `we:scripts/conveyor/
 *      status-artifact.mjs`, `we:scripts/conveyor/lane-pool-health-watch.mjs`) rather than importing
 *      `lane-pool.mjs`'s internal (unexported) `laneStatus`/`existingLanes` functions directly.
 *   7. `os.loadavg()` / `os.cpus().length` — no existing operation owns this reading, so it is the one new
 *      primitive this file adds.
 */
import { execFileSync } from 'node:child_process';
import { loadavg, cpus, homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectDaemonStatus } from './daemon-status-io.mjs';
import { assessDaemonStatus } from './daemon-status.mjs';
import { collectHeavyQueue } from './heavy-queue-io.mjs';
import { assessHeavyQueue } from './heavy-queue.mjs';
import { openHealthEpisodesData } from '../conveyor/health-watch-section.mjs';
import { readJsonlTail } from './land-advance-io.mjs';
import { readGithubAppStatus, defaultStatusPath } from '../lib/github-app-auth-env.mjs';
import { CONSTELLATION_REPOS } from '../lib/constellation-repos.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** `$HOME` in a `CONSTELLATION_REPOS` `path` entry, expanded — mirrors `lane-pool.mjs`'s own `expandHome`. */
export function expandHome(p, home = homedir()) {
  return String(p || '').replace(/^\$HOME\b/, home);
}

/** The card's own pinned drain-history path, overridable via `WE_LIVE_STATE_DRAIN_HISTORY` for a test or a
 *  differently-laid-out host — never a second constant a caller could disagree with. */
export function defaultDrainHistoryPath(env = process.env, home = homedir()) {
  return env.WE_LIVE_STATE_DRAIN_HISTORY || join(home, 'workspace', 'plateau-app', '.drain-daemon', 'history.jsonl');
}

/**
 * One constellation pool's lane rows, counted into free/leased/dirty — never a re-scan of git; the counting
 * reads ONLY the fields `lane-pool.mjs status --json` already computed per lane (`clean`, `leased`, `exists`).
 * @param {string} repoKey
 * @param {{execFn?:Function, cwd?:string, repoPathArg?:string|null}} o
 */
export function readOneLanePool(repoKey, { execFn = execFileSync, cwd = ROOT, repoPathArg = null } = {}) {
  const args = [join(ROOT, 'scripts', 'lane-pool.mjs'), 'status', '--json'];
  if (repoPathArg) args.push(`--repo=${repoPathArg}`);
  try {
    const out = execFn('node', args, { cwd, encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] });
    const parsed = JSON.parse(out);
    const lanes = Array.isArray(parsed.lanes) ? parsed.lanes : [];
    const existing = lanes.filter((l) => l.exists);
    const free = existing.filter((l) => l.clean && !l.leased);
    const leased = existing.filter((l) => l.leased);
    const dirty = existing.filter((l) => !l.clean);
    return { repoKey, total: existing.length, free: free.length, leased: leased.length, dirty: dirty.length };
  } catch (e) {
    return { repoKey, total: 0, free: 0, leased: 0, dirty: 0, error: String(e.message ?? e).split('\n')[0] };
  }
}

/** Every constellation pool's lane counts — `we` reads via `cwd` (this checkout IS a `we` clone, so its own
 *  origin resolves the pool with no `--repo` needed); each sibling passes its checkout path explicitly, since
 *  `lane-pool.mjs`'s origin-URL derivation needs a real checkout to read `git remote get-url origin` from. */
export function readAllLanePools({ execFn = execFileSync, home = homedir() } = {}) {
  return Object.keys(CONSTELLATION_REPOS).map((repoKey) => {
    const meta = CONSTELLATION_REPOS[repoKey];
    return meta.path
      ? readOneLanePool(repoKey, { execFn, cwd: ROOT, repoPathArg: expandHome(meta.path, home) })
      : readOneLanePool(repoKey, { execFn, cwd: ROOT });
  });
}

/** The drain daemon's own last recorded pass, from the tail of its `history.jsonl` — real disk read via the
 *  shared {@link readJsonlTail} helper, never a re-implementation of jsonl tailing. */
export function readDrainLastPass({ path = defaultDrainHistoryPath(), fs } = {}) {
  try {
    const { entries } = readJsonlTail(path, fs ? { fs } : {});
    return { lastPass: entries.length ? entries[entries.length - 1] : null };
  } catch (e) {
    // `readJsonlTail` itself only swallows ENOENT (`land-advance-io.mjs`'s own `missing()` helper) — a corrupt
    // last line (partial write mid-append, a real failure mode for an actively-appended log) still throws.
    // Degrade to "unreadable" rather than crashing the whole snapshot for one bad line.
    return { lastPass: null, error: String(e.message ?? e).split('\n')[0] };
  }
}

/** GitHub App auth state — the shared status file every `ensureFreshGithubAppEnv` caller writes. */
export function readGithubAuth({ statusPath = defaultStatusPath() } = {}) {
  return readGithubAppStatus(statusPath);
}

/** Machine load — the one primitive with no existing operation to defer to. */
export function readMachineLoad({ readLoadavg = loadavg, readCpus = cpus } = {}) {
  return { loadavg: readLoadavg(), cores: readCpus().length || 1 };
}

/**
 * The real collector — the ONE function `run.mjs` binds to the `live-state` operation's `collect` dep. Every
 * sub-read is independently injectable (mirrors `collectHeavyQueue`'s own shape) so a test can fake any single
 * source without touching the others.
 * @param {{now?:() => number, collectDaemons?:Function, collectQueue?:Function, readHealth?:Function,
 *   readLanes?:Function, readDrain?:Function, readGithub?:Function, readLoad?:Function}} [o]
 */
export function collectLiveState({
  now = () => Date.now(),
  collectDaemons = collectDaemonStatus,
  collectQueue = collectHeavyQueue,
  readHealth = openHealthEpisodesData,
  readLanes = readAllLanePools,
  readDrain = readDrainLastPass,
  readGithub = readGithubAuth,
  readLoad = readMachineLoad,
} = {}) {
  return {
    observedAt: new Date(now()).toISOString(),
    daemonStatus: assessDaemonStatus(collectDaemons()),
    heavyQueue: assessHeavyQueue(collectQueue()),
    health: readHealth(),
    lanePools: readLanes(),
    drain: readDrain(),
    githubAuth: readGithub(),
    machineLoad: readLoad(),
  };
}
