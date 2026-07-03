#!/usr/bin/env node
/**
 * merge-ai-prs.mjs — sweep OPEN pull requests and merge the AI-generated ones that are safe to land.
 *
 * WHY: under #2183 every producer completes by opening a ready-to-merge PR; a lander merges them. This is that
 * lander. It lists open PRs, keeps only the ones that are UNAMBIGUOUSLY AI-generated (EVERY commit co-authored
 * by Claude), and merges the ones whose required `test` check is green and that GitHub reports cleanly
 * mergeable — via the SAME self-approved, non-admin `gh pr merge` the `/pr` flow uses. It NEVER uses `--admin`,
 * never force-merges, and refuses any PR with a human-authored commit.
 *
 * CONVERGENCE (#2188 — /merge ↔ drain become ONE label-scoped lander). Bare, it sweeps EVERY qualifying AI PR
 * (the `/merge` orphan sweep). With `--label ready-to-merge` it scopes to producer-completed PRs (the F1
 * signal) — the `/drain` role. Either way it now honours cross-item `blockedBy`: each PR's `.lane-manifest.json`
 * (read off its head ref) supplies its backlog `item` + `blockedBy`, and PRs merge in a **cascade** — a PR whose
 * blocker is still an open (unlanded) PR DEFERS until that blocker merges (mirrors the lane-drain `planWatch`
 * cascade). The PR merge IS the single clear point (the label leaves with the closed PR — no `queued.json`
 * unqueue). Orphan PRs (no manifest) have no `blockedBy` → always ready, so the bare sweep is unchanged.
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
 *   node scripts/merge-ai-prs.mjs --label=ready-to-merge # the /drain role: scope to producer-completed PRs, merge in blockedBy order
 *   node scripts/merge-ai-prs.mjs --label=ready-to-merge --dry-run # print the blockedBy-ordered merge plan, merge NOTHING
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

/**
 * Order a set of merge candidates for ONE cascade pass, honouring cross-item `blockedBy` (#2188). Pure.
 * This is the drain↔/merge convergence: the `ready-to-merge` label bounds the set, and each PR's
 * `.lane-manifest.json` (read off its head ref) supplies its backlog `item` + `blockedBy` items. A PR is
 * READY this pass only if none of its `blockedBy` items is still OPEN in the candidate set (an unlanded
 * blocker — whether a not-yet-merged sibling or a red/skip PR — defers its dependents, exactly like the
 * lane-drain `planWatch` cascade). Orphan PRs (no manifest → item null, blockedBy []) are always ready, so
 * this degrades to the legacy unordered sweep when nothing carries a manifest.
 *
 * @param {Array<{num:number, item:(number|null), blockedBy:number[], decision:'merge'|'skip'}>} candidates
 * @returns {{ready:Array, deferred:Array<{num,item,waitOn:number[]}>}}  ready is ordered (item asc, then PR#).
 */
export function planLabelDrain(candidates) {
  const list = Array.isArray(candidates) ? candidates : [];
  // Every candidate still in play keeps its item "open" — a red/skip blocker must still defer its dependents,
  // so the open set is ALL candidate items, not just the mergeable ones. (A merged item is removed by the
  // caller between passes, which is what frees the dependent.)
  const openItems = new Set(list.map((c) => c.item).filter((x) => x != null).map(Number));
  const ready = [];
  const deferred = [];
  for (const c of list) {
    if (c.decision !== 'merge') continue;
    const waitOn = (Array.isArray(c.blockedBy) ? c.blockedBy : []).map(Number).filter((b) => openItems.has(b));
    if (waitOn.length === 0) ready.push(c);
    else deferred.push({ num: c.num, item: c.item, waitOn });
  }
  ready.sort((a, b) => (Number(a.item ?? Infinity) - Number(b.item ?? Infinity)) || (a.num - b.num));
  return { ready, deferred };
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
  // #2188 — the drain↔/merge convergence: `--label ready-to-merge` scopes the sweep to producer-completed PRs
  // (the F1 signal), so this ONE lander serves both `/merge` (bare = every AI PR) and `/drain` (label-scoped +
  // manifest-ordered). Omit → the legacy sweep-all behaviour, unchanged.
  const label = typeof flags.label === 'string' ? flags.label : null;

  const fail = (reason, detail, code) => {
    if (AS_JSON) process.stdout.write(JSON.stringify({ ok: false, reason, detail }) + '\n');
    else process.stderr.write(`merge-ai-prs ✗ ${reason}: ${detail}\n`);
    process.exit(code);
  };

  // Read a PR's `.lane-manifest.json` off its head ref (#2188). Only a WE PR carries one (the producer writes
  // it into the WE lane commit); an orphan/impl PR has none → { item:null, blockedBy:[] } → always ready (the
  // legacy unordered behaviour). Best-effort: a fetch/parse miss degrades to no-manifest, never throws.
  const readPrManifest = (headRef) => {
    if (!headRef) return null;
    try { execFileSync('git', ['fetch', 'origin', headRef, '--quiet'], { stdio: ['ignore', 'ignore', 'ignore'] }); } catch { /* ref may be local */ }
    for (const rev of ['FETCH_HEAD', `origin/${headRef}`, headRef]) {
      try {
        const txt = execFileSync('git', ['show', `${rev}:.lane-manifest.json`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        const m = JSON.parse(txt);
        if (m && m.item != null) return m;
      } catch { /* try next rev */ }
    }
    return null;
  };

  // List open PRs WITHOUT commits (commits×authors×limit overflows GitHub's GraphQL node cap), then fetch each
  // candidate's commits per-PR — the rollup + mergeable come from the list; commits (the AI gate) come per PR.
  const listArgs = ['pr', 'list', '--state', 'open', '--limit', '100',
    '--json', 'number,title,headRefName,baseRefName,mergeable,mergeStateStatus,statusCheckRollup'];
  if (base) listArgs.push('--base', base);
  if (label) listArgs.push('--label', label);
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
  // #2188: attach each PR's manifest (backlog `item` + cross-item `blockedBy`) so the merge order honours
  // dependencies. Only WE PRs carry one; the rest degrade to no-manifest → always ready (legacy order).
  const refByNum = new Map(prs.map((p) => [String(p.number), p.headRefName]));
  for (const v of verdicts) {
    const m = readPrManifest(refByNum.get(String(v.num)));
    v.item = m && m.item != null ? Number(m.item) : null;
    v.blockedBy = m && Array.isArray(m.blockedBy) ? m.blockedBy.map(Number) : [];
  }
  const toMerge = verdicts.filter((v) => v.decision === 'merge');
  const skipped = verdicts.filter((v) => v.decision === 'skip');

  if (!AS_JSON) {
    for (const v of verdicts) process.stderr.write(`  ${v.decision === 'merge' ? '→ merge' : '· skip '} #${v.num} ${v.item ? `(#${v.item}${v.blockedBy.length ? ` ⤳ ${v.blockedBy.join(',')}` : ''}) ` : ''}${v.decision === 'skip' ? `(${v.reason})` : ''} — ${v.title}\n`);
    process.stderr.write(`${DRY_RUN ? 'DRY-RUN: ' : ''}${toMerge.length} AI PR(s) to merge${label ? ` (label "${label}")` : ''}, ${skipped.length} skipped.\n`);
  }

  const merged = [];
  const failedMerges = [];
  let deferred = [];
  if (DRY_RUN) {
    // Report the planned first-pass order (blockedBy-honoured) without merging.
    const plan = planLabelDrain(verdicts);
    deferred = plan.deferred;
    if (!AS_JSON) {
      process.stderr.write(`  merge order: ${plan.ready.map((c) => '#' + c.num + (c.item ? `→${c.item}` : '')).join(' → ') || '(none ready)'}\n`);
      if (deferred.length) process.stderr.write(`  deferred (blockedBy unlanded): ${deferred.map((d) => `#${d.num}→[${d.waitOn.join(',')}]`).join(', ')}\n`);
    }
  } else {
    // Cascade: merge every READY candidate in blockedBy order; a merged item leaves the open set, freeing its
    // dependents next pass (mirrors the lane-drain cascade). A merge FAILURE (red/behind) marks the PR `skip`
    // so it keeps blocking its dependents — never land past a broken blocker.
    let remaining = verdicts.map((v) => ({ ...v }));
    for (;;) {
      const plan = planLabelDrain(remaining);
      deferred = plan.deferred;
      if (!plan.ready.length) break;
      let progressed = false;
      for (const c of plan.ready) {
        try {
          execFileSync('gh', ['pr', 'merge', String(c.num), '--merge', '--delete-branch'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
          merged.push(c.num); progressed = true;
          remaining = remaining.filter((x) => x.num !== c.num); // merged → item leaves the open set (frees dependents)
          if (!AS_JSON) process.stderr.write(`  ✓ merged #${c.num}${c.item ? ` (#${c.item})` : ''}\n`);
        } catch (e) {
          failedMerges.push({ num: c.num, detail: String(e.message || e).split('\n')[0] });
          const cc = remaining.find((x) => x.num === c.num); if (cc) cc.decision = 'skip'; // stays blocking its dependents; not retried
          if (!AS_JSON) process.stderr.write(`  ✗ #${c.num} merge failed: ${String(e.message || e).split('\n')[0]}\n`);
        }
      }
      if (!progressed) break; // every ready candidate failed → stop (dependents stay deferred)
    }
    if (deferred.length && !AS_JSON) process.stderr.write(`  · ${deferred.length} deferred (blockedBy an unlanded PR): ${deferred.map((d) => `#${d.num}→[${d.waitOn.join(',')}]`).join(', ')}\n`);
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

  const result = { ok: true, dryRun: DRY_RUN, label, considered: verdicts.length, toMerge: toMerge.map((v) => v.num), merged, failed: failedMerges, deferred, localSynced, skipped: skipped.map((v) => ({ num: v.num, reason: v.reason })) };
  if (AS_JSON) process.stdout.write(JSON.stringify(result) + '\n');
  process.exit(failedMerges.length ? 2 : 0);
}
