#!/usr/bin/env node
/**
 * guard-git-push.mjs — the git `pre-push` enforcement for the #2203 strict lane-only lock (LAYER 3, #2217).
 *
 * `we:scripts/guard-bash.mjs` (PreToolUse Bash) already blocks an AGENT-TYPED `git push` to `main`. But it is
 * blind to a SCRIPT's INTERNAL push — `we:scripts/pr-land.mjs` pushes to `main` via `execFileSync` on its
 * degraded paths (`--fallback-git`, the post-land heal / regen commits), which never passes through the Bash
 * tool, so the Bash guard never sees it. A git `pre-push` hook fires on EVERY push regardless of how it was
 * invoked (agent, script, or terminal), so it completes the "nothing reaches `main` ungated" guarantee.
 *
 * Wired via `.githooks/pre-push` + `core.hooksPath .githooks` (set by the `prepare` npm script). Reads the
 * standard pre-push stdin payload (one line per ref: `<localRef> <localSha> <remoteRef> <remoteSha>`) and
 * REJECTS (exit 1) when any pushed ref targets `refs/heads/main`. Sanctioned override — mirrors the Bash
 * guard — is `MAIN_PUSH_OK=1` in the env (pr-land sets it on its sanctioned main-pushes). A hook is bypassable
 * with `git push --no-verify`; that is accepted defence-in-depth alongside the Bash guard + branch protection.
 *
 * The decision is a pure function so it is unit-tested (scripts/__tests__/guard-git-push.test.mjs) without git.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/**
 * The remote refs in a pre-push stdin payload that target the protected branch. Pure. git feeds pre-push one
 * line per ref being pushed: `<localRef> SP <localSha> SP <remoteRef> SP <remoteSha>`. The `<remoteRef>` is the
 * destination (e.g. `refs/heads/main`); a delete push carries `(delete)`/zero local sha but the same remoteRef,
 * so a delete of `main` is caught too.
 * @returns {string[]} the matched remote refs (empty when nothing targets the protected branch).
 */
export function mainPushRefs(stdin, { protectedBranch = 'main' } = {}) {
  const matched = [];
  for (const line of String(stdin || '').split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3 || !parts[2]) continue; // need at least localRef localSha remoteRef
    const remoteRef = parts[2];
    if (remoteRef === `refs/heads/${protectedBranch}` || remoteRef === protectedBranch) matched.push(remoteRef);
  }
  return matched;
}

/**
 * The pre-push block decision. Pure. Returns a REASON string when the push must be rejected, else null.
 * @param {string} stdin  the raw pre-push stdin payload
 * @param {{override?:boolean, protectedBranch?:string}} opts  override = MAIN_PUSH_OK=1 was set
 */
export function pushGuardDecision(stdin, { override = false, protectedBranch = 'main' } = {}) {
  if (override) return null;
  const refs = mainPushRefs(stdin, { protectedBranch });
  if (refs.length === 0) return null;
  return `pre-push BLOCKED: a push targets \`${protectedBranch}\` (${refs.join(', ')}) — strict lane-only enforcement (#2203). `
    + `Every change reaches \`${protectedBranch}\` via a lane/* ref → PR → CI gate; a direct push bypasses it. `
    + `Push to a lane/* ref and land via pr-land. Sanctioned override (rare): set MAIN_PUSH_OK=1 (or git push --no-verify).`;
}

// ── CLI (the hook entrypoint) ────────────────────────────────────────────────────────────────────────────
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  let stdin = '';
  try { stdin = readFileSync(0, 'utf8'); } catch { stdin = ''; } // no readable stdin → nothing to block (fail-open on read error)
  const reason = pushGuardDecision(stdin, { override: process.env.MAIN_PUSH_OK === '1' });
  if (reason) { process.stderr.write(`✗ ${reason}\n`); process.exit(1); }
  process.exit(0);
}
