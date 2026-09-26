/**
 * @file scripts/lib/daemon-last-good.mjs
 * @description x5wbsbc (epic #4075/#3383) — "a failed daemon update must never block delivery". Operator ruling,
 *   Sat 2026-09-26: "fallback on last working version rather than block delivery".
 *
 *   A daemon clone is rebuilt from `origin/main` (+ overlays) by `daemon-rebuild.mjs`, gated behind a live smoke.
 *   When that smoke rejects the new build, the clone STAYS on the build it is already running — the last one a
 *   smoke passed (`state.adopted.head`). Before this card, every dispatch chokepoint then refused as stale
 *   (`main-staleness.mjs#assertMainNotStale`: "behind origin/main — refusing"), so a single bad main commit, a
 *   bad overlay, or a broken smoke HARNESS stopped all review/fix dispatch until a human stepped in (live
 *   2026-09-26 12:17-12:40 ET on `wev-review-daemon`: every rebuild `smoke-rejected`, sticky).
 *
 *   This module is the ONE read both sides share:
 *   - `main-staleness.mjs#assertMainNotStale` asks {@link lastGoodForClone}: is this managed clone's HEAD the
 *     last smoke-verified build, with a clean tree? Then it dispatches from it instead of refusing — and past
 *     {@link lastGoodMaxAgeMs} (default 24 h) of being held it says so loudly, but STILL dispatches.
 *   - `daemon-rebuild.mjs` writes `state.held` (why, since when, which checks failed) whenever a smoke failure
 *     keeps the clone on its last-good build, and clears it on the next adoption; the health watch's
 *     `daemon-held-on-last-good` sign reads the same record.
 *
 *   Deliberately import-light (node builtins only): `main-staleness.mjs` imports this, and `daemon-rebuild.mjs`
 *   imports `main-staleness.mjs`, so importing `daemon-overlays.mjs` (→ `daemon-self-sync.mjs` →
 *   `daemon-rebuild.mjs`) from here would close an import cycle. {@link cloneKeyOf} therefore re-states
 *   `daemon-overlays.mjs#cloneKey`'s three lines; a unit test pins the two to the same value.
 */

import { readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';
import { createHash } from 'node:crypto';

/** Env var pinning the rebuild-state root (same one `daemon-rebuild.mjs` uses). */
export const WE_DAEMON_STATE_DIR_ENV = 'WE_DAEMON_STATE_DIR';

/** Env override for how long a clone may be held on its last-good build before the staleness guard ALERTS
 *  (it keeps dispatching either way — the operator's ruling). */
export const LAST_GOOD_MAX_AGE_ENV = 'WE_DAEMON_LAST_GOOD_MAX_AGE_MS';
export const DEFAULT_LAST_GOOD_MAX_AGE_MS = 24 * 60 * 60_000;

/** `<WE_DAEMON_STATE_DIR || ~/.claude/daemon-self-sync-state>`. */
export function daemonStateDir(env = process.env) {
  return (env && env[WE_DAEMON_STATE_DIR_ENV]) || join(homedir(), '.claude', 'daemon-self-sync-state');
}

/** Same value as `daemon-overlays.mjs#cloneKey` (sha256 of the realpath, 16 hex) — see the file header. */
export function cloneKeyOf(root) {
  let p;
  try { p = realpathSync(root); } catch { p = resolvePath(root); }
  return createHash('sha256').update(p).digest('hex').slice(0, 16);
}

/** @returns {number} */
export function lastGoodMaxAgeMs(env = process.env) {
  const n = Number(env?.[LAST_GOOD_MAX_AGE_ENV]);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_LAST_GOOD_MAX_AGE_MS;
}

/** Read `<stateDir>/<cloneKey>.rebuild.json`; `null` when missing or unreadable (never throws). */
export function readRebuildStateFile(root, env = process.env) {
  try {
    return JSON.parse(readFileSync(join(daemonStateDir(env), `${cloneKeyOf(root)}.rebuild.json`), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * PURE: is the clone running its last smoke-verified build?
 * `onLastGood` needs all three: a recorded `adopted.head`, HEAD equal to it, and a clean tree (a modified tree is
 * not the build the smoke verified). `heldSince`/`ageMs`/`overAge` come from `state.held` when the rebuild
 * recorded one (a smoke failure is what holds it); with no `held` record the age is unknown (`null`, never over).
 * @param {{headSha:string|null, state:object|null, dirty?:boolean, nowMs:number, maxAgeMs:number}} o
 * @returns {{onLastGood:boolean, lastGood:string|null, held:object|null, heldSince:string|null,
 *   ageMs:number|null, overAge:boolean}}
 */
export function decideLastGood({ headSha, state, dirty = false, nowMs, maxAgeMs }) {
  const lastGood = state?.adopted?.head ?? null;
  const held = state?.held ?? null;
  const onLastGood = !!(lastGood && headSha && headSha === lastGood && !dirty);
  const sinceMs = Date.parse(held?.since || '');
  const ageMs = Number.isFinite(sinceMs) ? Math.max(0, nowMs - sinceMs) : null;
  return {
    onLastGood,
    lastGood,
    held,
    heldSince: held?.since ?? null,
    ageMs,
    overAge: onLastGood && ageMs != null && ageMs > maxAgeMs,
  };
}

/**
 * IO shell over {@link decideLastGood} for one clone.
 * @param {{root:string, headSha:string|null, dirty?:boolean, env?:NodeJS.ProcessEnv, now?:number,
 *   readState?:typeof readRebuildStateFile}} o
 */
export function lastGoodForClone({
  root, headSha, dirty = false, env = process.env, now = Date.now(), readState = readRebuildStateFile,
}) {
  return decideLastGood({
    headSha, state: readState(root, env), dirty, nowMs: now, maxAgeMs: lastGoodMaxAgeMs(env),
  });
}
