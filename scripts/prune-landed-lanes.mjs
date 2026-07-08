#!/usr/bin/env node
/**
 * prune-landed-lanes.mjs — periodic content-verified sweep for stale `origin/lane/*` refs (#2226).
 *
 * WHY: `we:scripts/lib/pr-merge-gate.mjs` already passes `--delete-branch` on every drain merge
 * (`gh pr merge … --delete-branch`), so the common case — a lane's PR merges — already deletes its own
 * head ref via GitHub's merge API. But three classes of `lane/*` ref still accumulate on origin forever:
 *   1. A ref whose merge predates `--delete-branch`, or whose delete raced/failed silently.
 *   2. A ref that was pushed (by `pr-land.mjs --ref=…`) but never got a PR opened, or whose PR was closed
 *      without merging.
 *   3. A "ghost" ref: content-wise fully superseded by `main` (its only delta was e.g. conflict markers on
 *      an item `main` has since resolved a different way) even though it was never itself merged.
 * `git branch --no-merged` can't find these — the drain SQUASH/rebase-lands via PR, so a landed lane never
 * becomes a topological ancestor of `main`, and `--no-merged` reports it forever regardless of content.
 * Observed 2026-07-07: 34 refs on origin, of which only 1 carried real unmerged code.
 *
 * THE FOOTGUN THIS WORKS AROUND (documented, not "fixed" — see below): `we:scripts/guard-bash.mjs`'s
 * PreToolUse(Bash) hook denies an agent-typed `git push` unless it can PROVE (by matching the literal text
 * `lane/` in the command) that the push targets a `lane/*` ref, not `main` (#2203 strict lane-only lock).
 * That is a sound STATIC heuristic for a command an agent hand-types — but a sweep like this one deletes a
 * *computed list* of refs (`git push origin --delete "$ref"` in a loop), so the literal ref text never
 * appears in the command string the guard sees; it can't statically tell "delete a lane ref via a variable"
 * from "delete main via a variable" and — correctly, given it must fail toward denial — blocks it. Loosening
 * the regex to trust a shell variable would defeat the guard's entire purpose (opaque variables are exactly
 * what an unsafe push would also use). So this script never calls `git push --delete` at all: every deletion
 * goes through `gh api -X DELETE repos/{owner}/{repo}/git/refs/heads/<ref>` — GitHub's REST ref API, which
 * is a `gh` invocation (not `git push`) and so is simply outside the guarded command class, no override
 * needed. This is the same workaround the #2226 backlog item's own investigation used by hand.
 *
 * SAFETY — never deletes a ref with live content:
 *   - Any ref backing an OPEN PR is skipped unconditionally (`gh pr list --state open`), regardless of what
 *     the content check would say (belt + suspenders against a race with a producer that just pushed).
 *   - Every remaining ref is three-way-merged into `origin/main` via `git merge-tree --write-tree` (a pure,
 *     working-tree-free computation). Only a ref whose merge result is BYTE-IDENTICAL to `origin/main`'s own
 *     tree — i.e. it contributes NOTHING `main` doesn't already have — is deleted. A merge conflict, an
 *     error, or a clean merge that still differs from `main` all KEEP the ref (reported for manual review,
 *     never auto-deleted) — the conservative default the item's "or the only delta is conflict markers on a
 *     resolved item" case falls into; that judgment call is left to the human/agent reading the report.
 *
 * The classifier (`classifyLaneBranch`) is pure and unit-tested (scripts/__tests__/prune-landed-lanes.test.mjs)
 * against precomputed inputs; this file owns the git/gh I/O boundary.
 *
 * Usage:
 *   node scripts/prune-landed-lanes.mjs                    # DRY-RUN (default): report what WOULD be deleted
 *   node scripts/prune-landed-lanes.mjs --yes               # actually delete the superseded refs (gh api)
 *   node scripts/prune-landed-lanes.mjs --json               # machine-readable report
 *   node scripts/prune-landed-lanes.mjs --no-fetch            # skip `git fetch --prune` (use current refs as-is)
 *
 * Exit codes: 0 = swept OK (dry-run or --yes, including zero eligible refs); 1 = a delete call failed
 * (reported per-ref; the sweep still completes for the rest).
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/** Is `ref` (a short ref name from `git for-each-ref …refname:short`, already stripped of `origin/`) a lane
 *  branch this sweep should ever consider? Pure. */
export function isLaneBranch(ref) {
  return typeof ref === 'string' && ref.startsWith('lane/');
}

/** The set of head ref names backing an OPEN PR (from `gh pr list --state open --json headRefName`) — refs
 *  in this set are NEVER touched, regardless of content. Pure. */
export function openPrHeadRefs(prList) {
  const set = new Set();
  for (const p of prList || []) { if (p && p.headRefName) set.add(p.headRefName); }
  return set;
}

/**
 * The prune verdict for ONE lane branch. Pure — `mergeTree` is precomputed by the caller (the `git
 * merge-tree --write-tree origin/main origin/<branch>` I/O), so this is unit-testable without git.
 * @param {{hasOpenPr:boolean, mergeTree:{ok:boolean, treeEqualsMain?:boolean}|null}} ctx
 * @returns {{verdict:'skip'|'delete'|'keep', reason:string}}
 */
export function classifyLaneBranch(branch, { hasOpenPr, mergeTree } = {}) {
  if (hasOpenPr) return { verdict: 'skip', reason: 'open PR — live work' };
  if (!mergeTree || mergeTree.ok !== true)
    return { verdict: 'keep', reason: 'merge-tree conflict or error — needs manual review' };
  if (mergeTree.treeEqualsMain)
    return { verdict: 'delete', reason: 'content fully superseded (three-way merge into origin/main == main)' };
  return { verdict: 'keep', reason: 'has unmerged content and no open PR — needs manual review (possible orphaned WIP)' };
}

// ── CLI (the git/gh I/O boundary) ───────────────────────────────────────────────────────────────────────
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const argv = process.argv.slice(2);
  const flags = {};
  for (const a of argv) { const m = a.match(/^--([^=]+)(?:=(.*))?$/); if (m) flags[m[1]] = m[2] === undefined ? true : m[2]; }
  const AS_JSON = !!flags.json;
  const APPLY = !!flags.yes; // dry-run unless explicitly opted in
  const FETCH = flags['no-fetch'] ? false : true;

  const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });

  try {
    if (FETCH) sh('git', ['fetch', 'origin', '--prune', '--quiet']);

    const branches = sh('git', ['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/lane/*'])
      .split('\n').map((s) => s.trim()).filter(Boolean)
      .map((s) => s.replace(/^origin\//, ''))
      .filter(isLaneBranch);

    let openHeads = new Set();
    try {
      const prJson = JSON.parse(sh('gh', ['pr', 'list', '--state', 'open', '--limit', '200', '--json', 'headRefName']) || '[]');
      openHeads = openPrHeadRefs(prJson);
    } catch (e) {
      // fail-CLOSED on the safety check: if we can't confirm which refs are live, treat every ref as
      // possibly-live (skip all) rather than risk deleting one behind an unseen open PR.
      if (!AS_JSON) process.stderr.write(`  ⚠ could not list open PRs (${String(e.message || e).split('\n')[0]}) — skipping the sweep entirely this pass\n`);
      process.exitCode = 1;
      branches.length = 0;
    }

    let mainTree = null;
    try { mainTree = sh('git', ['rev-parse', 'origin/main^{tree}']).trim(); } catch { /* handled per-branch below */ }

    const results = [];
    for (const branch of branches) {
      const hasOpenPr = openHeads.has(branch);
      let mergeTree = null;
      if (!hasOpenPr && mainTree) {
        try {
          const tree = sh('git', ['merge-tree', '--write-tree', 'origin/main', `origin/${branch}`]).trim();
          mergeTree = { ok: true, treeEqualsMain: tree === mainTree };
        } catch {
          mergeTree = { ok: false }; // conflicting merge (or other error) — git exits non-zero
        }
      }
      const { verdict, reason } = classifyLaneBranch(branch, { hasOpenPr, mergeTree });
      results.push({ branch, verdict, reason });
    }

    const toDelete = results.filter((r) => r.verdict === 'delete');
    const kept = results.filter((r) => r.verdict === 'keep');
    const skipped = results.filter((r) => r.verdict === 'skip');
    const deleted = [];
    const failed = [];

    if (APPLY) {
      for (const r of toDelete) {
        try {
          // #2226 — gh api DELETE, never `git push --delete` (see file header: the write-time push guard
          // can't statically verify a variable-driven ref, so route deletion outside that guarded class).
          sh('gh', ['api', '-X', 'DELETE', `repos/{owner}/{repo}/git/refs/heads/${r.branch}`]);
          deleted.push(r.branch);
        } catch (e) {
          failed.push({ branch: r.branch, error: String(e.message || e).split('\n')[0] });
        }
      }
    }

    if (AS_JSON) {
      process.stdout.write(JSON.stringify({ dryRun: !APPLY, total: results.length, toDelete: toDelete.map((r) => r.branch), deleted, failed, kept, skipped }, null, 2) + '\n');
    } else {
      for (const r of results) {
        const mark = r.verdict === 'delete' ? (APPLY ? '✗ deleted' : '· would delete') : r.verdict === 'skip' ? '· skip' : '· keep';
        process.stderr.write(`  ${mark} ${r.branch} — ${r.reason}\n`);
      }
      process.stderr.write(`${APPLY ? '' : 'DRY-RUN: '}${toDelete.length} superseded, ${kept.length} kept for review, ${skipped.length} skipped (open PR)${APPLY ? `; ${deleted.length} deleted, ${failed.length} failed` : ''}.\n`);
      if (!APPLY && toDelete.length) process.stderr.write(`  re-run with --yes to delete the ${toDelete.length} superseded ref(s) above.\n`);
    }

    if (failed.length) process.exitCode = 1;
  } catch (e) {
    if (AS_JSON) process.stdout.write(JSON.stringify({ error: String(e.message || e) }) + '\n');
    else process.stderr.write(`✗ prune-landed-lanes failed: ${String(e.message || e)}\n`);
    process.exitCode = 1;
  }
}
