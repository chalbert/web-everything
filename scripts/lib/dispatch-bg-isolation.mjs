#!/usr/bin/env node
/**
 * @file scripts/lib/dispatch-bg-isolation.mjs
 * @description #x9fbg1x — TURN OFF Claude Code's OWN "background session hasn't isolated its changes" guard
 *   for DISPATCHED sessions (and lane clones generally) ONLY — never repo-wide.
 *
 *   THE INCIDENT (live, 2026-09-26): dispatched sessions `fix-2748`/`fix-2770` both sat `state: blocked,
 *   waitingFor: "permission prompt"`. `fix-2748`'s own transcript showed the real cause: Claude Code
 *   (>=2.1.283) refused its first Edit with *"This background session hasn't isolated its changes yet. Call
 *   EnterWorktree first…"*. `fix-2770` tried exactly that, and this repo's OWN single-branch-workflow guard
 *   denied the `git worktree add` it ran to comply — a genuine deadlock: obeying the CLI's guard is the one
 *   thing this repo's git guard never allows. The same message recurs across 43+ transcripts since 2026-08-29.
 *
 *   WHY THE EXISTING FIX (commit 63ac1da, 2026-08-17, "lane-pool already provides it") DID NOT CLOSE THIS: it
 *   set `worktree: {bgIsolation: "none"}` in the TRACKED, repo-wide `.claude/settings.json` — reaching a
 *   session only if its process actually STARTS somewhere that file is checked out. #4174 (2026-09-25,
 *   `we:scripts/operations/dispatch-lane-io.mjs#dispatchSessionCwd`) moved every dispatched session's start
 *   cwd to a bare SCRATCH directory (`.operations/dispatch/<sessionId>`) outside every checkout, specifically
 *   so a session could not dirty the daemon's own clone before acquiring a lane of its own — but that scratch
 *   directory carries no `.claude/settings.json` at all, so the repo-wide setting never reaches a freshly
 *   dispatched session in the first place. This is thus a REGRESSION #4174 introduced as a side effect, not a
 *   brand-new gap.
 *
 *   THE FIX, NARROWLY SCOPED (per this repo's own "never repo-wide" rule — an operator's own background
 *   session in the PRIMARY checkout genuinely is unisolated and should keep the guard):
 *     1. The tracked `.claude/settings.json` no longer carries `worktree` at all (see that file's own diff) —
 *        the primary checkout keeps the CLI's default guard.
 *     2. `we:scripts/operations/dispatch-lane-io.mjs` applies {@link DISPATCH_WORKTREE_SETTINGS} to every
 *        dispatched session's OWN scratch cwd only, via THIS module's {@link ensureWorktreeIsolationOff} — the
 *        SAME two-delivery-path pattern (a `--settings` CLI flag PLUS a durable `<cwd>/.claude/settings.local.
 *        json` write) `we:scripts/lib/gh-app-shim.mjs` already proved necessary for its own per-dispatch
 *        settings override (`--settings`'s JSON is a coin flip against the CLI's pre-warmed "spare" pool,
 *        which never re-applies it; the settings.local.json write is read fresh per task regardless).
 *     3. `we:scripts/lane-pool.mjs` applies the SAME override to every LANE CLONE it provisions/refreshes/
 *        acquires, via an UNTRACKED (`.gitignore`d) `.claude/settings.local.json` written INTO that clone —
 *        never the tracked file, never the primary checkout. This covers every session that ends up doing its
 *        actual work in a lane clone, dispatched or a human-driven single session alike (both already treat
 *        the lane clone itself as their isolation boundary — see docs/agent/platform-decisions.md
 *        #state-lives-where-its-nature-dictates and MEMORY rule "Edit-Work Runs In A Lane Clone").
 *
 *   NEVER BY TELLING A DISPATCHED SESSION'S OWN BRIEF TO RUN `git worktree add` ITSELF — this repo's
 *   single-branch-workflow guard (`we:scripts/guard-bash.mjs`) would only refuse it anyway (see `fix-2770`'s
 *   own transcript), and the lane clone already IS the isolation the CLI's guard exists to provide.
 *
 *   PURE CORE / IO SHELL, same law as `gh-app-shim.mjs`: {@link ensureWorktreeIsolationOff} is the one real
 *   write, best-effort and NEVER THROWING — a read-only checkout, a corrupt existing settings file (treated as
 *   empty, never fatal), or a full disk all resolve to `{ok:false}`, never an exception, so this can never be
 *   the reason a dispatch (or a lane provision) that would otherwise have gone out fine fails.
 */

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** The settings PATCH that disables Claude Code's own background-session isolation guard. Frozen — every
 *  caller merges this same literal value, never a hand-rolled equivalent. */
export const DISPATCH_WORKTREE_SETTINGS = Object.freeze({ worktree: Object.freeze({ bgIsolation: 'none' }) });

/**
 * Best-effort, NEVER THROWS: merges {@link DISPATCH_WORKTREE_SETTINGS} into `<cwd>/.claude/settings.local.
 * json`, creating the file (and the `.claude` dir) if neither exists yet. ADDITIVE — an existing file's other
 * top-level keys (e.g. the gh-shim's own `env` block, `we:scripts/lib/gh-app-shim.mjs#ensureSettingsFileEnv`)
 * and any other `worktree` sub-keys survive untouched; only `worktree.bgIsolation` is set/overwritten.
 * @param {{cwd:string, readFile?:Function, writeFile?:Function, mkdir?:Function}} o
 * @returns {{ok:boolean, path?:string, reason?:string}}
 */
export function ensureWorktreeIsolationOff({
  cwd, readFile = readFileSync, writeFile = writeFileSync, mkdir = mkdirSync,
} = {}) {
  if (!cwd) return { ok: false, reason: 'no-cwd' };
  const dir = join(cwd, '.claude');
  const path = join(dir, 'settings.local.json');
  try {
    mkdir(dir, { recursive: true });
    let existing;
    try { existing = JSON.parse(readFile(path, 'utf8')); } catch { existing = null; }
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) existing = {};
    const existingWorktree = existing.worktree && typeof existing.worktree === 'object' && !Array.isArray(existing.worktree)
      ? existing.worktree : {};
    const merged = { ...existing, worktree: { ...existingWorktree, ...DISPATCH_WORKTREE_SETTINGS.worktree } };
    writeFile(path, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
    return { ok: true, path };
  } catch (e) {
    return { ok: false, reason: 'write-failed', error: String((e && e.message) || e) };
  }
}

/** True iff `dir` already has the override on disk (best-effort read, never throws) — used only for
 *  diagnostics/tests; nothing in the real dispatch/lane-provision path needs to check before writing, since
 *  {@link ensureWorktreeIsolationOff} is already idempotent and additive. */
export function hasWorktreeIsolationOff(dir, { readFile = readFileSync } = {}) {
  try {
    const parsed = JSON.parse(readFile(join(dir, '.claude', 'settings.local.json'), 'utf8'));
    return parsed?.worktree?.bgIsolation === 'none';
  } catch {
    return false;
  }
}
