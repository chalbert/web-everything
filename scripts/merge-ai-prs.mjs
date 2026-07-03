#!/usr/bin/env node
/**
 * merge-ai-prs.mjs — sweep OPEN pull requests and merge the AI-generated ones that are safe to land.
 *
 * WHY: the deferred drain (`lane-drain.mjs`) is queue-scoped — it only lands couples in `queued.json`, never
 * an ORPHAN open PR (one opened directly by `/pr`, or by a peer session, with no queued work item). Those
 * accumulate. This sweep clears them: it lists open PRs, keeps only the ones that are UNAMBIGUOUSLY
 * AI-generated (EVERY commit co-authored by Claude), and merges the ones whose required `test` check is green
 * and that GitHub reports cleanly mergeable — via the SAME self-approved, non-admin `gh pr merge` the `/pr`
 * flow uses. It NEVER uses `--admin`, never force-merges, and refuses any PR with a human-authored commit.
 *
 * SAFETY (why this is not a rubber-stamp):
 *  - AI-generated gate: a PR qualifies ONLY if every commit carries the `Co-Authored-By: Claude …` trailer
 *    (surfaced by gh as a commit author with an anthropic identity). One human commit ⇒ the PR is skipped.
 *  - Green gate: the required `test` check must be SUCCESS. A missing/failed `test` ⇒ skipped. (`cla` /
 *    `Workers Builds` are non-required and ignored, matching branch protection + the /pr contract.)
 *  - Mergeable gate: GitHub's mergeStateStatus must be CLEAN or UNSTABLE (mergeable; only non-required checks
 *    red) and mergeable == MERGEABLE. BEHIND (needs rebase), DIRTY, BLOCKED, DRAFT ⇒ skipped and reported
 *    (a BEHIND PR is left for its author / a later rebase — the sweep never force-updates someone's branch).
 *  - Non-admin merge only: `gh pr merge <n> --merge --delete-branch`. If branch protection blocks it, that
 *    is surfaced, never overridden.
 *
 * Usage:
 *   node scripts/merge-ai-prs.mjs --dry-run            # list every open PR + the merge/skip verdict, merge NOTHING
 *   node scripts/merge-ai-prs.mjs --dry-run --json     # machine-readable verdicts
 *   node scripts/merge-ai-prs.mjs                       # merge every qualifying AI PR (green + cleanly mergeable)
 *   node scripts/merge-ai-prs.mjs --pr=12               # consider ONLY PR #12 (still subject to every gate)
 *   node scripts/merge-ai-prs.mjs --base=main           # restrict to PRs targeting <base> (default: any)
 *
 * Exit codes: 0 = swept (merged 0+ qualifying PRs, none failed); 2 = at least one merge attempt FAILED
 * (surfaced); 3 = bad input / `gh` unavailable.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const flags = {};
for (const a of argv) { const m = a.match(/^--([^=]+)(?:=(.*))?$/); if (m) flags[m[1]] = m[2] === undefined ? true : m[2]; }

// ── PURE helpers (unit-tested in scripts/__tests__/merge-ai-prs.test.mjs) ──────────────────────────────

/** An anthropic/Claude identity on a commit author (the `Co-Authored-By: Claude …` trailer gh surfaces as an
 *  author). Matches the name "Claude" or an anthropic email — the stamp every commit in an AI session carries. */
export function isAiAuthor(author) {
  if (!author) return false;
  const name = String(author.name || '').toLowerCase();
  const email = String(author.email || '').toLowerCase();
  return /\bclaude\b/.test(name) || email.includes('anthropic.com') || email.includes('noreply@anthropic');
}

/** A commit is AI if ANY of its authors (author + Co-Authored-By co-authors) is an AI identity. */
export function isAiCommit(commit) {
  const authors = Array.isArray(commit?.authors) ? commit.authors : [];
  // Fallback: some gh versions omit co-authors from `authors` but keep the trailer in the body.
  const bodyHasTrailer = /co-authored-by:\s*claude/i.test(String(commit?.messageBody || commit?.body || ''));
  return authors.some(isAiAuthor) || bodyHasTrailer;
}

/** A mechanical integration commit (`Merge branch 'main' …` / `Merge remote-tracking …` with an EMPTY body) —
 *  what `gh pr update-branch` / a rebase-on-behind creates. It carries no authored content, so it does not
 *  count as human work and must not disqualify an otherwise-AI PR. A merge commit WITH a body, or a
 *  `Merge pull request …`, is treated as a normal (must-be-AI) commit. */
export function isMechanicalMergeCommit(commit) {
  const head = String(commit?.messageHeadline || '').trim();
  const body = String(commit?.messageBody || '').trim();
  return /^Merge (branch|remote-tracking branch) /i.test(head) && body === '';
}

/** A PR is AI-generated ONLY if — ignoring mechanical merge commits — it has ≥1 substantive commit and EVERY
 *  substantive commit is AI (one human content commit disqualifies it). */
export function isAiGeneratedPr(pr) {
  const commits = Array.isArray(pr?.commits) ? pr.commits : [];
  const substantive = commits.filter((c) => !isMechanicalMergeCommit(c));
  return substantive.length > 0 && substantive.every(isAiCommit);
}

/** Is the required `test` check green on this PR's rollup? (Other checks — cla, Workers Builds — are ignored.) */
export function isRequiredCheckGreen(pr, requiredCheck = 'test') {
  const roll = Array.isArray(pr?.statusCheckRollup) ? pr.statusCheckRollup : [];
  const check = roll.find((c) => (c?.name || c?.context) === requiredCheck);
  if (!check) return false;
  const concl = String(check.conclusion || check.state || '').toUpperCase();
  return concl === 'SUCCESS';
}

/**
 * Classify one PR into a merge/skip verdict. Pure — no gh calls. Returns
 *   { num, title, decision: 'merge'|'skip', reason, aiGenerated, testGreen, state, mergeable }.
 * `decision === 'merge'` requires ALL of: AI-generated, required check green, mergeable, and a landable
 * mergeStateStatus (CLEAN or UNSTABLE). Anything else is a `skip` with the first failing reason.
 */
export function classifyPr(pr, { requiredCheck = 'test' } = {}) {
  const num = pr?.number;
  const title = pr?.title || '';
  const aiGenerated = isAiGeneratedPr(pr);
  const testGreen = isRequiredCheckGreen(pr, requiredCheck);
  const state = String(pr?.mergeStateStatus || '').toUpperCase();
  const mergeable = String(pr?.mergeable || '').toUpperCase();
  const landableState = state === 'CLEAN' || state === 'UNSTABLE'; // UNSTABLE = mergeable, only non-required checks red
  let decision = 'merge';
  let reason = 'AI-generated, required check green, cleanly mergeable';
  if (!aiGenerated) { decision = 'skip'; reason = 'not AI-generated (a commit lacks the Co-Authored-By: Claude trailer)'; }
  else if (!testGreen) { decision = 'skip'; reason = `required check "${requiredCheck}" is not green`; }
  else if (mergeable !== 'MERGEABLE') { decision = 'skip'; reason = `not mergeable (mergeable=${mergeable || 'UNKNOWN'})`; }
  else if (!landableState) { decision = 'skip'; reason = `merge state ${state || 'UNKNOWN'} (BEHIND⇒needs rebase, DIRTY/BLOCKED/DRAFT⇒not landable) — left for its author`; }
  return { num, title, decision, reason, aiGenerated, testGreen, state, mergeable };
}

// ── CLI boundary ───────────────────────────────────────────────────────────────────────────────────────
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) runCli();

function runCli() {
  const AS_JSON = !!flags.json;
  const DRY_RUN = !!flags['dry-run'];
  const REQUIRED = typeof flags.check === 'string' ? flags.check : 'test';
  const onlyPr = flags.pr != null ? String(flags.pr) : null;
  const base = typeof flags.base === 'string' ? flags.base : null;

  const fail = (reason, detail, code) => {
    if (AS_JSON) process.stdout.write(JSON.stringify({ ok: false, reason, detail }) + '\n');
    else process.stderr.write(`merge-ai-prs ✗ ${reason}: ${detail}\n`);
    process.exit(code);
  };

  // List open PRs WITHOUT commits (commits×authors×limit overflows GitHub's GraphQL node cap), then fetch each
  // candidate's commits per-PR — the rollup + mergeable come from the list; commits (the AI gate) come per PR.
  const listArgs = ['pr', 'list', '--state', 'open', '--limit', '100',
    '--json', 'number,title,headRefName,baseRefName,mergeable,mergeStateStatus,statusCheckRollup'];
  if (base) listArgs.push('--base', base);
  let prs;
  try { prs = JSON.parse(execFileSync('gh', listArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || '[]'); }
  catch (e) { fail('gh-error', `gh pr list failed (${String(e.message || e).split('\n')[0]}) — is gh authenticated?`, 3); }

  if (onlyPr) prs = prs.filter((p) => String(p.number) === onlyPr);
  // Attach each PR's commits (per-PR fetch avoids the node-cap overflow of asking for them in the list).
  for (const p of prs) {
    try { p.commits = JSON.parse(execFileSync('gh', ['pr', 'view', String(p.number), '--json', 'commits'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || '{}').commits || []; }
    catch { p.commits = []; } // no commits ⇒ isAiGeneratedPr → false → skipped (never merged on missing data)
  }
  const verdicts = prs.map((p) => classifyPr(p, { requiredCheck: REQUIRED }));
  const toMerge = verdicts.filter((v) => v.decision === 'merge');
  const skipped = verdicts.filter((v) => v.decision === 'skip');

  if (!AS_JSON) {
    for (const v of verdicts) process.stderr.write(`  ${v.decision === 'merge' ? '→ merge' : '· skip '} #${v.num} ${v.decision === 'skip' ? `(${v.reason})` : ''} — ${v.title}\n`);
    process.stderr.write(`${DRY_RUN ? 'DRY-RUN: ' : ''}${toMerge.length} AI PR(s) to merge, ${skipped.length} skipped.\n`);
  }

  const merged = [];
  const failedMerges = [];
  if (!DRY_RUN) {
    for (const v of toMerge) {
      try {
        execFileSync('gh', ['pr', 'merge', String(v.num), '--merge', '--delete-branch'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        merged.push(v.num);
        if (!AS_JSON) process.stderr.write(`  ✓ merged #${v.num}\n`);
      } catch (e) {
        failedMerges.push({ num: v.num, detail: String(e.message || e).split('\n')[0] });
        if (!AS_JSON) process.stderr.write(`  ✗ #${v.num} merge failed: ${String(e.message || e).split('\n')[0]}\n`);
      }
    }
  }

  // Sync the LOCAL main checkout to the just-advanced origin/main (a merged PR moved origin, not local). Best-
  // effort ff-only — a non-ff / dirty-tree collision aborts and is reported, never forced (never discards local
  // work). Only when something actually merged.
  let localSynced = false;
  if (!DRY_RUN && merged.length) {
    try { execFileSync('git', ['pull', '--ff-only'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); localSynced = true; }
    catch { localSynced = false; }
    if (!AS_JSON) process.stderr.write(localSynced ? `  ✓ pulled local main to origin\n` : `  · local main NOT fast-forwarded (diverged / dirty tree) — pull it by hand\n`);
  }

  const result = { ok: true, dryRun: DRY_RUN, considered: verdicts.length, toMerge: toMerge.map((v) => v.num), merged, failed: failedMerges, localSynced, skipped: skipped.map((v) => ({ num: v.num, reason: v.reason })) };
  if (AS_JSON) process.stdout.write(JSON.stringify(result) + '\n');
  process.exit(failedMerges.length ? 2 : 0);
}
