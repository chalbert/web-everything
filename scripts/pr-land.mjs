#!/usr/bin/env node
/**
 * pr-land.mjs — land a lane ref onto `main` via a SELF-APPROVED pull request (#2138 Fork 5, #2153).
 *
 * WHY: #2138 (ruled) moves lane landing onto PRs as the review/CI surface — each ready lane opens a
 * self-approved PR (`gh pr create`, 0 required reviewers + a required CI check, #2151/#2152) and the
 * custom drain merges it via `gh pr merge` in impl-first/WE-last couple-order. GitHub's NATIVE merge
 * queue stays OFF (it is branch-level and would reorder couples). This is the transport substrate the
 * drain command (#2162) calls; pure local `git merge` (push-if-green) is the retained fallback.
 *
 * This is the PR analogue of `push-if-green.mjs`: same flag / `emit` / exit-code conventions. Where
 * push-if-green ff-pushes an already-merged `main`, pr-land merges a `lane/*` ref INTO `main` through a
 * PR, so the merge rides GitHub's required-check gate (#2151 runs the SAME `check:standards`+suite on the
 * PR — one gate environment). Proven live by PR #4 (head `lane/fix-2165-ci-fui-checkout`, merged green).
 *
 * RULES (#2138 Fork 5):
 *  - Self-approved: `gh pr create` with NO reviewer; branch protection (#2152) requires 0 approvals + the
 *    `test` check, so the author merges their own PR once CI is green. Never requests a human review.
 *  - The DRAIN owns ordering, not GitHub: this merges ONE PR when called (`gh pr merge`, not `--auto` on a
 *    native queue). The caller (#2162 drain) sequences impl-first/WE-last across a couple.
 *  - Head is a `lane/*` ref (the #1934 guard carve-out) — never a local branch (guarded) and never a
 *    force-push. The ref is pushed to origin, the PR opened against `--base` (default `main`).
 *  - Wait for the required check before merging (default): poll `gh pr checks` until it passes; a failed
 *    check ABORTS the merge (never merge a red PR). `--no-wait` leaves it for a later drain pass.
 *  - Fallback: `--fallback-git` degrades to a local `git merge --no-ff` + push when `gh` is unavailable or
 *    the PR is unmergeable-and-not-recoverable — the coherent retained fallback (#2138 Fork 5 (a)).
 *  - Deletes the `lane/*` ref after a clean merge (`--delete-branch`), mirroring the integrator.
 *  - Self-heals NEW-item backlog id collisions after a clean merge (#2071), the SAME heal the parallel
 *    integrator runs — so every land route (this CLI, `/pr`, `/drain` which reuses this, a manual land)
 *    heals, not only the batch workflow. On post-merge `main` any two files claiming one NNN is an
 *    allocation collision; the just-merged (newest) file yields to the next free id via the sanctioned
 *    renumber-collisions script (NO `--base-ref` — see buildRenumberHealArgs), then the fix is gated +
 *    committed + pushed (never force-pushed). A heal problem is surfaced but NEVER fails the land (the merge
 *    already succeeded). `--no-heal` opts out.
 *
 * Usage:
 *   node scripts/pr-land.mjs --ref=lane/2153-pr-substrate                 # publish HEAD → lane ref, open self-approved PR, wait for `test`, merge, delete ref
 *   node scripts/pr-land.mjs --ref=lane/2153-… --sha=<commit>            # publish an explicit commit (default: HEAD) — no local branch is created (guarded)
 *   node scripts/pr-land.mjs --ref=lane/2153-… --base=main --method=merge # method ∈ merge|squash|rebase (default merge; the drain wants --no-ff history)
 *   node scripts/pr-land.mjs --ref=lane/… --no-wait                       # open the PR but don't merge (a later drain pass merges)
 *   node scripts/pr-land.mjs --ref=lane/… --dry-run                       # print the exact gh command sequence, execute nothing
 *   node scripts/pr-land.mjs --ref=lane/… --fallback-git                  # on gh failure / unmergeable, local git-merge + push instead
 *   node scripts/pr-land.mjs --ref=lane/… --no-heal                       # skip the post-land id-collision self-heal (#2071)
 *   node scripts/pr-land.mjs --ref=lane/… --json                          # machine-readable result
 *
 * Exit codes: 0 = merged (or opened with --no-wait / dry-run OK); 2 = required check RED (nothing merged);
 * 3 = unmergeable / gh error / push failed (nothing merged; recoverable — rebase the ref and re-run, or
 * pass --fallback-git). A non-zero exit means `main` was left UNTOUCHED.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

// ── flag parsing (mirrors push-if-green.mjs) ──────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flags = {};
for (const a of argv) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
}
const expandHome = (p) => (p && p.startsWith('~') ? p.replace(/^~/, homedir()) : p);
// Read a PR body from a file (the #2170 lane-review-composed body). Missing/unreadable → null (falls back
// to gh's --fill), never a hard failure: a body-file problem must not block a green landing.
function readBodyFile(p) {
  try { return readFileSync(expandHome(p), 'utf8'); } catch { return null; }
}

const REPO = resolve(expandHome(flags.repo) || process.cwd());
const REF = typeof flags.ref === 'string' ? flags.ref : null;
const SRC = typeof flags.sha === 'string' ? flags.sha : 'HEAD'; // source commit to publish to the lane ref (the lane clone's HEAD)
const BASE = typeof flags.base === 'string' ? flags.base : 'main';
const REMOTE = typeof flags.remote === 'string' ? flags.remote : 'origin';
const METHOD = typeof flags.method === 'string' ? flags.method : 'merge';
const WAIT = !flags['no-wait'];
const DRY_RUN = !!flags['dry-run'];
const FALLBACK_GIT = !!flags['fallback-git'];
const AS_JSON = !!flags.json;
const TITLE = typeof flags.title === 'string' ? flags.title : null;
// Body precedence: --body-file (a path — robust for the multi-line body the #2170 lane review composes,
// where the dismissed-findings block has newlines a CLI --body flag would mangle) wins over --body.
const BODY = typeof flags['body-file'] === 'string'
  ? readBodyFile(flags['body-file'])
  : (typeof flags.body === 'string' ? flags.body : null);
// Post-land id-collision self-heal (#2071, generalized to EVERY land route). After a clean merge, heal any
// NEW-item backlog id collision the land created against `main` (two files claiming one NNN) — the exact
// heal the parallel integrator runs at Phase 4b, now shared so `/pr`, `/drain` (which reuses this) AND a
// manual land all self-heal, not only the batch workflow. ON by default for a real land; `--no-heal` opts
// out. Never runs on --dry-run / --no-wait (nothing merged) by construction.
const HEAL = !flags['no-heal'];

// ── PURE helpers (unit-tested in scripts/__tests__/pr-land.test.mjs) ──────────────────────────────────

/** The `gh pr merge` method flag for a merge method (default merge = --no-ff history the drain wants). */
export function mergeMethodFlag(method) {
  switch (method) {
    case 'squash': return '--squash';
    case 'rebase': return '--rebase';
    case 'merge':
    default: return '--merge';
  }
}

/** Build the `gh pr create` args for a self-approved PR (NO reviewer). Emits `--title`/`--body` when supplied
 *  and NEVER drops a body: a `--body` present with no title still ships (the #2170 dismissals audit trail).
 *  `--fill` is used ONLY when NEITHER title nor body is given. Note `--fill` is unusable for the lane-ref
 *  transport anyway (it autofills by diffing the head LOCALLY, but a lane/* head is remote-only — no local
 *  branch to diff — so gh errors "ambiguous argument origin/main...lane/…"); the CLI therefore always
 *  DERIVES a title from the source commit's subject, so the `--fill`-only branch is a bare-call fallback the
 *  lane path never hits. Pure — returns the argv array for `gh`.
 *
 *  HEADLESS-SAFE (#2176): the argv must NEVER be title-only. A bare `gh pr create --title …` (no `--body`,
 *  no `--fill`) drops into an interactive body prompt and, run headless, errors "Command failed". So when a
 *  title is present but no body is given, we pass an explicit empty `--body ""` — never `--fill` (unusable
 *  for a remote-only lane/* head). Result: the create is always non-interactive. */
export function buildCreateArgs({ base, head, title, body }) {
  const args = ['pr', 'create', '--base', base, '--head', head];
  if (title != null) args.push('--title', title);
  // A title with no body must still carry a body — otherwise gh prompts interactively (fails headless, #2176).
  if (body != null) args.push('--body', body);
  else if (title != null) args.push('--body', '');
  if (title == null && body == null) args.push('--fill');
  return args;
}

/** Build the `gh pr merge` args — the drain merges ONE PR (not --auto on a native queue), deleting the
 *  lane ref after. Pure. */
export function buildMergeArgs({ pr, method }) {
  return ['pr', 'merge', String(pr), mergeMethodFlag(method), '--delete-branch'];
}

/** Build the argv for the post-land id-collision heal (#2071). Deliberately passes NO `--base-ref`: the
 *  batch integrator supplies one to shield ids inherited from a shared pre-claim base (a base id appearing
 *  twice there is a real edit conflict, not an allocation race). A SINGLE land runs the heal on POST-MERGE
 *  `main`, where any two files claiming one NNN is a genuine allocation collision and the just-merged file
 *  (highest git landing-ordinal) must yield — so a base guard is not merely unneeded but would wrongly SKIP
 *  a real collision. Pure — returns the `node` script argv. */
export function buildRenumberHealArgs() {
  return ['scripts/backlog-renumber-collisions.mjs', '--json'];
}

/**
 * Classify `gh pr checks --json state,bucket` output (array of check rows) into a merge decision. Pure.
 *  - `pending` — at least one check still running/queued → wait.
 *  - `failed`  — at least one check failed/cancelled/timed-out → ABORT (never merge a red PR).
 *  - `passed`  — every check passed/skipped and none pending → mergeable.
 * Buckets follow `gh`: pass | fail | pending | skipping | cancel.
 */
export function classifyChecks(rows) {
  const checks = Array.isArray(rows) ? rows : [];
  if (checks.length === 0) return { status: 'passed', reason: 'no required checks' };
  const bucket = (c) => c.bucket || c.state || '';
  const isFail = (b) => ['fail', 'cancel', 'timed_out', 'timeout'].includes(String(b).toLowerCase());
  const isPending = (b) => ['pending', 'queued', 'in_progress', 'waiting'].includes(String(b).toLowerCase());
  if (checks.some((c) => isFail(bucket(c)))) return { status: 'failed', reason: 'a required check failed' };
  if (checks.some((c) => isPending(bucket(c)))) return { status: 'pending', reason: 'a required check is still running' };
  return { status: 'passed', reason: 'all required checks passed' };
}

// Allow importing the pure helpers without running the CLI (the test file imports this module).
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_CLI) runCli();

function runCli() {
  const gitC = (args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const tryGit = (args) => { try { return gitC(args); } catch { return null; } };
  const ghC = (args) => execFileSync('gh', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

  function emit(result, exitCode) {
    if (AS_JSON) process.stdout.write(JSON.stringify(result) + '\n');
    else {
      const tag = result.merged ? '✓ merged' : result.reason === 'dry-run' ? '· dry-run' : result.reason === 'opened' ? '· opened (no-wait)' : '✗ not merged';
      process.stderr.write(`pr-land [${result.repo}] ${tag}: ${result.detail}\n`);
    }
    process.exit(exitCode);
  }

  if (!REF) emit({ repo: REPO, merged: false, reason: 'no-ref', detail: 'pass --ref=lane/<name> (the head ref to land onto ' + BASE + ')' }, 3);
  if (!/^lane\//.test(REF)) emit({ repo: REPO, merged: false, reason: 'bad-ref', detail: `--ref="${REF}" must be a lane/* ref (the #1934 guard carve-out) — never a local branch` }, 3);

  // 1. Resolve the SOURCE commit to publish (the lane clone's HEAD, or an explicit --sha). No local
  //    branch is created (that's guarded) — the lane model pushes `<source>:lane/<n>` straight to origin.
  const refSha = tryGit(['rev-parse', SRC]);
  if (!refSha) emit({ repo: REPO, merged: false, reason: 'no-such-src', detail: `source commit "${SRC}" not found — pass --sha=<commit> or run from a checkout whose HEAD carries the lane work` }, 3);

  // Derive a title when none was passed: `--fill` can't autofill for a lane/* head (it's remote-only, so
  // gh can't diff it locally). Use the source commit's subject — a meaningful, always-available title —
  // so the create never needs `--fill` and a `--body-file` (the #2170 dismissals) always ships. When the
  // source has multiple commits, its own HEAD subject is the natural PR title.
  const derivedTitle = TITLE ?? (tryGit(['log', '-1', '--format=%s', SRC]) || `land ${REF}`);
  const createArgs = buildCreateArgs({ base: BASE, head: REF, title: derivedTitle, body: BODY });
  const mergeArgsPreview = buildMergeArgs({ pr: '<pr>', method: METHOD });

  if (DRY_RUN) {
    emit({
      repo: REPO, merged: false, reason: 'dry-run', ref: REF, base: BASE, method: METHOD,
      plan: [
        `git push ${REMOTE} ${SRC}:refs/heads/${REF}   # publish the lane clone's ${SRC} (${refSha.slice(0, 8)}) to the lane ref`,
        `gh ${createArgs.join(' ')}`,
        WAIT ? 'poll: gh pr checks <pr> --json state,bucket  (wait until passed; abort on fail)' : '(--no-wait: skip check-wait, leave for a later drain pass)',
        WAIT ? `gh ${mergeArgsPreview.join(' ')}` : null,
        FALLBACK_GIT ? `fallback on failure: git merge --no-ff ${REMOTE}/${REF} + push ${REMOTE} ${BASE}` : null,
      ].filter(Boolean),
      detail: `would land ${SRC} (${refSha.slice(0, 8)}) onto ${BASE} via a self-approved PR from ${REF}`,
    }, 0);
  }

  // 2. Publish the source commit to the lane ref on origin (guard-safe: lane/*). Never force, no local branch.
  try { gitC(['push', REMOTE, `${SRC}:refs/heads/${REF}`]); }
  catch (e) { emit({ repo: REPO, merged: false, reason: 'push-failed', detail: `git push ${REMOTE} ${SRC}:refs/heads/${REF} failed (${String(e.message || e).split('\n')[0]})` }, 3); }

  // 3. Find an existing open PR for this head, else create a self-approved one.
  let prNum = null;
  try { prNum = JSON.parse(ghC(['pr', 'list', '--head', REF, '--state', 'open', '--json', 'number']))?.[0]?.number ?? null; } catch { /* gh may be absent */ }
  if (prNum == null) {
    try { const out = ghC(createArgs); prNum = (out.match(/\/pull\/(\d+)/) || [])[1] ?? null; }
    catch (e) { return ghFailed(`gh pr create failed (${String(e.message || e).split('\n')[0]})`); }
  }
  if (prNum == null) return ghFailed('could not determine the PR number after create');

  if (!WAIT) emit({ repo: REPO, merged: false, reason: 'opened', pr: Number(prNum), ref: REF, detail: `opened self-approved PR #${prNum} for ${REF}; --no-wait, a later drain pass merges it` }, 0);

  // 4. Wait until GitHub itself says the PR is ready, then merge. We gate on the AUTHORITATIVE
  //    `mergeStateStatus` (not a raw `gh pr checks` list) — a fresh PR's checks haven't registered yet, so
  //    an empty check list must NOT read as "passed" (that races the merge to a BLOCKED state). We ALSO
  //    read the REQUIRED checks so a genuinely-failed required check aborts fast instead of waiting out the
  //    timeout. Non-required checks (e.g. `cla`) never block: only the branch-protection required set does.
  //      CLEAN    → all required checks passed + up-to-date → merge.
  //      UNSTABLE → mergeable, but a NON-required check failed/pending → merge iff required checks passed.
  //      BLOCKED  → a required check is pending (wait) or failed (the required-check read aborts us).
  //      BEHIND   → strict "up-to-date" needs the ref rebased onto BASE → abort (recoverable; rebase+re-run).
  //      DIRTY    → real conflict → abort (the drain serial-replays / rebases).
  const deadlineMs = Date.now() + (Number(flags['timeout-min'] || 15) * 60_000);
  for (;;) {
    let view = {};
    try { view = JSON.parse(ghC(['pr', 'view', String(prNum), '--json', 'mergeable,mergeStateStatus'])); } catch { view = {}; }
    let required = [];
    try { required = JSON.parse(ghC(['pr', 'checks', String(prNum), '--required', '--json', 'state,bucket'])); } catch { required = []; }
    const reqVerdict = classifyChecks(required);
    const state = view.mergeStateStatus || 'UNKNOWN';

    if (view.mergeable === 'CONFLICTING' || state === 'DIRTY') emit({ repo: REPO, merged: false, reason: 'conflict', pr: Number(prNum), detail: `PR #${prNum} has merge conflicts with ${BASE} — ${BASE} left untouched (rebase the ref + re-run, or --fallback-git)` }, 3);
    if (reqVerdict.status === 'failed') emit({ repo: REPO, merged: false, reason: 'check-red', pr: Number(prNum), detail: `PR #${prNum} required check RED — ${reqVerdict.reason}; ${BASE} left untouched (fix + re-run)` }, 2);
    if (state === 'BEHIND') emit({ repo: REPO, merged: false, reason: 'behind', pr: Number(prNum), detail: `PR #${prNum} is behind ${BASE} (strict up-to-date) — rebase the ref onto ${BASE} + re-run` }, 3);
    // Ready: GitHub says mergeable AND every REQUIRED check has passed (empty required set only counts as
    // passed once GitHub itself is no longer BLOCKED — i.e. state is CLEAN/UNSTABLE, closing the race).
    if ((state === 'CLEAN' || state === 'UNSTABLE') && reqVerdict.status === 'passed') break;
    if (Date.now() > deadlineMs) emit({ repo: REPO, merged: false, reason: 'check-timeout', pr: Number(prNum), detail: `PR #${prNum} not ready past timeout (mergeStateStatus=${state}); leaving for a later drain pass` }, 3);
    execFileSync('sleep', ['20']);
  }

  try { ghC(buildMergeArgs({ pr: prNum, method: METHOD })); }
  catch (e) { return ghFailed(`gh pr merge #${prNum} failed (${String(e.message || e).split('\n')[0]}) — likely not-mergeable (branch behind ${BASE}); rebase the ref + re-run`); }

  const heal = HEAL ? runHeal() : null;
  if (heal && heal.warning) process.stderr.write(`pr-land [${REPO}] ⚠ ${heal.warning}\n`);
  emit({
    repo: REPO, merged: true, reason: 'merged', pr: Number(prNum), ref: REF, method: METHOD,
    healed: heal && heal.healed ? heal.renumbered : [],
    ...(heal && heal.warning ? { healWarning: heal.warning } : {}),
    detail: `merged PR #${prNum} (${REF}) into ${BASE} via self-approved PR (${METHOD}), deleted the ref`
      + (heal && heal.healed ? `; healed id collision(s): ${heal.renumbered.map((r) => `#${r.oldNum}→#${r.newNum}`).join(', ')}` : ''),
  }, 0);

  // Fallback path (#2138 Fork 5 (a)): local git merge + push when gh is the problem.
  function ghFailed(detail) {
    if (!FALLBACK_GIT) emit({ repo: REPO, merged: false, reason: 'gh-error', detail: `${detail} — pass --fallback-git for the local git-merge fallback` }, 3);
    try {
      tryGit(['fetch', REMOTE, `${REF}`, '--quiet']);
      gitC(['checkout', BASE]);
      gitC(['merge', '--no-ff', `${REMOTE}/${REF}`, '-m', `merge ${REF} (pr-land git fallback)`]);
      gitC(['push', REMOTE, `${BASE}:${BASE}`]);
      const heal = HEAL ? runHeal() : null;
      if (heal && heal.warning) process.stderr.write(`pr-land [${REPO}] ⚠ ${heal.warning}\n`);
      emit({ repo: REPO, merged: true, reason: 'merged-git-fallback', ref: REF, healed: heal && heal.healed ? heal.renumbered : [], ...(heal && heal.warning ? { healWarning: heal.warning } : {}), detail: `${detail}; landed ${REF} onto ${BASE} via the local git-merge fallback${heal && heal.healed ? `; healed id collision(s): ${heal.renumbered.map((r) => `#${r.oldNum}→#${r.newNum}`).join(', ')}` : ''}` }, 0);
    } catch (e) {
      emit({ repo: REPO, merged: false, reason: 'fallback-failed', detail: `${detail}; git-merge fallback ALSO failed (${String(e.message || e).split('\n')[0]}) — ${BASE} left untouched` }, 3);
    }
  }

  // Post-land id-collision heal (#2071, generalized). After a clean merge, sync to POST-MERGE ${BASE}
  // (detached — never rewriting a local branch, so an accidental --repo=<primary-with-work> can't be reset
  // out from under the user) and run the sanctioned renumber-collisions script with NO --base-ref: on
  // post-merge main any duplicate NNN is a real allocation collision and the newest (just-merged) file
  // yields. If it renumbered, gate the healed tree, then commit + push the fix (never force-pushed). A heal
  // problem is REPORTED but NEVER fails the land — the merge already succeeded; the worst case is a loudly-
  // surfaced residual a human resolves, exactly as the batch integrator's heal step behaves.
  function runHeal() {
    const firstLine = (e) => String((e && e.message) || e).split('\n')[0];
    const dirty = tryGit(['status', '--porcelain']);
    if (dirty && dirty.trim()) return { warning: `skipped id-collision heal — the checkout at ${REPO} has local changes (won't reset a dirty working tree); if the gate flags "ids must be unique", run scripts/backlog-renumber-collisions.mjs on ${BASE} by hand` };
    try {
      gitC(['fetch', REMOTE, BASE, '--quiet']);
      gitC(['checkout', '--detach', `${REMOTE}/${BASE}`]);
    } catch (e) { return { warning: `skipped id-collision heal — could not sync to ${REMOTE}/${BASE} (${firstLine(e)})` }; }
    let plan;
    try {
      const out = execFileSync('node', buildRenumberHealArgs(), { cwd: REPO, encoding: 'utf8' });
      plan = JSON.parse((out.trim().split('\n').filter(Boolean).pop()) || '{}');
    } catch (e) { return { warning: `id-collision heal could not run renumber-collisions (${firstLine(e)}) — if the gate flags "ids must be unique", run it by hand on ${BASE}` }; }
    const renumbered = Array.isArray(plan.renumbered) ? plan.renumbered : [];
    if (renumbered.length === 0) return { healed: false, renumbered: [] };
    const tag = renumbered.map((r) => `#${r.oldNum}→#${r.newNum}`).join(', ');
    // A collision was healed on disk — full-gate the healed tree before committing (never push a red heal).
    try { execFileSync('npm', ['run', 'check:standards'], { cwd: REPO, stdio: 'ignore' }); }
    catch { return { healed: false, renumbered, warning: `id collision healed (${tag}) but check:standards is RED on the healed tree — NOT pushed; fix on ${BASE} by hand` }; }
    const changed = (tryGit(['diff', '--name-only']) || '').split('\n').filter(Boolean);
    if (changed.length === 0) return { healed: false, renumbered };
    try {
      gitC(['add', ...changed]);
      gitC(['commit', '-m', `backlog: heal new-item id collision(s) on land (${tag}) (#2071)`]);
      gitC(['push', REMOTE, `HEAD:${BASE}`]);
    } catch (e) { return { healed: false, renumbered, warning: `id collision healed + committed but push to ${BASE} failed (${firstLine(e)}) — re-run pr-land or push by hand (no force-push)` }; }
    return { healed: true, renumbered };
  }
}
