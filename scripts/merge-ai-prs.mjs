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
 * REBASE-DROP MANIFEST (#2198 — kills the "manifest lands then conflicts every other PR" wall). Every lane
 * writes `.lane-manifest.json` to the SAME repo-root path, so the first PR lands it and every OTHER open lane PR
 * then goes CONFLICTING on that one shared path (observed 2026-07-03: 1 landed, ~24 walled on the manifest
 * alone while real code merged clean). Before merging, a certified + green PR that is only CONFLICTING/BEHIND is
 * rebuilt onto main with the manifest dropped, via pure plumbing (merge-tree → temp-index write-tree →
 * commit-tree with main as FIRST parent → push to the `lane/*` ref, NO checkout — guard-safe). A real
 * (non-manifest) conflict is left as a skip for a human. The rebuilt tip re-runs `test`, so it lands on a later
 * watch pass; that is expected progress, not a merge failure. Disable with `--no-rebase-drop`. (Shared helper:
 * `scripts/lib/rebase-drop-manifest.mjs`, reused by `scripts/lane-resume.mjs land`.)
 *
 * WATCH (#2194 — /drain converges onto THIS lander). Bare, this is ONE cascade pass (`/drain`). With `--watch`
 * it becomes the long-lived monitor (`/drain watch`): it re-sweeps the labelled PRs on a fixed `--interval=N`
 * (default 30s), landing each the instant it becomes eligible (green + mergeable), in the same blockedBy
 * cascade order — so a producer that opens a ready-to-merge PR while the watch runs gets it landed on the next
 * poll. `--max-idle=N` bounds the follow: after N consecutive passes that merge nothing AND have nothing left
 * deferred, the watch exits 0 (an unbounded `--watch` runs until Ctrl-C). This retires the `queued.json` poll —
 * the label lander is now the single collection point for ALL producer output (`/workflow`, `/pr`, solo lanes).
 *
 * Usage:
 *   node scripts/merge-ai-prs.mjs --dry-run            # list every open PR + the merge/skip verdict, merge NOTHING
 *   node scripts/merge-ai-prs.mjs --dry-run --json     # machine-readable verdicts
 *   node scripts/merge-ai-prs.mjs                       # merge every qualifying AI PR (green + cleanly mergeable)
 *   node scripts/merge-ai-prs.mjs --pr=12               # consider ONLY PR #12 (still subject to every gate)
 *   node scripts/merge-ai-prs.mjs --base=main           # restrict to PRs targeting <base> (default: any)
 *   node scripts/merge-ai-prs.mjs --label=ready-to-merge # the /drain role: scope to producer-completed PRs, merge in blockedBy order
 *   node scripts/merge-ai-prs.mjs --label=ready-to-merge --dry-run # print the blockedBy-ordered merge plan, merge NOTHING
 *   node scripts/merge-ai-prs.mjs --label=ready-to-merge --watch --interval=30 # the /drain-watch monitor: poll + land as PRs go green (--max-idle=N bounds it)
 *
 * Exit codes: 0 = swept (merged 0+ qualifying PRs, none failed); 2 = at least one merge attempt FAILED
 * (surfaced); 3 = bad input / `gh` unavailable.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { rebaseDropManifest, gitRunner } from './lib/rebase-drop-manifest.mjs';

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

/** Does this PR carry the given label? (#2196 producer-certification signal, e.g. `ready-to-merge`.) The gh
 *  list surfaces labels as `[{ name }]`; tolerant of a missing/odd shape. Pure. */
export function hasLabel(pr, label) {
  if (!label) return false;
  const labels = Array.isArray(pr?.labels) ? pr.labels : [];
  return labels.some((l) => (typeof l === 'string' ? l : l?.name) === label);
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
 *   { num, title, decision: 'merge'|'skip', reason, aiGenerated, certifyLabel, testGreen, state, mergeable }.
 * `decision === 'merge'` requires ALL of: producer-certified, required check green, mergeable, and a landable
 * mergeStateStatus (CLEAN or UNSTABLE). Anything else is a `skip` with the first failing reason.
 *
 * PRODUCER CERTIFICATION (#2195, blockedBy #2196). "Certified" is EITHER of two independent signals:
 *   - the `trustLabel` (`ready-to-merge`) is present — the producer step (#2196: every AI-edit path applies it
 *     via the shared transport) certified the couple. This is the SOLE authorization the label lander scopes
 *     to, so a labelled PR is collected on green+mergeable ALONE — MIXED human+AI authorship is allowed (the
 *     over-strict every-commit-AI check wrongly skipped genuinely-AI PRs carrying one hand-authored commit,
 *     observed: #40/#42). Safe only because the label is exclusively producer-applied (#2196).
 *   - OR every substantive commit carries the `Co-Authored-By: Claude` trailer (`isAiGeneratedPr`) — the
 *     signal the bare `/merge` orphan sweep relies on, where NO label is present. This branch is UNCHANGED:
 *     an unlabelled mixed-authorship PR still SKIPS (strict gate preserved for the orphan sweep).
 * Pass `trustLabel: null` to force the strict every-commit gate regardless of labels.
 */
export function classifyPr(pr, { requiredCheck = 'test', trustLabel = 'ready-to-merge' } = {}) {
  const num = pr?.number;
  const title = pr?.title || '';
  const aiGenerated = isAiGeneratedPr(pr);
  const certifyLabel = hasLabel(pr, trustLabel);
  const certified = certifyLabel || aiGenerated; // #2195: the label OR the every-commit-AI trailer certifies
  const testGreen = isRequiredCheckGreen(pr, requiredCheck);
  const state = String(pr?.mergeStateStatus || '').toUpperCase();
  const mergeable = String(pr?.mergeable || '').toUpperCase();
  const landableState = state === 'CLEAN' || state === 'UNSTABLE'; // UNSTABLE = mergeable, only non-required checks red
  let decision = 'merge';
  let reason = certifyLabel ? `producer-certified (label "${trustLabel}"), required check green, cleanly mergeable` : 'AI-generated, required check green, cleanly mergeable';
  if (!certified) { decision = 'skip'; reason = `not AI-generated (a commit lacks the Co-Authored-By: Claude trailer) and no "${trustLabel}" label`; }
  else if (!testGreen) { decision = 'skip'; reason = `required check "${requiredCheck}" is not green`; }
  else if (mergeable !== 'MERGEABLE') { decision = 'skip'; reason = `not mergeable (mergeable=${mergeable || 'UNKNOWN'})`; }
  else if (!landableState) { decision = 'skip'; reason = `merge state ${state || 'UNKNOWN'} (BEHIND⇒needs rebase, DIRTY/BLOCKED/DRAFT⇒not landable) — left for its author`; }
  return { num, title, decision, reason, aiGenerated, certifyLabel, testGreen, state, mergeable };
}

/**
 * Is this SKIPPED verdict a rebase-drop-manifest candidate (#2198)? Pure. A PR that is producer-certified and
 * required-check-green but not landable ONLY because it is BEHIND/DIRTY/CONFLICTING is (almost always) blocked
 * by the shared `.lane-manifest.json` on that one repo-root path — the classic "manifest lands then conflicts
 * every other PR" wall. Such a PR is worth a `merge-tree` probe: if the only conflict is the manifest, the tip
 * is rebuilt onto main (manifest dropped) and it becomes landable. A real code conflict is left as the skip.
 * NOT a candidate: an un-certified PR (never auto-resolve someone's un-blessed branch), a red `test` (a real
 * bug, not a manifest artefact), or a non-rebasable state (BLOCKED/DRAFT — a human/branch-protection concern).
 */
export function isRebaseDropCandidate(v) {
  if (!v || v.decision !== 'skip') return false;
  const certified = !!(v.certifyLabel || v.aiGenerated);
  if (!certified || !v.testGreen) return false;
  const state = String(v.state || '').toUpperCase();
  const mergeable = String(v.mergeable || '').toUpperCase();
  return mergeable === 'CONFLICTING' || state === 'BEHIND' || state === 'DIRTY';
}

/**
 * #2183 first-lander leak fix — must an already-landable PR be rebuilt to DROP its `.lane-manifest.json`
 * BEFORE it merges? Every lane commits the transient manifest to its OWN tip so the drain can read cross-item
 * ordering off the ref; the rebase-drop (#2198) sheds it, but `isRebaseDropCandidate` only fires on a
 * CONFLICTING/BEHIND/DIRTY PR — so the FIRST PR of a batch (nothing to conflict with) merged CLEAN and carried
 * the manifest onto `main` (observed 2026-07-03: #79 leaked `.lane-manifest.json`). Any manifest-carrying PR
 * that is otherwise landable must therefore be stripped first, conflict or not. Pure — `v.hasManifest` is set
 * from the same `readPrManifest` probe that supplies the merge ordering. `--no-rebase-drop` still disables the
 * whole mechanism.
 */
export function needsManifestStripBeforeMerge(v) {
  return !!v && v.decision === 'merge' && !!v.hasManifest;
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

/** Bound a `--watch --interval=N` poll count. `--max-idle=N` (optional) exits after N consecutive idle passes
 *  (a pass that merged nothing AND has nothing deferred waiting); omitted → unbounded (until Ctrl-C). Pure. */
export function parseWatchOpts({ watch, interval, maxIdle } = {}) {
  const on = !!watch;
  const iv = Number.isFinite(Number(interval)) && Number(interval) > 0 ? Number(interval) : 30;
  const mi = Number.isFinite(Number(maxIdle)) && Number(maxIdle) >= 0 ? Number(maxIdle) : null;
  return { watch: on, intervalSec: iv, maxIdle: mi };
}

/** #2216 — should this OPEN PR be labelled now because its required check went green? Pure. Closes the lane-
 *  closure liveness gap: `pr-land --label-on-green` labels only if CI beats its `--timeout-min` wait; on a
 *  timeout the PR is left green-eventually-but-UNLABELLED and stranded. A post-CI reconcile pass labels it the
 *  moment the required check is green — no human step. Only the PRODUCER'S OWN work (AI-generated) is labelled,
 *  never a human orphan, and never a PR that already carries the label. */
export function shouldLabelOnGreen(pr, { requiredCheck = 'test', label = 'ready-to-merge' } = {}) {
  if (!label || hasLabel(pr, label)) return false;    // already labelled (or no label configured) → nothing to do
  if (!isAiGeneratedPr(pr)) return false;             // only the producer's own AI PRs — never a human orphan
  return isRequiredCheckGreen(pr, requiredCheck);     // label the instant the required check is green
}

/** #2230 — should a `--label`-scoped ONE-SHOT drain re-poll once before concluding the queue is empty? GitHub's
 *  `gh pr list --label` index lags the `gh pr edit --add-label` write by a few seconds, so a drain fired
 *  immediately after a producer labels can read the just-labelled PR as ABSENT ("0 to merge") and strand it.
 *  Re-poll ONCE when the labelled set found is smaller than expected — default threshold 1 (any at all), or
 *  `--expect=N`. Only for a label-scoped sweep (the race bites the bare one-shot; `--watch` self-heals on its
 *  next interval) and only once (never a busy-loop). Pure. `found` = the count of labelled PRs the sweep saw.
 *  @param {{label:string|null, found:number, expect?:number|null, retried:boolean}} o
 */
export function shouldRepollForLabelLag({ label, found, expect, retried } = {}) {
  if (!label || retried) return false;
  const threshold = Number.isFinite(Number(expect)) && Number(expect) > 0 ? Number(expect) : 1;
  return Number(found) < threshold;
}

/** Synchronous sleep (the CLI is fully synchronous — execFileSync throughout — so the watch loop blocks here
 *  between polls without an event loop). Uses Atomics.wait so it spawns nothing. */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(0, Math.trunc(ms)));
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
  // #2194 — /drain converges onto this lander: `--watch` turns the one-shot sweep into the long-lived monitor
  // (`/drain watch`), re-sweeping on `--interval=N`s and landing each PR the instant it goes green.
  const { watch: WATCH, intervalSec: INTERVAL, maxIdle: MAX_IDLE } = parseWatchOpts({ watch: flags.watch, interval: flags.interval, maxIdle: flags['max-idle'] });
  // #2198 — rebase-drop the shared `.lane-manifest.json` on land (ON by default; `--no-rebase-drop` disables).
  const REBASE_DROP = flags['no-rebase-drop'] ? false : true;
  // #2230 — re-poll the label-scoped one-shot once to absorb the `ready-to-merge` index-propagation lag.
  const EXPECT = flags.expect != null && Number.isFinite(Number(flags.expect)) ? Number(flags.expect) : null;
  const REPOLL_SEC = Number.isFinite(Number(flags['repoll-delay'])) && Number(flags['repoll-delay']) >= 0 ? Number(flags['repoll-delay']) : 4;
  // #2216 — before a label-scoped sweep, LABEL any green-but-unlabelled producer PR (a `pr-land --label-on-green`
  // that timed out left it stranded). ON by default for the label-scoped drain (it IS the reconcile point);
  // `--no-reconcile-labels` disables. Under `--watch` this re-labels each interval — the label applies the
  // moment CI goes green, with no human step.
  const RECONCILE = label && !flags['no-reconcile-labels'];

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

  // #2216 — POST-CI LABEL RECONCILE. Before the labelled sweep, label any green-but-unlabelled producer PR that
  // a `pr-land --label-on-green` timeout left stranded. Lists open PRs unfiltered by label, filters to the cheap
  // signals (unlabelled + required check green), confirms producer authorship per-candidate (commits), then adds
  // the label. Best-effort — a gh miss never fails the drain. Returns the labelled PR numbers.
  const reconcileGreenLabels = () => {
    if (!RECONCILE) return [];
    let open;
    try { open = JSON.parse(execFileSync('gh', ['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title,labels,statusCheckRollup'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || '[]'); }
    catch { return []; } // reconcile is best-effort; the real sweep below still hard-fails on a bad env
    const cheap = open.filter((p) => !hasLabel(p, label) && isRequiredCheckGreen(p, REQUIRED)); // green + unlabelled
    const labelled = [];
    for (const p of cheap) {
      let commits = [];
      try { commits = JSON.parse(execFileSync('gh', ['pr', 'view', String(p.number), '--json', 'commits'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || '{}').commits || []; } catch { continue; }
      if (!shouldLabelOnGreen({ ...p, commits }, { requiredCheck: REQUIRED, label })) continue;
      if (DRY_RUN) { labelled.push(p.number); if (!AS_JSON) process.stderr.write(`  🏷 #${p.number} would label "${label}" (required check green, was unlabelled)\n`); continue; }
      try { execFileSync('gh', ['pr', 'edit', String(p.number), '--add-label', label], { stdio: ['ignore', 'ignore', 'pipe'] }); labelled.push(p.number); if (!AS_JSON) process.stderr.write(`  🏷 #${p.number} labelled "${label}" (post-CI reconcile — required check went green after a label-on-green timeout)\n`); }
      catch { /* a label race/permission miss is non-fatal — the next pass retries */ }
    }
    return labelled;
  };

  // ── ONE sweep pass — reconcile labels → list → classify → cascade-merge → sync. Returns the pass result (no
  // emit/exit), so the watch loop can call it repeatedly. A gh-list failure still hard-fails (bad env).
  const sweepOnce = () => {
  const reconciledLabels = reconcileGreenLabels(); // #2216 — label green-but-unlabelled producer PRs first
  // List open PRs WITHOUT commits (commits×authors×limit overflows GitHub's GraphQL node cap), then fetch each
  // candidate's commits per-PR — the rollup + mergeable come from the list; commits (the AI gate) come per PR.
  const listArgs = ['pr', 'list', '--state', 'open', '--limit', '100',
    '--json', 'number,title,headRefName,baseRefName,mergeable,mergeStateStatus,statusCheckRollup,labels'];
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
    v.hasManifest = m != null; // #2183 — carries the transient manifest on its head → must be stripped before merge
  }
  // #2198 — rebase-drop the transient manifest so a certified+green PR that is only CONFLICTING/BEHIND on the
  // shared `.lane-manifest.json` path lands instead of walling the whole queue. Per candidate: merge-tree
  // main×lane; if the ONLY conflict is the manifest, rebuild its tip onto main (manifest dropped) via pure
  // plumbing (no checkout) and push to the lane/* ref — then it is CLEAN and the cascade merges it. A real code
  // conflict stays a skip. Dry-run only ANNOTATES (no push). Disable with `--no-rebase-drop`.
  const rebased = [];
  if (REBASE_DROP) {
    for (const v of verdicts) {
      // Rebuild-to-drop the manifest when the PR is BLOCKED on it (CONFLICTING/BEHIND) OR when it is already
      // landable but still CARRIES the manifest on its head (#2183 first-lander leak — a clean merge would
      // otherwise commit the transient file to `main`). Both cases route through the same plumbing.
      if (!isRebaseDropCandidate(v) && !needsManifestStripBeforeMerge(v)) continue;
      const laneRef = refByNum.get(String(v.num));
      if (!laneRef) continue;
      if (DRY_RUN) {
        v.rebaseDrop = 'would-attempt';
        if (!AS_JSON) process.stderr.write(`  ↻ #${v.num} would rebase-drop manifest (state ${v.state}/${v.mergeable}) then merge\n`);
        continue;
      }
      const r = rebaseDropManifest({ laneRef, base: 'origin/main', run: gitRunner });
      v.rebaseDrop = r.action;
      if (r.action === 'rebased') {
        v.decision = 'merge';
        v.reason = `rebased onto main${r.dropped ? ' (dropped manifest)' : ''}, required check green — landable`;
        rebased.push(v.num);
        if (!AS_JSON) process.stderr.write(`  ↻ #${v.num} rebased onto main${r.dropped ? ' (manifest dropped)' : ''} → ${r.newCommit.slice(0, 9)}\n`);
      } else if (!AS_JSON) {
        process.stderr.write(`  ↻ #${v.num} left skipped: ${r.reason}\n`);
      }
    }
  }

  const toMerge = verdicts.filter((v) => v.decision === 'merge');
  const skipped = verdicts.filter((v) => v.decision === 'skip');

  if (!AS_JSON) {
    for (const v of verdicts) process.stderr.write(`  ${v.decision === 'merge' ? '→ merge' : '· skip '} #${v.num} ${v.item ? `(#${v.item}${v.blockedBy.length ? ` ⤳ ${v.blockedBy.join(',')}` : ''}) ` : ''}${v.decision === 'skip' ? `(${v.reason})` : ''} — ${v.title}\n`);
    process.stderr.write(`${DRY_RUN ? 'DRY-RUN: ' : ''}${toMerge.length} AI PR(s) to merge${label ? ` (label "${label}")` : ''}, ${skipped.length} skipped.\n`);
  }

  const merged = [];
  const failedMerges = [];
  const pendingRebased = []; // #2198 — PRs rebuilt onto main this pass; CI re-running, land on a later pass
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
          const detail = String(e.message || e).split('\n')[0];
          const cc = remaining.find((x) => x.num === c.num); if (cc) cc.decision = 'skip'; // stays blocking its dependents; not retried this pass
          // #2198 — a PR we JUST rebuilt (rebase-drop) has a new head, so CI (`test`) is re-running; an immediate
          // merge is EXPECTED to bounce on pending checks. That is not a hard failure — the watch re-sweeps and
          // lands it the next pass once green. Only a merge failure on a PR we did NOT just touch is a real fault.
          if (c.rebaseDrop === 'rebased') {
            pendingRebased.push(c.num);
            if (!AS_JSON) process.stderr.write(`  ↻ #${c.num} rebuilt onto main — awaiting re-run of checks; will land on a later pass\n`);
          } else {
            failedMerges.push({ num: c.num, detail });
            if (!AS_JSON) process.stderr.write(`  ✗ #${c.num} merge failed: ${detail}\n`);
          }
        }
      }
      if (!progressed) break; // every ready candidate failed → stop (dependents stay deferred)
    }
    if (deferred.length && !AS_JSON) process.stderr.write(`  · ${deferred.length} deferred (blockedBy an unlanded PR): ${deferred.map((d) => `#${d.num}→[${d.waitOn.join(',')}]`).join(', ')}\n`);
  }

  // Sync the LOCAL main checkout to the just-advanced origin/main (a merged PR moved origin, not local) — local
  // main is KEPT UP TO DATE after each merge (user request 2026-07-03). `--autostash` is what makes this
  // reliable: under #2183 local main never diverges (edits land via PR, not direct commits), so the sync is a
  // pure fast-forward — but the working tree is almost always dirty (session-state like `claims.json`, mid-edit
  // docs), and a bare `pull --ff-only` aborts the ff the moment ANY incoming file is also locally-modified.
  // `--autostash` sets the dirty edits aside, fast-forwards, then reapplies them — so main advances AND local
  // edits are preserved. Still ff-only (never rebases/force — a genuine divergence aborts and is reported). The
  // rare case where a reapplied edit overlaps an incoming change surfaces a normal stash-pop conflict for the
  // human, rather than silently leaving main behind. Only when something actually merged.
  let localSynced = false;
  if (!DRY_RUN && merged.length) {
    try { execFileSync('git', ['pull', '--ff-only', '--autostash'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); localSynced = true; }
    catch { localSynced = false; }
    if (!AS_JSON) process.stderr.write(localSynced ? `  ✓ local main fast-forwarded to origin (autostash preserved local edits)\n` : `  · local main NOT fast-forwarded (diverged, or a reapplied local edit conflicts) — reconcile by hand\n`);
  }

  const result = { ok: true, dryRun: DRY_RUN, label, considered: verdicts.length, toMerge: toMerge.map((v) => v.num), merged, failed: failedMerges, rebased, pendingRebased, deferred, localSynced, reconciledLabels, skipped: skipped.map((v) => ({ num: v.num, reason: v.reason })) };
  return { result, merged, failedMerges, pendingRebased, deferred };
  }; // end sweepOnce

  // ── Driver — one sweep (the /drain one-shot + /merge bare), or the `--watch` monitor (`/drain watch`) ──────
  if (!WATCH) {
    let { result, failedMerges } = sweepOnce();
    // #2230 — the label index lags the producer's label write, so a one-shot fired right after labelling can see
    // the just-labelled PR as absent. Re-poll ONCE after a short delay before concluding the queue is empty.
    // Fail-soft: a still-empty re-poll is a legitimate empty queue, not an error.
    if (shouldRepollForLabelLag({ label, found: result.considered, expect: EXPECT, retried: false })) {
      if (!AS_JSON) process.stderr.write(`  · ${result.considered} labelled candidate(s)${EXPECT ? ` (< expected ${EXPECT})` : ''} — re-polling once in ${REPOLL_SEC}s (label index may lag the producer's label write)…\n`);
      sleepSync(REPOLL_SEC * 1000);
      ({ result, failedMerges } = sweepOnce());
    }
    if (AS_JSON) process.stdout.write(JSON.stringify(result) + '\n');
    process.exit(failedMerges.length ? 2 : 0);
  }

  // WATCH: re-sweep on a fixed interval, landing PRs as they become eligible, until `--max-idle` consecutive
  // idle passes (merged nothing AND nothing deferred waiting) — or forever if `--max-idle` is unset (Ctrl-C).
  if (!AS_JSON) process.stderr.write(`watch: polling ${label ? `label "${label}" ` : ''}every ${INTERVAL}s${MAX_IDLE != null ? ` (exit after ${MAX_IDLE} idle pass${MAX_IDLE === 1 ? '' : 'es'})` : ' (Ctrl-C to stop)'}…\n`);
  const passes = [];
  const allMerged = [];
  let idle = 0;
  let lastFailed = [];
  for (let pass = 1; ; pass++) {
    if (!AS_JSON) process.stderr.write(`── pass ${pass} ──\n`);
    const { result, merged, failedMerges, pendingRebased, deferred } = sweepOnce();
    passes.push(result);
    allMerged.push(...merged);
    lastFailed = failedMerges;
    // A pass that rebuilt a tip (pendingRebased) made progress — keep polling so it lands once CI re-runs.
    const idlePass = merged.length === 0 && deferred.length === 0 && pendingRebased.length === 0;
    idle = idlePass ? idle + 1 : 0;
    if (MAX_IDLE != null && idle >= MAX_IDLE) break;
    if (!AS_JSON) process.stderr.write(`  … pass ${pass}: merged ${merged.length}, deferred ${deferred.length}${idlePass ? ` (idle ${idle}${MAX_IDLE != null ? `/${MAX_IDLE}` : ''})` : ''} — next poll in ${INTERVAL}s\n`);
    sleepSync(INTERVAL * 1000);
  }
  if (!AS_JSON) process.stderr.write(`watch: stopped after ${passes.length} pass(es); merged ${allMerged.length} PR(s) total.\n`);
  if (AS_JSON) process.stdout.write(JSON.stringify({ ok: true, watch: true, label, interval: INTERVAL, maxIdle: MAX_IDLE, passes: passes.length, merged: allMerged, lastFailed }) + '\n');
  process.exit(lastFailed.length ? 2 : 0);
}
