#!/usr/bin/env node
/**
 * @file scripts/lib/github-app-auth-env.mjs
 * @description Implements ratified #3866 Fork 1(a) (a GitHub App installation token, app-to-server, never
 *   the user-to-server "authorize as me" flow) via the simplest mechanism that actually reaches every
 *   consumer: a shared on-disk token cache, refreshed by each process at the top of each tick/pass, and
 *   exposed to `gh`/git subprocess calls through `process.env.GH_TOKEN` — which `gh` CLI already honors
 *   ahead of its own stored `gh auth login` credential, and which EVERY `execFileSync`/`spawn` call already
 *   inherits by default, whether it goes through `we:scripts/lib/gh-throttle.mjs`'s wrapper or one of the
 *   84 raw call sites #3861 tracks migrating (that migration is a SEPARATE, unrelated concern — burst
 *   throttling, not credential choice; a raw `execFileSync('gh', ...)` already inherits `process.env` today).
 *
 * WHY NOT WIRE THIS INSIDE gh-throttle.mjs (as #3881 originally sketched). That module's exec path is
 * deliberately, permanently SYNCHRONOUS (`execFileSync`-shaped — see its own header), but minting a real
 * installation token is an async network call (`we:scripts/lib/github-app-token.mjs#mintInstallationToken`
 * uses `fetch`). Forcing that call to sync would mean shelling `curl` from inside a throttled call, adding
 * real complexity to the one module everything else's rate-limit safety already depends on. Splitting
 * mint/refresh (async, at the top of each tick or pass, between the blocking sync work) from CONSUME (sync, a
 * plain env var read) sidesteps the problem entirely, and reaches the drain (`we:scripts/merge-ai-prs.mjs`)
 * too — which does not call through gh-throttle.mjs at all, so wiring the swap inside that module alone
 * would never have covered it (live-caught 2026-09-23, following a real rate-limit exhaustion incident).
 *
 * OPT-IN, NEVER A SILENT BEHAVIOR CHANGE. {@link resolveGithubAppEnvConfig} returns `null` unless all three
 * `WE_GITHUB_APP_*` env vars are set — a process that doesn't configure this keeps drawing from the
 * operator's own personal token exactly as before. No caller of this module is REQUIRED to opt in.
 *
 * PURE-CORE / IO-SHELL SPLIT, same discipline as every other daemon primitive in this epic:
 *   - {@link isCacheFresh} is pure — no fs, no network, no real clock (every input injected).
 *   - {@link ensureFreshGithubAppEnv} is the IO shell: reads/writes the cache file, calls the real minter,
 *     mutates `process.env`. Every effect is injectable for testing with no real GitHub App needed.
 */

import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import { mintInstallationToken } from './github-app-token.mjs';
import { CONSTELLATION_REPOS } from './constellation-repos.mjs';

/**
 * What the fleet's `gh` calls actually need, as GitHub App permission levels. Live-caught 2026-09-23: the
 * first real installation was registered with NO repository permissions at all (`{}`) — its token still
 * minted fine and even READ the public repo, so a check at mint time is the only thing standing between a
 * misconfigured App and a fleet that silently can't label, comment or merge anything.
 *   - pull_requests / issues: write — PR reads, labels and comments (labels/comments go through the Issues API)
 *   - contents: write — the drain's merge
 *   - workflows: write — GitHub refuses an App merging a PR that touches `.github/workflows/` without it
 *   - checks / statuses / actions: read — CI state (`statusCheckRollup`, workflow runs)
 */
export const REQUIRED_APP_PERMISSIONS = Object.freeze({
  metadata: 'read',
  pull_requests: 'write',
  issues: 'write',
  contents: 'write',
  workflows: 'write',
  checks: 'read',
  statuses: 'read',
  actions: 'read',
});

/** Every constellation repo the fleet touches — a token that can't see one of them would fail every call to
 *  it with "Could not resolve to a Repository", with no fallback (live-caught 2026-09-23 on plateau-app). */
export const REQUIRED_APP_REPOS = Object.freeze(Object.values(CONSTELLATION_REPOS).map((r) => r.slug));

const LEVEL = { read: 1, write: 2, admin: 3 };

/**
 * Pure: which required permissions and repos does a minted installation NOT cover? An empty result on both
 * is the only state in which applying the App token is safe.
 * @param {{permissions?:object, repos?:string[]}} granted
 * @param {{permissions?:object, repos?:string[]}} [required]
 * @returns {{missingPermissions:string[], missingRepos:string[]}}
 */
export function findInstallationGaps(granted, { permissions = REQUIRED_APP_PERMISSIONS, repos = REQUIRED_APP_REPOS } = {}) {
  const have = granted?.permissions ?? {};
  const missingPermissions = Object.entries(permissions)
    .filter(([name, level]) => (LEVEL[have[name]] ?? 0) < LEVEL[level])
    .map(([name, level]) => `${name}:${level}`);
  const haveRepos = new Set((granted?.repos ?? []).map((r) => String(r).toLowerCase()));
  const missingRepos = repos.filter((r) => !haveRepos.has(String(r).toLowerCase()));
  return { missingPermissions, missingRepos };
}

/** The repos an installation token can actually see (`GET /installation/repositories`, authenticated as the
 *  installation itself). One call per MINT, not per `gh` call — a mint happens roughly once an hour. */
async function defaultListInstallationRepos(token, fetchImpl = fetch) {
  const res = await fetchImpl('https://api.github.com/installation/repositories?per_page=100', {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!res.ok) throw new Error(`github-app-auth-env: listing installation repos failed (HTTP ${res.status})`);
  const data = await res.json();
  return (data.repositories ?? []).map((r) => r.full_name);
}

/** Refresh this long before the real 1-hour expiry — generous enough that a slow mint, a daemon restart
 *  mid-refresh, or plain clock skew never leaves a consumer holding a token GitHub has already rejected. */
export const REFRESH_BUFFER_MS = 10 * 60 * 1000;

/** One shared cache, not per-daemon — the review daemon, the fix-dispatch daemon and the drain all draw
 *  from the SAME installation, so one fresh token serves all of them; minting three independent tokens for
 *  one installation would just be three times the JWT-signing cost for zero isolation benefit (they already
 *  share the one installation's rate-limit bucket, by #3866's own ruling). */
export function defaultCachePath(home = homedir()) {
  return `${home}/.claude/github-app-token/web-everything.json`;
}

/**
 * The three env vars that opt a process into GitHub App auth. All three or none — a partially-configured
 * process is almost certainly a typo, not an intentional two-thirds opt-in, so it refuses closed (falls back
 * to personal auth) rather than guessing which piece is missing.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{appId:string, installationId:string, privateKeyPath:string}|null}
 */
export function resolveGithubAppEnvConfig(env = process.env) {
  const appId = env.WE_GITHUB_APP_ID;
  const installationId = env.WE_GITHUB_APP_INSTALLATION_ID;
  const privateKeyPath = env.WE_GITHUB_APP_PRIVATE_KEY_PATH;
  if (!appId || !installationId || !privateKeyPath) return null;
  return { appId, installationId, privateKeyPath };
}

/**
 * Stamped on every cache entry this module writes. Only an entry carrying the CURRENT version is trusted —
 * because a cache hit skips the access check, an entry written by an older, laxer version must never be
 * reused (live-caught 2026-09-23: a pre-check probe cached an unvalidated token, and both daemons applied it
 * on restart until it was deleted by hand). Bump this whenever what "validated" means changes.
 */
export const CACHE_VERSION = 2;

/** Pure: is a cached token still safe to use `bufferMs` before its own real expiry? No token cached at all
 *  is never "fresh" — that is a mint, not a refresh; nor is one written by a different cache version.
 *  @param {{expiresAt?:string, v?:number}|null} cached @param {number} nowMs @param {number} [bufferMs] */
export function isCacheFresh(cached, nowMs, bufferMs = REFRESH_BUFFER_MS) {
  if (!cached || cached.v !== CACHE_VERSION || typeof cached.expiresAt !== 'string') return false;
  const expiresAtMs = Date.parse(cached.expiresAt);
  return Number.isFinite(expiresAtMs) && (expiresAtMs - bufferMs) > nowMs;
}

/** Missing is distinct from corrupt — a corrupt cache (torn write, hand-edited) is treated as absent rather
 *  than thrown on, since the caller's whole job is "get me a usable token", not "diagnose the cache file". */
function readCacheFile(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

/** Atomic write (write-then-rename, same directory) — two processes racing to refresh the SAME shared cache
 *  must never leave a torn/partial JSON on disk for a third reader mid-write. */
function writeCacheFile(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(data), 'utf8');
  renameSync(tmp, path);
}

/**
 * The IO shell a process's own bootstrap calls: if GitHub App auth is configured, ensure the shared cache
 * holds a token fresh enough to use, minting a new one when it does not, then set `process.env.GH_TOKEN` to
 * it so every `gh` CLI call and every raw `execFileSync('gh', …)` this process (or anything it spawns)
 * makes from here on authenticates as the App installation instead of the operator's personal token.
 *
 * Never throws on a mint failure — a transient GitHub outage must not crash a daemon tick or a drain run;
 * it logs and leaves `process.env.GH_TOKEN` UNCHANGED, so a caller with no App configured (or one whose mint
 * just failed) falls straight back to whatever auth was already in effect (the operator's own `gh auth
 * login`, unchanged from today).
 *
 * FAIL-SAFE ON A MISCONFIGURED APP. A fresh mint is checked against {@link REQUIRED_APP_PERMISSIONS} and
 * {@link REQUIRED_APP_REPOS} BEFORE it is cached or applied. An installation missing any of them is refused
 * the same way a failed mint is — personal auth stays in effect, and the log names exactly what to grant — so
 * switching the App on can never leave the fleet less able to act than it was before. Only a token that
 * passed this check is ever written to the cache, so a cache hit needs no re-check.
 * @param {{env?:NodeJS.ProcessEnv, cachePath?:string, now?:number, readCache?:Function, writeCache?:Function,
 *   mint?:typeof mintInstallationToken, listRepos?:(token:string)=>Promise<string[]>,
 *   required?:{permissions?:object, repos?:string[]}, setEnv?:(token:string)=>void, log?:Console}} [o]
 * @returns {Promise<{applied:boolean, reason:string, missingPermissions?:string[], missingRepos?:string[]}>}
 */
export async function ensureFreshGithubAppEnv({
  env = process.env,
  cachePath = defaultCachePath(),
  now = Date.now(),
  readCache = readCacheFile,
  writeCache = writeCacheFile,
  mint = mintInstallationToken,
  listRepos = defaultListInstallationRepos,
  required,
  setEnv = (token) => { process.env.GH_TOKEN = token; },
  log = console,
} = {}) {
  const config = resolveGithubAppEnvConfig(env);
  if (!config) return { applied: false, reason: 'not-configured' };

  let cached = readCache(cachePath);
  if (!isCacheFresh(cached, now)) {
    let minted;
    let repos;
    try {
      minted = await mint({ appId: config.appId, installationId: config.installationId, privateKeyPath: config.privateKeyPath, now });
      repos = await listRepos(minted.token);
    } catch (e) {
      // Never echo a partial token or the private key path's contents — only the API's own error message,
      // already scrubbed of secrets by github-app-token.mjs's own mint failure path.
      log.error?.(`github-app-auth-env: mint failed (falling back to personal auth): ${String((e && e.message) || e)}`);
      return { applied: false, reason: 'mint-failed' };
    }
    const { missingPermissions, missingRepos } = findInstallationGaps({ permissions: minted.permissions, repos }, required);
    if (missingPermissions.length || missingRepos.length) {
      log.error?.(
        'github-app-auth-env: App installation is missing access the fleet needs — NOT applying it, staying on personal auth. '
        + (missingPermissions.length ? `Grant repository permissions: ${missingPermissions.join(', ')}. ` : '')
        + (missingRepos.length ? `Add repositories to the installation: ${missingRepos.join(', ')}.` : ''),
      );
      return { applied: false, reason: 'insufficient-access', missingPermissions, missingRepos };
    }
    cached = { v: CACHE_VERSION, token: minted.token, expiresAt: minted.expiresAt };
    writeCache(cachePath, cached);
  }

  setEnv(cached.token);
  return { applied: true, reason: 'ok' };
}

/**
 * For a LONG-RUNNING daemon: wrap its `runDaemonLoop` effects so every tick first awaits
 * {@link ensureFreshGithubAppEnv}, then runs the real tick. A cache read on almost every tick; a mint only
 * once the token nears expiry.
 *
 * WHY PER-TICK AND NEVER A TIMER (live-caught 2026-09-23). A daemon tick is a long run of synchronous
 * `execFileSync` calls (`gh`, `claude`) that BLOCKS the event loop. A background `setInterval` refresh
 * therefore could not progress while a tick ran — and a mint caught mid-connection by a long tick timed out
 * ("fetch failed"), falling back to personal auth. It also meant a fresh daemon's FIRST tick always started
 * before its token was in place. The gap between ticks is the one moment the loop is guaranteed free; awaiting
 * there also means every tick, including the first, starts with the token already set.
 * @param {{tickOnce:()=>any}} effects - a daemon's `runDaemonLoop` effects object
 * @param {Parameters<typeof ensureFreshGithubAppEnv>[0]} [opts] - forwarded to every refresh
 * @returns {typeof effects} the same effects, `tickOnce` wrapped
 */
export function withGithubAppAuth(effects, opts = { log: console }) {
  const tick = effects.tickOnce;
  return {
    ...effects,
    tickOnce: async () => {
      await ensureFreshGithubAppEnv(opts); // never throws — a failure logs and leaves personal auth in place
      return tick();
    },
  };
}
