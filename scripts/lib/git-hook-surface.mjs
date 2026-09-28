/**
 * @file scripts/lib/git-hook-surface.mjs
 * @description Hardening primitive for `we:scripts/operations/probation-heal-run.mjs` and
 *   `we:scripts/operations/probation-build-run.mjs` (backlog `x55dojc`): both run an untrusted model with
 *   filesystem write access inside a real git lane clone, then run `git commit` (and, later, the gate,
 *   `verify-lane.mjs`, which itself shells out to git) in that SAME lane. Nothing there previously disabled or
 *   even inspected git hooks, so a hostile or mistaken worker could plant `.git/hooks/pre-commit` (or a
 *   `core.hooksPath` repoint), which then executes with the launcher's own credentials at commit/gate time.
 *
 * SCOPE, STATED EXPLICITLY (a 2026-09-28 Codex plan review flagged this as the one thing worth being honest
 * about): this covers the TRADITIONAL git-hooks mechanism (`.git/hooks/<name>`, `core.hooksPath`) only. It does
 * NOT cover every config-controlled execution path git supports (`core.fsmonitor`, `clean`/`smudge`/`textconv`
 * filters named in `.gitattributes`+config, or the newer `hook.<name>.command`/`.event` config-hooks upstream
 * git added after this was written) — those are a materially different, broader hardening pass, tracked as a
 * separate follow-up rather than half-covered here under this item's name.
 *
 * THE TWO LAYERS:
 *   1. PREVENTION — {@link HOOKS_DISABLED_ENV}/{@link withHooksDisabled}: env-based git config
 *      (`GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_n`/`GIT_CONFIG_VALUE_n`, git >=2.31) outranks a repo's own
 *      `.git/config`, so pointing `core.hooksPath` at `/dev/null` (not a directory — git finds no hook file
 *      under it and silently treats every hook as absent) via this env disables hooks for EVERY git command
 *      that inherits it, even one a worker's own re-write of `.git/config` tries to re-enable. Apply it to
 *      every subprocess a run script spawns in the lane — the worker's own launcher included, so its own git
 *      use (if any) is covered without editing `codex-direct-task.mjs`/`gemini-direct-task.mjs` at all.
 *   2. DETECTION + CLEANUP — {@link resetHookSurface} (force a known-clean baseline before a worker ever runs,
 *      so a PREVIOUS dispatch's leftovers in a reused pooled lane are never silently inherited) and
 *      {@link snapshotHookSurface}/{@link hookSurfaceChanged} (did anything change while the worker ran? loudly
 *      refuse and re-clean if so — belt-and-suspenders in case layer 1 is ever bypassed by a future refactor
 *      that forgets to apply the env, or by a hostile child that unsets its own inherited env and calls
 *      `git -c core.hooksPath=<real path>` explicitly — an explicit `-c` DOES outrank the inherited env).
 *
 * No fs/git call here ever throws past its own contract — every function degrades to a documented, FAIL-CLOSED
 * default (an unreadable snapshot reads as "changed") rather than letting an unexpected error escape into a
 * caller that is very often already inside its own cleanup/refusal path.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync, readlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Env additions that force git hooks off for every process that inherits them. See the file header for why
 * env-based config, not a per-call `-c` flag, is what makes this survive a worker rewriting `.git/config`.
 */
export const HOOKS_DISABLED_ENV = Object.freeze({
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'core.hooksPath',
  GIT_CONFIG_VALUE_0: '/dev/null',
});

/**
 * `env` with hooks forced off (see {@link HOOKS_DISABLED_ENV}). PURE — returns a new object, never mutates
 * `env`. A caller with its OWN `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_*`/`GIT_CONFIG_VALUE_*` entries already set
 * would have them overwritten here; no run script in this repo sets those today.
 * @param {Record<string,string>} [env]
 * @returns {Record<string,string>}
 */
export function withHooksDisabled(env = {}) {
  return { ...env, ...HOOKS_DISABLED_ENV };
}

/** A stable fingerprint for one `.git/hooks/` entry: type + permission bits + content (files) or link target
 *  (symlinks), so a chmod, a content edit, and a symlink swap are all visible as a changed value — not just a
 *  content-hash miss that a mode-only or symlink-shaped plant would slip past. Never throws: an entry that
 *  vanishes or becomes unreadable between the `readdir` and this read fingerprints as `'gone'`. */
function fingerprintEntry(path) {
  let st;
  try { st = lstatSync(path); } catch { return 'gone'; }
  const mode = st.mode.toString(8);
  if (st.isSymbolicLink()) {
    let target = '(unreadable)';
    try { target = readlinkSync(path); } catch { /* keep the placeholder */ }
    return `symlink:${mode}:${target}`;
  }
  if (st.isFile()) {
    try {
      const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
      return `file:${mode}:${hash}`;
    } catch { return `file:${mode}:(unreadable)`; }
  }
  return `other:${mode}`;
}

/**
 * Read a lane's hook-plantable surface right now: a fingerprint of every entry directly under
 * `.git/hooks/`, plus a sha256 of the WHOLE `.git/config` file's text (not a parsed `hooksPath` line — a
 * single parsed line misses a duplicate/case-varied entry, an `[include]`/`includeIf`, or an unrelated new
 * `hook.<name>.command` entry a newer git might read; hashing the whole file catches any of those as "the
 * config changed", which is all the DETECTION layer needs — see the file header for why the PREVENTION layer
 * stays explicitly scoped to `core.hooksPath`). Read as plain file text, never through a `git config` query,
 * which would inherit {@link HOOKS_DISABLED_ENV} (when the caller applies it) and always answer the overridden
 * value regardless of what is actually on disk.
 *
 * Never throws: a missing `.git/hooks/` reads as `{}` (not itself suspicious — a fresh/shallow clone may have
 * none); a missing/unreadable `.git/config` reads `configHash: null`.
 * @param {string} dir - the lane's own checkout root (NOT `.git` itself).
 * @returns {{configHash: string|null, files: Record<string,string>}}
 */
export function snapshotHookSurface(dir) {
  const files = {};
  try {
    const hooksDir = join(dir, '.git', 'hooks');
    for (const name of readdirSync(hooksDir)) {
      files[name] = fingerprintEntry(join(hooksDir, name));
    }
  } catch { /* no .git/hooks/ at all — files stays {} */ }
  let configHash = null;
  try {
    configHash = createHash('sha256').update(readFileSync(join(dir, '.git', 'config'))).digest('hex');
  } catch { /* no .git/config — configHash stays null */ }
  return { configHash, files };
}

/**
 * Did a lane's hook-plantable surface change between two {@link snapshotHookSurface} reads? PURE, fail-closed:
 * a missing `before`/`after` (a caller that skipped taking one) reads as changed — this must never be the
 * quiet default that waves a run through.
 * @param {{configHash: string|null, files: Record<string,string>}|null|undefined} before
 * @param {{configHash: string|null, files: Record<string,string>}|null|undefined} after
 * @returns {{changed: boolean, reason: string}}
 */
export function hookSurfaceChanged(before, after) {
  if (!before || !after) return { changed: true, reason: 'the hook surface could not be read (a before or after snapshot is missing)' };
  if ((before.configHash ?? null) !== (after.configHash ?? null)) {
    return { changed: true, reason: '.git/config changed (hooksPath, an include, or some other entry)' };
  }
  const beforeFiles = before.files ?? {};
  const afterFiles = after.files ?? {};
  const names = new Set([...Object.keys(beforeFiles), ...Object.keys(afterFiles)]);
  const added = [];
  const removed = [];
  const modified = [];
  for (const name of names) {
    const b = beforeFiles[name];
    const a = afterFiles[name];
    if (b === undefined) added.push(name);
    else if (a === undefined) removed.push(name);
    else if (b !== a) modified.push(name);
  }
  if (added.length || removed.length || modified.length) {
    const parts = [];
    if (added.length) parts.push(`added: ${added.join(', ')}`);
    if (removed.length) parts.push(`removed: ${removed.join(', ')}`);
    if (modified.length) parts.push(`modified: ${modified.join(', ')}`);
    return { changed: true, reason: `.git/hooks/ changed — ${parts.join('; ')}` };
  }
  return { changed: false, reason: 'unchanged' };
}

/**
 * Force the lane's git-hook surface back to a known-safe baseline: delete every entry directly under
 * `.git/hooks/` that is not a `*.sample` file (git's own inert-template convention — these ship with every
 * `git init`/clone and are never executed), and pin `core.hooksPath=/dev/null` into the lane's OWN
 * `.git/config` ON DISK — belt and suspenders alongside {@link HOOKS_DISABLED_ENV}'s env override, so a
 * process that ever forgets to apply the env still inherits a repo-level override.
 *
 * Called BEFORE a worker ever runs (so a PREVIOUS dispatch's leftovers in a reused pooled lane can never be
 * silently inherited and blamed on the current run) and again after a detected tamper (so the lane is not left
 * poisoned for whoever uses it next). Best-effort and NEVER THROWS (every fs/git call here is try/caught) —
 * this is very often itself called from a caller already inside a cleanup/refusal path, where a throw would
 * skip the escalation/reporting that must still happen.
 *
 * @param {string} dir
 * @returns {{clean: boolean, leftover: string[], snapshot: {configHash: string|null, files: Record<string,string>}}}
 *   `clean: false` means the cleanup could not fully complete (a leftover non-sample hook file, or the config
 *   write failed) — a caller MUST treat that as "no safe baseline" and refuse before running any worker.
 */
export function resetHookSurface(dir) {
  try {
    const hooksDir = join(dir, '.git', 'hooks');
    for (const name of readdirSync(hooksDir)) {
      if (name.endsWith('.sample')) continue;
      try { rmSync(join(hooksDir, name), { force: true, recursive: true }); } catch { /* best-effort */ }
    }
  } catch { /* no .git/hooks/ at all — nothing to clean */ }
  let configOk = true;
  try {
    execFileSync('git', ['-C', dir, 'config', 'core.hooksPath', '/dev/null'], { stdio: 'ignore' });
  } catch { configOk = false; }
  const snapshot = snapshotHookSurface(dir);
  const leftover = Object.keys(snapshot.files).filter((name) => !name.endsWith('.sample'));
  return { clean: configOk && leftover.length === 0, leftover, snapshot };
}
