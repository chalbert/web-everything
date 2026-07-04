/**
 * rebase-drop-manifest.mjs — the ONE proven "make a lane PR mergeable by rebasing onto main and dropping
 * the transient `.lane-manifest.json`" plumbing (#2198). Single source of truth, shared by the label
 * lander (`scripts/merge-ai-prs.mjs`, the `/drain`) and the resume finisher (`scripts/lane-resume.mjs land`,
 * #2202).
 *
 * WHY: every lane writes `.lane-manifest.json` to the SAME repo-root path. The first PR lands it on `main`;
 * every OTHER open lane PR then conflicts with `main` on that one shared path (modify/modify, or modify/delete
 * once it is stripped) — so a plain server-side `gh pr merge` lands at most ONE PR before the rest cascade to
 * CONFLICTING (observed 2026-07-03: one landed, ~24 went CONFLICTING on the manifest alone while the real code
 * merged clean). GitHub cannot auto-resolve it.
 *
 * FIX (proven this session): before merging each PR, rebuild its tip onto `main` with the manifest dropped,
 * using pure plumbing with NO branch checkout — so it stays inside the `guard-git-branch` single-branch rule
 * (pushing the rebuilt tip to a `lane/*` ref is already an allowed carve-out):
 *
 *   1. `git merge-tree --write-tree <base> <laneRef>`  → the merged tree (+ conflicted-file info on conflict).
 *   2. if the ONLY conflicted path is the manifest (or the merge is clean): read that tree into a TEMP index
 *      (`GIT_INDEX_FILE`, never touching HEAD/the working tree), `git rm --cached` the manifest,
 *      `git write-tree` → a resolved, manifest-free tree.
 *   3. `git commit-tree <tree> -p <base> -p <laneRef>` — `<base>` is the FIRST parent, so GitHub sees the
 *      branch as up-to-date (not BEHIND) and manifest-free (not CONFLICTING).
 *   4. push that commit to the `lane/*` ref (a fast-forward — the new commit has `<laneRef>` as an ancestor).
 *   → the caller then `gh pr merge`s the now-CLEAN PR.
 *
 * If `merge-tree` reports ANY conflict beyond the manifest, this returns `{ action: 'skip' }` — a real
 * conflict needs a human; the lander never force-resolves code.
 *
 * The orchestrator takes an injected `run(cmd, args, opts) -> { status, stdout, stderr }` so it is
 * unit-testable without a real repo (see `scripts/lib/__tests__/rebase-drop-manifest.test.mjs`).
 */

import { spawnSync } from 'node:child_process';

export const LANE_MANIFEST = '.lane-manifest.json';

/**
 * Parse `git merge-tree --write-tree` output. Pure.
 *   - Success (exit 0): stdout line 1 = the merged tree OID; no conflicts.
 *   - Conflict (exit ≠ 0): line 1 = the tree OID; a "Conflicted file info" block of
 *     `<mode> <object> <stage>\t<path>` lines follows (one line per unmerged stage, so a path repeats),
 *     terminated by a blank line before the informational messages.
 * @returns {{tree:string, clean:boolean, conflictPaths:string[]}} conflictPaths de-duplicated.
 */
export function parseMergeTree(stdout, exitCode) {
  const lines = String(stdout ?? '').split('\n');
  const tree = (lines[0] || '').trim();
  const clean = Number(exitCode) === 0;
  const paths = new Set();
  if (!clean) {
    for (const line of lines.slice(1)) {
      if (line.trim() === '') break; // blank line ends the conflicted-file-info block
      const m = line.match(/^\d{6} [0-9a-f]+ [0-3]\t(.+)$/);
      if (m) paths.add(m[1]);
    }
  }
  return { tree, clean, conflictPaths: [...paths] };
}

/**
 * Decide a merge-tree result's disposition wrt the transient manifest. Pure.
 *   'clean'         — no conflicts (the tip may still be BEHIND; the rebuild fast-forwards it).
 *   'manifest-only' — the ONLY conflicted path is the manifest → drop it and land.
 *   'real'          — a non-manifest path conflicts → a human must resolve; skip.
 * @param {{clean:boolean, conflictPaths:string[]}} parsed
 */
export function manifestConflictDisposition(parsed, manifest = LANE_MANIFEST) {
  if (parsed.clean) return 'clean';
  const paths = parsed.conflictPaths || [];
  if (paths.length === 0) return 'clean'; // exit≠0 but no parseable conflict paths → treat as no-op
  const nonManifest = paths.filter((p) => p !== manifest);
  if (paths.includes(manifest) && nonManifest.length === 0) return 'manifest-only';
  return 'real';
}

/** The default real git runner — `spawnSync` (NOT execFileSync) so a non-zero exit (merge-tree on conflict
 *  is exit 1, expected) is returned, not thrown. `opts.env` is merged over `process.env`. */
export function gitRunner(cmd, args, { env } = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', env: env ? { ...process.env, ...env } : process.env });
  return { status: r.status == null ? 1 : r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/**
 * Rebuild a lane PR's tip onto `<base>` with the manifest dropped, via pure plumbing. Does NOT merge (the
 * caller does). Returns one of:
 *   { action:'rebased', newCommit, dropped, base, laneRef } — pushed a manifest-free, up-to-date tip.
 *   { action:'skip',  reason, conflictPaths }               — a real (non-manifest) conflict; untouched.
 *   { action:'error', reason }                              — a plumbing step failed.
 *
 * @param {object} o
 * @param {string} o.laneRef            the lane ref name (e.g. `lane/batch-…-2198`) — pushed back to `refs/heads/<laneRef>`.
 * @param {string} [o.base='origin/main']
 * @param {string} [o.remote='origin']
 * @param {string} [o.readRef]          the ref to FEED the merge inputs (defaults to `<remote>/<laneRef>`);
 *                                       in a fresh clone (#2197) the bare `<laneRef>` does not resolve.
 * @param {boolean} [o.fetch=true]      fetch `<laneRef>` from `<remote>` first so `<remote>/<laneRef>` is current (#2231).
 * @param {string} [o.manifest='.lane-manifest.json']
 * @param {string} [o.message]          commit-tree message (defaults to a "drain: rebase … drop manifest" line).
 * @param {string} [o.tmpIndex]         temp index path for GIT_INDEX_FILE (default `.git/rebase-drop-index`).
 * @param {(cmd:string,args:string[],opts?:object)=>{status:number,stdout:string,stderr:string}} [o.run] injected runner.
 */
export function rebaseDropManifest({
  laneRef,
  base = 'origin/main',
  remote = 'origin',
  readRef,
  fetch = true,
  manifest = LANE_MANIFEST,
  message,
  tmpIndex = '.git/rebase-drop-index',
  run = gitRunner,
} = {}) {
  if (!laneRef) return { action: 'error', reason: 'no laneRef given' };

  // #2231 — in the isolated-clone drain model (#2197) the lane branch exists ONLY as the remote-tracking ref
  // `<remote>/<laneRef>`; the bare `<laneRef>` name does not resolve, so `merge-tree`/`commit-tree` given the
  // bare name fail with "not something we can merge" and the whole auto-rebase is inert. Fetch the lane ref
  // first (so the remote-tracking ref is current), then feed the RESOLVED `<remote>/<laneRef>` to the merge
  // inputs. The PUSH still targets the bare `refs/heads/<laneRef>` (that part was always correct).
  const mergeRef = readRef || `${remote}/${laneRef}`;
  if (fetch) {
    const f = run('git', ['fetch', remote, laneRef]);
    if (f.status !== 0) return { action: 'error', reason: `fetch ${laneRef} failed (${(f.stderr || '').split('\n')[0]})` };
  }

  const mt = run('git', ['merge-tree', '--write-tree', base, mergeRef]);
  const parsed = parseMergeTree(mt.stdout, mt.status);
  if (!parsed.tree) return { action: 'error', reason: `merge-tree produced no tree (${(mt.stderr || '').split('\n')[0]})` };

  const disp = manifestConflictDisposition(parsed, manifest);
  if (disp === 'real') return { action: 'skip', reason: `real conflict beyond ${manifest}`, conflictPaths: parsed.conflictPaths };

  // Build a resolved, manifest-free tree in a TEMP index — never touches HEAD or the working tree.
  const env = { GIT_INDEX_FILE: tmpIndex };
  const read = run('git', ['read-tree', parsed.tree], { env });
  if (read.status !== 0) return { action: 'error', reason: `read-tree failed (${(read.stderr || '').split('\n')[0]})` };
  // Drop the manifest if present (--ignore-unmatch: a clean merge with no manifest in the tree is fine).
  run('git', ['rm', '--cached', '--ignore-unmatch', manifest], { env });
  const wt = run('git', ['write-tree'], { env });
  const resolvedTree = String(wt.stdout || '').trim();
  if (wt.status !== 0 || !resolvedTree) return { action: 'error', reason: `write-tree failed (${(wt.stderr || '').split('\n')[0]})` };

  const msg = message || `drain: rebase ${laneRef} onto ${base}, drop transient ${manifest}`;
  const ct = run('git', ['commit-tree', resolvedTree, '-p', base, '-p', mergeRef, '-m', msg]);
  const newCommit = String(ct.stdout || '').trim();
  if (ct.status !== 0 || !newCommit) return { action: 'error', reason: `commit-tree failed (${(ct.stderr || '').split('\n')[0]})` };

  // Fast-forward push (newCommit descends from laneRef) to the guard-safe lane/* ref — no checkout.
  const push = run('git', ['push', remote, `${newCommit}:refs/heads/${laneRef}`]);
  if (push.status !== 0) return { action: 'error', reason: `push to ${laneRef} failed (${(push.stderr || '').split('\n')[0]})` };

  return { action: 'rebased', newCommit, dropped: disp === 'manifest-only', base, laneRef };
}
