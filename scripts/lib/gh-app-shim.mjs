#!/usr/bin/env node
/**
 * @file scripts/lib/gh-app-shim.mjs
 * @description #x8mpubm — GET THE APP TOKEN INTO A DISPATCHED SESSION, FOR REAL. The coordinator's live
 *   evidence (2026-09-23) overturned this same item's own first cut: `we:scripts/lib/github-app-auth-env.mjs`
 *   correctly mints/refreshes an App token and sets `process.env.GH_TOKEN` in the DAEMON's own process (review
 *   88701, fix 8004, drain 43551 all had it in `ps eww`) — but the SPAWNED review/fix sessions (pids 72738,
 *   81880) had neither `GH_TOKEN` nor any `WE_GITHUB_APP_*` var at all. `claude --bg` does not fork a simple
 *   child of the invoking process; it hands work to a separate background session mechanism that does not
 *   inherit the SPAWNER's ambient `process.env` — confirmed live here by direct experiment (a `WE_ENV_PROBE_*`
 *   var set on the spawning shell never reached a `--bg` session's own Bash tool subprocess).
 *
 * WHAT DOES REACH IT, ALSO CONFIRMED LIVE: `claude --bg --settings '{"env":{...}}'` — an EXPLICIT CLI argument,
 * not inherited env — sets exactly those vars in the started session's own Bash-tool subprocess environment,
 * including a `PATH` override (proven by shadowing `gh` with a fake executable and observing the fake, not the
 * real, `gh` respond inside the dispatched session).
 *
 * WHY A PATH-SHADOWING SHIM, NOT A ONE-TIME `GH_TOKEN` VALUE. Baking the CURRENT cached token into `--settings`
 * at spawn time would suffer the exact expiry problem this item's own evidence names: an installation token
 * lives ~1h, and a dispatched review/fix session can genuinely outlive that (multi-round reviews, a fix that
 * runs tests, retries). An env var, once set on a process, never updates itself no matter how long that
 * process lives. Instead, this shadows `gh` on `PATH` with a wrapper ({@link renderGhShimScript}) that reads
 * `we:scripts/lib/github-app-auth-env.mjs`'s own shared, continuously-refreshed token cache file FRESH ON
 * EVERY `gh` INVOCATION — so a session's very first `gh` call and its five-hundredth, an hour later, each get
 * whatever the daemon fleet's own ongoing refresh has most recently written, never a stale spawn-time snapshot.
 * The wrapper needs no `WE_GITHUB_APP_*` var and never touches the private key itself — only the cache file's
 * already-minted, short-lived token, exactly the credential `GH_TOKEN` was always meant to carry.
 *
 * OPT-IN, SAME GATE AS THE REST OF THIS EPIC (#3866). {@link buildGhShimSettingsEnv} returns `null` — no fs
 * write, no PATH override, a dispatch byte-identical to before this file existed — unless
 * `we:scripts/lib/github-app-auth-env.mjs#resolveGithubAppEnvConfig` says the CALLING process has actually
 * opted into App auth. This is not only architectural tidiness: a process (or a test) that has not configured
 * `WE_GITHUB_APP_*` has no cache worth shadowing `gh` for, so shimming would be pure overhead for zero benefit
 * — and, live-caught the same day on this same item's own status-file follow-up, an unconditional real-fs
 * default is exactly how an unrelated test run ends up writing into a developer's actual home directory.
 *
 * NEVER TOUCHES THE PRIVATE KEY. The generated shim only ever reads the shared token CACHE (a short-lived,
 * already-minted installation token) — never `WE_GITHUB_APP_PRIVATE_KEY_PATH`, never signs a JWT, never mints.
 *
 * PURE CORE / IO SHELL: {@link resolveRealGhBinary}, {@link renderGhShimScript} and {@link ghShimPathOverride}
 * are pure (every input injected, including the filesystem probe). {@link ensureGhShim} is the one real write,
 * best-effort and never-throwing exactly like `github-app-auth-env.mjs#writeStatusFile`. {@link
 * buildGhShimSettingsEnv} composes the three into the one thing a dispatcher actually needs: an `env` object
 * to fold into a `claude --bg --settings` argument, or `null` when nothing should change.
 */

import { existsSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { defaultCachePath, resolveGithubAppEnvConfig } from './github-app-auth-env.mjs';

/** Where the generated shim lives — a sibling of the token cache, under the same shared `.claude` tree so a
 *  single daemon's own refresh already covers every dispatcher on the machine. */
export function defaultShimDir(home = homedir()) {
  return `${home}/.claude/github-app-token/gh-shim`;
}

/** The shim's own file path — always named literally `gh`, since PATH resolution for a bare `gh` command is
 *  the entire mechanism this shadows. */
export function shimGhPath(dir = defaultShimDir()) {
  return join(dir, 'gh');
}

/**
 * PURE (given `exists`): find the first REAL `gh` executable on `pathEnv`, skipping `shimDir` itself so the
 * shim never resolves to its own generated file (which would recurse forever the moment it ran). Returns
 * `null` when nothing is found — the caller's signal to skip shimming entirely rather than write a wrapper
 * with no real binary to call.
 * @param {{pathEnv?:string, shimDir?:string, exists?:(p:string)=>boolean}} [o]
 * @returns {string|null}
 */
export function resolveRealGhBinary({ pathEnv = process.env.PATH || '', shimDir = defaultShimDir(), exists = existsSync } = {}) {
  const resolvedShimDir = resolve(shimDir);
  for (const dir of pathEnv.split(':').filter(Boolean)) {
    if (resolve(dir) === resolvedShimDir) continue; // never resolve to ourselves
    const candidate = join(dir, 'gh');
    if (exists(candidate)) return candidate;
  }
  return null;
}

/** The shared cache's own freshness contract, INLINED rather than imported (#x8mpubm) — the rendered shim is a
 *  standalone script that must run correctly from ANY cwd, under ANY lane a dispatched session happens to
 *  acquire, with no dependency on this repo's own module resolution being reachable from wherever `gh` was
 *  invoked. Duplicating these two small constants is the honest cost of that independence; a drift between
 *  this and `github-app-auth-env.mjs#CACHE_VERSION`/`REFRESH_BUFFER_MS` would only ever make the shim MISS a
 *  token it could have used (never apply a wrong one — the check is a pure subset of the real one), so the
 *  failure direction of a drift is the safe one. */
const SHIM_CACHE_VERSION = 2;
const SHIM_REFRESH_BUFFER_MS = 10 * 60 * 1000;

/**
 * PURE: the pattern the shim script tests a FAILED App-token `gh` call's stderr against to tell "this token
 * itself was rejected" apart from every other reason `gh` can fail (a bad flag, a genuinely missing PR, a
 * network hiccup) — never retry-and-mask those, only a credential GitHub itself refused. Exported so the
 * detection is under test at this file's own level, not only inside the generated script's opaque template.
 * @param {string} stderrText
 * @returns {boolean}
 */
export function looksLikeAppTokenAuthFailure(stderrText) {
  const s = String(stderrText || '');
  return /HTTP 401/.test(s) || /Bad credentials/i.test(s);
}

/**
 * PURE: the shim script's own source text — a standalone, dependency-free CommonJS Node script (no repo
 * import reaches it; see the module header for why). Reads `cachePath` fresh on every invocation, applies
 * `GH_TOKEN` only when the cached token is not within `SHIM_REFRESH_BUFFER_MS` of its own expiry, then execs
 * the REAL `gh` (`realGhPath`, baked in at generation time so the shim can never resolve back to itself) with
 * the original argv and the real exit code — a transparent pass-through in every other way.
 *
 * #x8mpubm follow-up (live-caught 2026-09-24, review-2582): "fresh by `expiresAt`" is NOT the same guarantee
 * as "GitHub still honors it" — an installation token can be invalidated (revoked, clock-skewed at mint time,
 * an installation change) before its own recorded expiry. Applying such a token used to fail the WHOLE
 * dispatched session outright on the very first `gh` call, with no recovery until the shared cache next
 * happened to look stale. Now: a `gh` call made WITH the cached App token is run once with its output
 * captured (not inherited) so it can be inspected; only if it fails AND {@link looksLikeAppTokenAuthFailure}
 * recognizes the failure as the token itself being rejected does the shim (a) best-effort delete the shared
 * cache, so the fleet's next refresh mints a replacement instead of every other dispatched session hitting
 * the same bad token for up to an hour, and (b) retry the SAME call once more with no token override — falling
 * back to whatever auth was already in effect (the operator's own `gh auth login`), exactly as a session with
 * no App auth configured at all would run. Every other outcome (success, or a failure unrelated to the token)
 * is passed through byte-for-byte, including the original inherited-stdio behavior when there was no cached
 * token to begin with — a host with nothing cached sees zero change from before this existed.
 * @param {{realGhPath:string, cachePath:string}} o
 * @returns {string}
 */
export function renderGhShimScript({ realGhPath, cachePath }) {
  return `#!/usr/bin/env node
// AUTO-GENERATED by we:scripts/lib/gh-app-shim.mjs — regenerated on every dispatch; do not edit by hand.
// A transparent \`gh\` pass-through that reads the shared GitHub App token cache FRESH on every call (#x8mpubm),
// so a dispatched session's gh calls keep authenticating as the App installation for as long as the shared
// cache stays fresh, however long the session itself runs — never a one-time value stale after ~1h. If the
// cached token itself gets rejected (looks fresh, GitHub disagrees), falls back to personal auth for THIS
// call and invalidates the cache so the fleet stops handing out the same bad token (#x8mpubm review-2582).
'use strict';
const { spawnSync } = require('node:child_process');
const { readFileSync, unlinkSync } = require('node:fs');

const REAL_GH = ${JSON.stringify(realGhPath)};
const CACHE_PATH = ${JSON.stringify(cachePath)};
const CACHE_VERSION = ${JSON.stringify(SHIM_CACHE_VERSION)};
const REFRESH_BUFFER_MS = ${JSON.stringify(SHIM_REFRESH_BUFFER_MS)};

function freshCachedToken() {
  let cached;
  try { cached = JSON.parse(readFileSync(CACHE_PATH, 'utf8')); } catch { return null; }
  if (!cached || cached.v !== CACHE_VERSION || typeof cached.expiresAt !== 'string' || typeof cached.token !== 'string') return null;
  const expiresAtMs = Date.parse(cached.expiresAt);
  if (!Number.isFinite(expiresAtMs) || (expiresAtMs - REFRESH_BUFFER_MS) <= Date.now()) return null;
  return cached.token;
}

function looksLikeAppTokenAuthFailure(stderrText) {
  const s = String(stderrText || '');
  return /HTTP 401/.test(s) || /Bad credentials/i.test(s);
}

function invalidateSharedCache() {
  try { unlinkSync(CACHE_PATH); } catch { /* best-effort — a missing/already-gone cache is fine */ }
}

function runInherited(env) {
  const result = spawnSync(REAL_GH, process.argv.slice(2), { stdio: 'inherit', env });
  if (result.error) { process.stderr.write(String(result.error && result.error.message || result.error) + '\\n'); process.exit(1); }
  process.exit(result.status == null ? 1 : result.status);
}

const token = freshCachedToken();
if (!token) runInherited(process.env); // no cached App token — unchanged, byte-identical to before this existed

const withToken = spawnSync(REAL_GH, process.argv.slice(2), {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: Object.assign({}, process.env, { GH_TOKEN: token }),
});
if (withToken.error) { process.stderr.write(String(withToken.error.message || withToken.error) + '\\n'); process.exit(1); }
const stderrText = withToken.stderr ? withToken.stderr.toString('utf8') : '';
if (withToken.status !== 0 && looksLikeAppTokenAuthFailure(stderrText)) {
  invalidateSharedCache();
  runInherited(process.env); // retry once on whatever auth is already in effect — falls back safely
}
if (withToken.stdout) process.stdout.write(withToken.stdout);
if (withToken.stderr) process.stderr.write(withToken.stderr);
process.exit(withToken.status == null ? 1 : withToken.status);
`;
}

/**
 * THE ONE REAL WRITE — best-effort and NEVER throws, mirroring `github-app-auth-env.mjs#writeStatusFile`'s
 * own discipline: a dispatch must never fail because a diagnostic/convenience write couldn't land (a
 * read-only shim dir, a full disk). A failure here means the caller falls back to `null` — no shim, no
 * `--settings` override, the dispatch proceeds exactly as it would have before this file existed.
 * @param {{dir?:string, realGhPath:string, cachePath?:string, writeFile?:Function, chmod?:Function, mkdir?:Function}} o
 * @returns {{ok:boolean, path?:string, reason?:string}}
 */
export function ensureGhShim({
  dir = defaultShimDir(), realGhPath, cachePath = defaultCachePath(),
  writeFile = writeFileSync, chmod = chmodSync, mkdir = mkdirSync,
} = {}) {
  if (!realGhPath) return { ok: false, reason: 'no-real-gh' };
  try {
    mkdir(dir, { recursive: true });
    const path = shimGhPath(dir);
    writeFile(path, renderGhShimScript({ realGhPath, cachePath }), 'utf8');
    chmod(path, 0o755);
    return { ok: true, path };
  } catch (e) {
    return { ok: false, reason: 'write-failed', error: String((e && e.message) || e) };
  }
}

/** PURE: the new `PATH` value — the shim dir prepended, so a bare `gh` command resolves to it first. */
export function ghShimPathOverride({ dir = defaultShimDir(), currentPath = process.env.PATH || '' } = {}) {
  return `${dir}:${currentPath}`;
}

/**
 * THE ONE THING A DISPATCHER ACTUALLY CALLS: an `env` object to fold into a `claude --bg --settings
 * '{"env":...}'` argument (via `we:scripts/operations/dispatch-lane-io.mjs#buildAgentArgv`'s `settingsEnv`
 * param), or `null` when nothing should change — the caller then omits `--settings` entirely, a dispatch
 * byte-identical to before this file existed.
 *
 * NEVER THROWS. Every real effect below it is wrapped or already non-throwing; this function additionally
 * treats a MISSING real `gh` binary or a failed shim write as "skip it", never as a reason to fail a dispatch
 * that would otherwise have gone out fine on personal auth, exactly as it always has.
 * @param {{env?:NodeJS.ProcessEnv, pathEnv?:string, cachePath?:string, dir?:string,
 *   exists?:Function, writeFile?:Function, chmod?:Function, mkdir?:Function}} [o]
 * @returns {Record<string,string>|null}
 */
export function buildGhShimSettingsEnv({
  env = process.env, pathEnv = process.env.PATH || '', cachePath = defaultCachePath(), dir = defaultShimDir(),
  exists, writeFile, chmod, mkdir,
} = {}) {
  if (!resolveGithubAppEnvConfig(env)) return null; // opt-in — see the module header
  const realGhPath = resolveRealGhBinary({ pathEnv, shimDir: dir, exists });
  if (!realGhPath) return null;
  const written = ensureGhShim({ dir, realGhPath, cachePath, writeFile, chmod, mkdir });
  if (!written.ok) return null;
  return { PATH: ghShimPathOverride({ dir, currentPath: pathEnv }) };
}
