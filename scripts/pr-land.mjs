#!/usr/bin/env node
/**
 * pr-land.mjs — the `/pr` PRODUCER: open a self-approved PR, wait for green, label it, and hand the merge to
 * the drain (#2138 Fork 5, #2153; #2290).
 *
 * SOLE WRITER TO MAIN (#2290). pr-land NO LONGER merges: the drain is the only route that runs `gh pr merge`.
 * The default path opens the self-approved PR, waits for required checks, labels it `ready-to-merge` when green,
 * then triggers a single-couple FAST DRAIN (`merge-ai-prs.mjs --only=<pr>`) so `/pr` still feels instant — the
 * drain lands it. The trigger is best-effort: if it can't land (e.g. review parks the PR), pr-land still exits
 * success with the PR labelled and the standalone drain picks it up later. The retained `--fallback-git` local
 * merge is ALSO a write to main, so it now routes through the shared gate (`scripts/lib/pr-merge-gate.mjs`,
 * caller 'pr-land') and is BLOCKED unless the documented `WE_MERGE_BREAK_GLASS=1` admin override is set.
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
 *   node scripts/pr-land.mjs --ref=lane/… --label-on-green                 # PRODUCER mode (#2199): open, WAIT for required checks, label ready-to-merge ONLY when green, hand merge to the drain
 *   node scripts/pr-land.mjs --ref=lane/… --no-wait                       # open the PR UNLABELLED, don't wait/merge (CI unconfirmed — the drain won't collect it until labelled)
 *   node scripts/pr-land.mjs --ref=lane/… --dry-run                       # print the exact gh command sequence, execute nothing
 *   node scripts/pr-land.mjs --ref=lane/… --fallback-git                  # on gh failure / unmergeable, local git-merge + push instead
 *   node scripts/pr-land.mjs --ref=lane/… --no-heal                       # skip the post-land id-collision self-heal (#2071)
 *   node scripts/pr-land.mjs --ref=lane/… --no-regen                      # skip the post-land derived-artifact regen (#2182)
 *   node scripts/pr-land.mjs --ref=lane/… --no-sync-primary               # skip the post-land ff-sync of the user's PRIMARY checkout to origin/main
 *   node scripts/pr-land.mjs --ref=lane/… --no-label                      # do NOT apply the ready-to-merge label (#2196) — e.g. a PR that must stay human-reviewed
 *   node scripts/pr-land.mjs --ref=lane/… --label=<name>                  # apply a different label than the default `ready-to-merge`
 *   node scripts/pr-land.mjs --ref=lane/… --json                          # machine-readable result
 *
 * READY-TO-MERGE LABEL (#2196/#2199). Every AI-edit path that opens a PR routes through THIS transport, so
 * pr-land is the single deliberate step that marks a couple "a producer certified this" (never applied by hand
 * casually). #2199: the label now means "required checks are GREEN", so it is applied ONLY after the green-wait
 * — NEVER eagerly at open. In the default (land) path and the `--label-on-green` producer path the label goes
 * on once the required checks pass; a bare `--no-wait` opens the PR UNLABELLED (CI unconfirmed). That label is
 * the universal signal the label lander (`/drain`, `scripts/merge-ai-prs.mjs --label=ready-to-merge`) collects,
 * whatever session shape (`/pr`, solo `#2123` lane, batch closeout, `/workflow`) produced the PR. `--no-label`
 * opts a PR out; label-apply is best-effort and never fails the land.
 *
 * Exit codes: 0 = merged (or opened --no-wait / labelled-on-green / dry-run OK); 2 = required check RED (nothing merged);
 * 3 = unmergeable / gh error / push failed (nothing merged; recoverable — rebase the ref and re-run, or
 * pass --fallback-git). A non-zero exit means `main` was left UNTOUCHED.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { healNnnCollision } from './lib/nnn-collision-heal.mjs';
import { assertMayMerge } from './lib/pr-merge-gate.mjs';

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
// Post-land derived-artifact regen (#2182). After a clean merge, regenerate the WE derived artifacts once
// (the AGENTS.md inventory block via gen:inventory; src/_data/referenceIndex.json via gen:reference-index)
// — the same generators the drain's Phase 4c runs, now folded into every land route so a `/pr`- or
// manually-landed change whose inputs feed a derived artifact never leaves `main` with stale output.
// Gate behind `--no-regen` to allow opt-out (mirrors `--no-heal`). Never runs on --dry-run / --no-wait.
const REGEN = !flags['no-regen'];
// Post-land primary-checkout sync. pr-land runs in a LANE clone; the drain that lands the PR ff-syncs THAT
// clone's local main, but the user's PRIMARY checkout (a separate directory) drifts behind origin/main on every
// land. After a land, fast-forward the primary too so it never lags what we just landed. Gate behind
// `--no-sync-primary` (mirrors --no-heal/--no-regen). Best-effort, never fails a land.
const SYNC_PRIMARY = !flags['no-sync-primary'];
// The producer-certified `ready-to-merge` label (#2196) — applied to every opened PR so the label lander
// (/drain) can collect ALL AI-generated work, whatever session opened it. `--no-label` opts out; `--label=<n>`
// overrides the name. Default on.
const LABEL = flags['no-label'] ? null : (typeof flags.label === 'string' ? flags.label : 'ready-to-merge');
// #2199 — the `ready-to-merge` label must mean "every required check is GREEN, the drain may land", never
// just "a local lint passed". `--label-on-green` is the producer mode: open the PR, WAIT for the required
// checks, apply the label ONLY once they pass, and STOP (hand the merge to the drain — do not merge here). It
// replaces the old fire-and-forget `--no-wait` (which labelled at open, before ANY CI — so red PRs entered the
// queue, observed 2026-07-03: #55/#57/#59/#67 labelled with a red `test`). In every mode the label is now
// applied only after the green-wait, never eagerly at open.
const LABEL_ON_GREEN = !!flags['label-on-green'];

// ── PURE helpers (unit-tested in scripts/__tests__/pr-land.test.mjs) ──────────────────────────────────

/**
 * Resolve the producer's land plan from the wait/label flags (#2199, #2290). Pure. pr-land NEVER merges any
 * more — the drain is the sole writer to main — so `mergeWhenGreen` is always false; the label is NEVER applied
 * before the required checks are green. The three modes:
 *   - `land`           (default): wait for required checks → label when green → TRIGGER a single-couple fast
 *     drain (`triggerDrain`) so /pr feels instant. Does NOT merge here.
 *   - `label-on-green` (`--label-on-green`): wait → label when green → STOP. Pure producer: does not trigger a
 *     drain (a batch/workflow closeout runs the standalone drain over the whole set).
 *   - `open-only`      (`--no-wait`, no label-on-green): open, do NOT wait, do NOT label → left for a drain
 *     that re-checks (an UNLABELLED PR — the label lander won't collect it until something labels it).
 * @returns {{waitForChecks:boolean, labelWhenGreen:boolean, mergeWhenGreen:boolean, triggerDrain:boolean, mode:string}}
 */
export function planPrLand({ wait, labelOnGreen } = {}) {
  if (labelOnGreen) return { waitForChecks: true, labelWhenGreen: true, mergeWhenGreen: false, triggerDrain: false, mode: 'label-on-green' };
  if (!wait) return { waitForChecks: false, labelWhenGreen: false, mergeWhenGreen: false, triggerDrain: false, mode: 'open-only' };
  return { waitForChecks: true, labelWhenGreen: true, mergeWhenGreen: false, triggerDrain: true, mode: 'land' };
}

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

/** Build the `gh pr edit --add-label` args that apply the producer-certified `ready-to-merge` label (#2196).
 *  Returns null when labelling is disabled (`--no-label`) or no PR number is known, so the caller can skip.
 *  Pure — returns the `gh` argv array (or null). */
export function buildAddLabelArgs({ pr, label }) {
  if (!label || pr == null) return null;
  return ['pr', 'edit', String(pr), '--add-label', label];
}

/** Build the argv for the post-land id-collision heal (#2071). Passes `--onto-ref=<pre-merge-main sha>` when
 *  known (#2213): the files already published on the branch being landed ONTO are immutable keepers, so the
 *  INCOMING lane's newly-created file is the only legitimate yielder. WITHOUT it the heal yields the highest
 *  git-ordinal file — correct for a same-batch parallel land (neither file is on main yet) but WRONG for a
 *  resume land where a lagging `lane/*` authored FIRST lands LAST: the already-published main item then has the
 *  higher ordinal and would be renumbered out from under everything that cites it. Pure — returns the argv. */
export function buildRenumberHealArgs({ ontoRef } = {}) {
  const args = ['scripts/backlog-renumber-collisions.mjs', '--json'];
  if (ontoRef) args.push(`--onto-ref=${ontoRef}`);
  return args;
}

/** The set of derived-artifact regen commands to run after a clean merge (#2182). Mirrors the drain's
 *  `DERIVED_REGEN` exactly — kept in lock-step so every land route (this CLI, `/pr`, `/drain` which reuses
 *  this) regenerates the same artifact set that the drain's Phase-4c step has always regenerated. Pure —
 *  returns an array of `[cmd, ...args]` tuples (same shape as `lane-drain.mjs`'s DERIVED_REGEN). */
export function buildRegenArgs() {
  return [
    ['npm', 'run', 'gen:inventory'],
    ['npm', 'run', 'gen:reference-index'],
  ];
}

/** #2225 — the post-land heal/regen dirty-probe. Both steps `git checkout --detach origin/main` and operate
 *  on POST-MERGE main, so untracked / git-ignored noise is irrelevant to their correctness — but a
 *  deps-symlinked lane clone (#2123, now the default solo-lane path) always carries an untracked `node_modules`
 *  SYMLINK (`.gitignore` has `node_modules/`, which matches a directory, not the symlink), so a bare
 *  `git status --porcelain` read as dirty and SKIPPED heal + regen on EVERY land from such a clone. Count only
 *  TRACKED modifications (which a detached checkout can carry over and wrongly sweep into the post-land commit);
 *  ignore untracked entries and any `node_modules` line. Feed it `git status --porcelain --untracked-files=no`.
 *  Pure. */
export function isPostLandTreeDirty(porcelainUntrackedNo) {
  return String(porcelainUntrackedNo || '')
    .split('\n')
    .some((l) => l.trim() !== '' && !/(^|[\s/])node_modules(\/|$|\s)/.test(l));
}

/** #2225 secondary hardening — which post-land steps genuinely SKIPPED (so a real skip can't read as "did
 *  everything"). A step's result carries `skipped: true` when its dirty-probe bailed. Pure. */
export function postLandSkips(heal, regen) {
  const s = [];
  if (heal && heal.skipped) s.push('heal');
  if (regen && regen.skipped) s.push('regen');
  return s;
}

/**
 * #2218 — build the post-land heal/regen report SUFFIX for the success line, safely. Pure. The merge has
 * already SUCCEEDED, so this must NEVER throw: `regen`/`heal` are `null` on the `--no-heal`/`--no-regen` opt-out
 * and, on a dirty-checkout skip, carry `{ skipped: true }` with empty `done`. Reading `regen.done.length`
 * unguarded there threw a TypeError that misreported a completed land as a failure (surfaced landing #75). Every
 * read is optional-chained and a skipped step reports "skipped" (not a crash) / a no-op reports "none".
 * @param {null|{skipped?:boolean, healed?:boolean, renumbered?:{oldNum,newNum}[]}} heal
 * @param {null|{skipped?:boolean, done?:string[], failed?:{cmd:string}[]}} regen
 * @returns {string} e.g. `; healed id collision(s): #2219→#2220; regenerated: none` (or `''` when nothing to say)
 */
export function postLandReport(heal, regen) {
  const parts = [];
  if (heal?.skipped) parts.push('id-collision heal: skipped (tracked-dirty tree)');
  else if (heal?.healed && heal.renumbered?.length) parts.push(`healed id collision(s): ${heal.renumbered.map((r) => `#${r.oldNum}→#${r.newNum}`).join(', ')}`);

  if (regen?.skipped) parts.push('derived-artifact regen: skipped (tracked-dirty tree)');
  else if (regen) {
    const done = regen.done?.length ?? 0;
    const failed = regen.failed?.length ?? 0;
    if (done > 0) parts.push(`regenerated: ${regen.done.join(', ')}`);
    else if (failed === 0) parts.push('regenerated: none');
    if (failed > 0) parts.push(`regen failed (non-fatal): ${regen.failed.map((f) => f.cmd).join(', ')}`);
  }
  return parts.length ? `; ${parts.join('; ')}` : '';
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
  // #2217 — pr-land is a SANCTIONED main-writer (fallback-git merge, post-land heal/regen). Those pushes go to
  // `main`, so they must carry the MAIN_PUSH_OK=1 override the new pre-push hook (guard-git-push.mjs) checks —
  // otherwise the strict-lock hook would block pr-land's own legitimate landing. Scoped to THESE calls only, so
  // any OTHER (rogue/buggy) push to main stays blocked. The initial lane/* push does NOT use this (not main).
  const gitPushMain = (args) => execFileSync('git', ['push', ...args], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MAIN_PUSH_OK: '1' } }).toString().trim();
  const tryGit = (args) => { try { return gitC(args); } catch { return null; } };
  const ghC = (args) => execFileSync('gh', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

  // #2290 — the single-couple FAST DRAIN pr-land shells after labelling green so /pr still feels instant. The
  // drain is the sole writer to main; scoping it to this ONE PR (+ --this-repo) lands the couple immediately
  // instead of waiting for a full standalone sweep. Resolved off this module's own dir so it works from any cwd.
  const DRAIN_SCRIPT = resolve(fileURLToPath(new URL('./merge-ai-prs.mjs', import.meta.url)));
  // Best-effort: a non-zero drain (e.g. review parks the PR, or gh hiccups) NEVER fails the land — the PR is
  // already labelled `ready-to-merge`, so the standalone drain lands it on a later pass. Inherits stderr so the
  // drain's own land/park narration surfaces under /pr.
  const triggerSingleCoupleDrain = (prNum) => {
    if (!LABEL) return { triggered: false, reason: 'no label (nothing for the drain to collect)' };
    try {
      execFileSync('node', [DRAIN_SCRIPT, `--only=${prNum}`, `--label=${LABEL}`, '--this-repo'], { cwd: REPO, stdio: ['ignore', 'inherit', 'inherit'] });
      return { triggered: true };
    } catch (e) {
      if (!AS_JSON) process.stderr.write(`pr-land [${REPO}] · single-couple drain for #${prNum} did not land it (${String(e.message || e).split('\n')[0]}) — it stays labelled ${LABEL}; the standalone drain lands it later\n`);
      return { triggered: true, landed: false, detail: String(e.message || e).split('\n')[0] };
    }
  };

  function emit(result, exitCode) {
    if (AS_JSON) process.stdout.write(JSON.stringify(result) + '\n');
    else {
      const tag = result.merged ? '✓ merged' : result.reason === 'dry-run' ? '· dry-run' : result.reason === 'opened' ? '· opened (no-wait)'
        : result.reason === 'enqueued' ? '✓ enqueued (drain lands it)' : result.reason === 'labelled-on-green' ? '✓ labelled (drain lands it)' : '✗ not merged';
      process.stderr.write(`pr-land [${result.repo}] ${tag}: ${result.detail}\n`);
    }
    process.exit(exitCode);
  }

  if (!REF) emit({ repo: REPO, merged: false, reason: 'no-ref', detail: 'pass --ref=lane/<name> (the head ref to land onto ' + BASE + ')' }, 3);
  if (!/^lane\//.test(REF)) emit({ repo: REPO, merged: false, reason: 'bad-ref', detail: `--ref="${REF}" must be a lane/* ref (the #1934 guard carve-out) — never a local branch` }, 3);

  // #2199 — resolve the land plan up front (wait/label/merge sequencing) so the dry-run plan reflects it too.
  const PLAN = planPrLand({ wait: WAIT, labelOnGreen: LABEL_ON_GREEN });

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

  if (DRY_RUN) {
    emit({
      repo: REPO, merged: false, reason: 'dry-run', ref: REF, base: BASE, method: METHOD,
      plan: [
        `git push ${REMOTE} ${SRC}:refs/heads/${REF}   # publish the lane clone's ${SRC} (${refSha.slice(0, 8)}) to the lane ref`,
        HEAL ? `pre-check: id-collision heal (renumber a lane new-item that reuses a ${BASE} id to a free GAP id, rebuild ${REF}) (#2222)` : '(--no-heal: skip pre-check id-collision heal)',
        `gh ${createArgs.join(' ')}`,
        PLAN.waitForChecks ? 'poll: gh pr view <pr> mergeStateStatus + gh pr checks <pr> --required  (wait until green; abort on red)' : '(--no-wait: skip check-wait, leave for a later drain pass)',
        // #2199 — the label is applied ONLY after the required checks are green, never eagerly at open.
        LABEL && PLAN.labelWhenGreen ? `gh pr edit <pr> --add-label ${LABEL}   # #2196 label — applied ONLY once required checks pass (#2199)` : (PLAN.mode === 'open-only' ? '(--no-wait: PR opened UNLABELLED — CI not confirmed green; use --label-on-green)' : '(--no-label)'),
        // #2290 — pr-land NEVER merges (the drain is the sole writer to main). The default path triggers a
        // single-couple fast drain so /pr stays instant; --label-on-green stops (a standalone drain lands it).
        PLAN.triggerDrain
          ? `node scripts/merge-ai-prs.mjs --only=<pr> --label=${LABEL || 'ready-to-merge'} --this-repo   # #2290 single-couple FAST DRAIN (the drain lands it — pr-land never merges)`
          : '(label-on-green: STOP after labelling — the standalone drain lands it; no direct merge here)',
        FALLBACK_GIT ? `fallback on failure (BREAK-GLASS only, WE_MERGE_BREAK_GLASS=1): git merge --no-ff ${REMOTE}/${REF} + push ${REMOTE} ${BASE}` : null,
      ].filter(Boolean),
      detail: `would open+label ${SRC} (${refSha.slice(0, 8)}) as a self-approved PR from ${REF}${PLAN.triggerDrain ? ' and trigger a single-couple drain' : ''} — the drain lands it onto ${BASE}`,
    }, 0);
  }

  // 2. Publish the source commit to the lane ref on origin (guard-safe: lane/*). Never force, no local branch.
  try { gitC(['push', REMOTE, `${SRC}:refs/heads/${REF}`]); }
  catch (e) { emit({ repo: REPO, merged: false, reason: 'push-failed', detail: `git push ${REMOTE} ${SRC}:refs/heads/${REF} failed (${String(e.message || e).split('\n')[0]})` }, 3); }

  // 2b. PRE-CHECK id-collision self-heal (#2222). BEFORE the required check runs, detect that this lane's NEW
  //     backlog item reuses an id already on `${BASE}` (the same-num allocation storm) and rebuild the lane tip
  //     with it renumbered to a free GAP id — so the FIRST CI run is already on the healed tip and goes green,
  //     instead of the merge blocking on `ids must be unique` (which would strand the post-merge heal, #2276).
  //     Pure plumbing on the lane ref (no checkout). Best-effort: a heal error is surfaced but never blocks the
  //     land (the same non-fatal contract as the post-merge heal). Gated by `--no-heal`.
  let precheckHealed = [];
  if (HEAL) {
    const h = healNnnCollision({ laneRef: REF, base: `${REMOTE}/${BASE}`, remote: REMOTE });
    if (h.action === 'rebased') {
      precheckHealed = h.renumbered || [];
      if (!AS_JSON) process.stderr.write(`pr-land [${REPO}] ↻ pre-check: renumbered new-item id collision(s) on ${REF} (${precheckHealed.map((r) => `#${r.oldNum}→#${r.newNum}`).join(', ')}) — CI runs on the healed tip\n`);
    } else if (h.action === 'error' && !AS_JSON) {
      process.stderr.write(`pr-land [${REPO}] ⚠ pre-check id-collision heal could not run (${h.reason}) — if the required check flags "ids must be unique", renumber the new item by hand\n`);
    }
  }

  // 3. Find an existing open PR for this head, else create a self-approved one.
  let prNum = null;
  try { prNum = JSON.parse(ghC(['pr', 'list', '--head', REF, '--state', 'open', '--json', 'number']))?.[0]?.number ?? null; } catch { /* gh may be absent */ }
  if (prNum == null) {
    try { const out = ghC(createArgs); prNum = (out.match(/\/pull\/(\d+)/) || [])[1] ?? null; }
    catch (e) { return ghFailed(`gh pr create failed (${String(e.message || e).split('\n')[0]})`); }
  }
  if (prNum == null) return ghFailed('could not determine the PR number after create');

  // 3b. The producer-certified `ready-to-merge` label (#2196) is the universal signal the label lander (/drain)
  //     collects. #2199: it must mean "required checks GREEN", so it is applied ONLY after the green-wait below
  //     — NEVER eagerly at open. `applyLabel()` is the deferred, best-effort apply (ensure the label exists,
  //     then add it; a failure is recorded but never aborts — the PR is already open).
  let labelApplied = false;
  const applyLabel = () => {
    const addLabelArgs = buildAddLabelArgs({ pr: prNum, label: LABEL });
    if (!addLabelArgs) return;
    try { ghC(['label', 'create', LABEL, '--color', '0E8A16', '--description', 'Producer-certified: required checks green, safe for the label lander (/drain) to merge']); } catch { /* already exists — fine */ }
    try { ghC(addLabelArgs); labelApplied = true; }
    catch (e) { if (!AS_JSON) process.stderr.write(`pr-land [${REPO}] · could not apply label "${LABEL}" to #${prNum} (${String(e.message || e).split('\n')[0]}) — land continues\n`); }
  };

  // open-only (`--no-wait`, no `--label-on-green`): open WITHOUT the label (nothing has confirmed it green) and
  // leave it. It stays UNLABELLED until CI is confirmed green — the label lander won't collect a red PR. A
  // producer that wants the drain to land it must use `--label-on-green` (wait → label when green → hand off).
  if (PLAN.mode === 'open-only') {
    if (!AS_JSON && LABEL) process.stderr.write(`pr-land [${REPO}] · #${prNum} opened UNLABELLED (--no-wait): use --label-on-green so the ${LABEL} label is applied only when required checks pass\n`);
    emit({ repo: REPO, merged: false, reason: 'opened', pr: Number(prNum), ref: REF, label: null, labelApplied: false, detail: `opened self-approved PR #${prNum} for ${REF} (--no-wait, UNLABELLED — CI not confirmed green)` }, 0);
  }

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

  // Required checks are GREEN — NOW apply the producer-certified label (#2199: never before this point).
  if (PLAN.labelWhenGreen) applyLabel();

  // #2290 — pr-land NEVER merges: the drain is the SOLE writer to main. In the DEFAULT (land) mode, trigger a
  // single-couple FAST DRAIN so /pr still feels instant — the drain lands THIS labelled PR immediately. Then
  // best-effort ff-sync the user's PRIMARY checkout to the just-advanced origin/main (a no-op if the drain
  // parked the PR instead of landing it). `--label-on-green` skips the trigger (a batch/workflow closeout runs
  // the standalone drain over the whole set). The trigger NEVER fails the land — the PR is labelled either way.
  let drainTrigger = null;
  let primarySynced = null;
  if (PLAN.triggerDrain) {
    drainTrigger = triggerSingleCoupleDrain(prNum);
    if (SYNC_PRIMARY) primarySynced = syncPrimaryMain();
  }
  emit({
    repo: REPO, merged: false, reason: PLAN.triggerDrain ? 'enqueued' : 'labelled-on-green',
    pr: Number(prNum), ref: REF, label: LABEL, labelApplied,
    ...(drainTrigger ? { drainTriggered: !!drainTrigger.triggered } : {}),
    ...(primarySynced !== null ? { primarySynced } : {}),
    ...(precheckHealed.length ? { precheckHealed } : {}),
    detail: `PR #${prNum} (${REF}) required checks green${labelApplied ? ` — labelled ${LABEL}` : ''}`
      + (precheckHealed.length ? `; pre-check healed id collision(s): ${precheckHealed.map((r) => `#${r.oldNum}→#${r.newNum}`).join(', ')}` : '')
      + (PLAN.triggerDrain ? '; triggered a single-couple drain (the drain lands it — pr-land never merges)' : '; left for the drain to land'),
  }, 0);

  // ff-sync the user's PRIMARY checkout after a land. The drain (a separate process, shelled by the trigger, or
  // the fallback-git merge below) advanced origin/main; the primary is a SEPARATE directory that otherwise
  // drifts behind origin/main on every land (the "N behind" a human then has to pull by hand). The lane→primary
  // link is the clone's git alternates: a lane is `git clone --reference <primary>`, so
  // `<REPO>/.git/objects/info/alternates` points at `<primary>/.git/objects` — strip the two trailing segments
  // to get the primary root. Returns:
  //   null  — nothing to sync (REPO is not a lane clone, or IS the primary)
  //   true  — primary fast-forwarded (or already up-to-date)
  //   false — skipped/failed (primary not on BASE, or a genuine divergence) — REPORTED, never fatal.
  // ff-only + --autostash: advance main, preserve the user's dirty/session-state edits, never force/rebase.
  function syncPrimaryMain() {
    let primary;
    try {
      const alt = readFileSync(resolve(REPO, '.git/objects/info/alternates'), 'utf8').trim().split('\n')[0];
      if (!alt) return null;                       // no alternates content
      primary = resolve(alt, '..', '..');          // <primary>/.git/objects → <primary>
    } catch { return null; }                       // no alternates file → REPO is not a lane clone
    try { if (realpathSync(primary) === realpathSync(REPO)) return null; } // running FROM the primary — already synced
    catch { return null; }
    const atPrimary = (args) => execFileSync('git', ['-C', primary, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    // Only fast-forward a primary that is actually on BASE — never yank a detached / feature checkout out from under the user.
    let branch = null; try { branch = atPrimary(['rev-parse', '--abbrev-ref', 'HEAD']); } catch { /* unknown */ }
    if (branch !== BASE) {
      if (!AS_JSON) process.stderr.write(`pr-land [${REPO}] · primary checkout (${primary}) not on ${BASE} (on ${branch || 'unknown'}) — skipped primary ff-sync; pull it by hand\n`);
      return false;
    }
    try { atPrimary(['pull', '--ff-only', '--autostash']); return true; }
    catch { if (!AS_JSON) process.stderr.write(`pr-land [${REPO}] · primary ${BASE} (${primary}) NOT fast-forwarded (diverged, or a reapplied local edit conflicts) — pull it by hand\n`); return false; }
  }

  // Fallback path (#2138 Fork 5 (a)): local git merge + push when gh is the problem. #2290 — this is ALSO a
  // write to main, so it routes through the shared gate as caller 'pr-land': the gate BLOCKS it (throws) unless
  // the documented `WE_MERGE_BREAK_GLASS=1` admin override is armed. i.e. --fallback-git is now break-glass-only
  // (the drain is the sole normal-path writer to main); the gate's throw surfaces as a `fallback-failed` emit.
  function ghFailed(detail) {
    if (!FALLBACK_GIT) emit({ repo: REPO, merged: false, reason: 'gh-error', detail: `${detail} — pass --fallback-git for the local git-merge fallback` }, 3);
    try {
      // #2290 — assert this route may write to main BEFORE touching git (blocked unless break-glass, and a
      // break-glass use emits the loud audit line). Capture the pre-merge base sha for the heal's onto-ref.
      assertMayMerge({ caller: 'pr-land', pr: null, repo: REPO });
      const preMergeBaseSha = tryGit(['rev-parse', `${REMOTE}/${BASE}`]) || null;
      tryGit(['fetch', REMOTE, `${REF}`, '--quiet']);
      gitC(['checkout', BASE]);
      gitC(['merge', '--no-ff', `${REMOTE}/${REF}`, '-m', `merge ${REF} (pr-land git fallback)`]);
      gitPushMain([REMOTE, `${BASE}:${BASE}`]);
      if (SYNC_PRIMARY) syncPrimaryMain(); // ff-sync the user's primary checkout too (the lane's local BASE is already merged)
      const heal = HEAL ? runHeal({ ontoRef: preMergeBaseSha }) : null;
      if (heal && heal.warning) process.stderr.write(`pr-land [${REPO}] ⚠ ${heal.warning}\n`);
      const regen = REGEN ? runRegen() : null;
      if (regen && regen.warning) process.stderr.write(`pr-land [${REPO}] ⚠ ${regen.warning}\n`);
      const skipped = postLandSkips(heal, regen);
      if (skipped.length) process.stderr.write(`pr-land [${REPO}] ⚠⚠ POST-LAND ${skipped.join(' + ')} SKIPPED (tracked-dirty tree) — ${BASE} may carry an unhealed id collision / stale derived artifacts; run the steps by hand.\n`);
      emit({ repo: REPO, merged: true, reason: 'merged-git-fallback', ref: REF, healed: heal && heal.healed ? heal.renumbered : [], ...(heal && heal.warning ? { healWarning: heal.warning } : {}), regenDone: regen ? regen.done : [], regenFailed: regen ? regen.failed : [], ...(regen && regen.warning ? { regenWarning: regen.warning } : {}), ...(skipped.length ? { skipped } : {}), detail: `${detail}; landed ${REF} onto ${BASE} via the local git-merge fallback${postLandReport(heal, regen)}` }, 0);
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
  function runHeal({ ontoRef = null } = {}) {
    const firstLine = (e) => String((e && e.message) || e).split('\n')[0];
    // #2225 — ignore untracked/git-ignored noise (the deps-symlinked clone's `node_modules` symlink); skip only
    // on a genuinely TRACKED-dirty tree (a detached checkout could carry those edits into the heal commit).
    if (isPostLandTreeDirty(tryGit(['status', '--porcelain', '--untracked-files=no']))) return { skipped: true, warning: `skipped id-collision heal — the checkout at ${REPO} has TRACKED local changes (won't reset a dirty working tree); if the gate flags "ids must be unique", run scripts/backlog-renumber-collisions.mjs on ${BASE} by hand` };
    try {
      gitC(['fetch', REMOTE, BASE, '--quiet']);
      gitC(['checkout', '--detach', `${REMOTE}/${BASE}`]);
    } catch (e) { return { warning: `skipped id-collision heal — could not sync to ${REMOTE}/${BASE} (${firstLine(e)})` }; }
    let plan;
    try {
      const out = execFileSync('node', buildRenumberHealArgs({ ontoRef }), { cwd: REPO, encoding: 'utf8' });
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
      gitPushMain([REMOTE, `HEAD:${BASE}`]);
    } catch (e) { return { healed: false, renumbered, warning: `id collision healed + committed but push to ${BASE} failed (${firstLine(e)}) — re-run pr-land or push by hand (no force-push)` }; }
    return { healed: true, renumbered };
  }

  // Post-land derived-artifact regen (#2182). After a clean merge, run the same deterministic generators
  // the drain's Phase 4c runs — once per land so every land route (this CLI, `/pr`, `/drain`) keeps `main`
  // free of stale derived output. Mirrors the drain's `regenDerived()`: best-effort, never fatal. If
  // anything changed, commit + push (the generators are deterministic — a diff means the inputs changed).
  // A regen problem is REPORTED but NEVER fails the land (the merge already succeeded).
  function runRegen() {
    const firstLine = (e) => String((e && e.message) || e).split('\n')[0];
    // Sync to post-merge main so we regenerate against the LANDED tree (same tree the drain regen targets).
    // Skip only if TRACKED-dirty (#2225) — untracked noise like the deps-symlinked clone's `node_modules`
    // symlink is irrelevant; a tracked-dirty tree could be generating against uncommitted input, which is wrong.
    if (isPostLandTreeDirty(tryGit(['status', '--porcelain', '--untracked-files=no']))) return { done: [], failed: [], skipped: true, warning: `skipped derived-artifact regen — the checkout at ${REPO} has TRACKED local changes; run npm run gen:inventory && npm run gen:reference-index on ${BASE} by hand` };
    try {
      gitC(['fetch', REMOTE, BASE, '--quiet']);
      gitC(['checkout', '--detach', `${REMOTE}/${BASE}`]);
    } catch (e) { return { done: [], failed: [], warning: `skipped derived-artifact regen — could not sync to ${REMOTE}/${BASE} (${firstLine(e)})` }; }
    const done = [];
    const failed = [];
    for (const [cmd, ...args] of buildRegenArgs()) {
      try { execFileSync(cmd, args, { cwd: REPO, stdio: ['ignore', 'ignore', 'pipe'] }); done.push([cmd, ...args].join(' ')); }
      catch (e) { failed.push({ cmd: [cmd, ...args].join(' '), detail: firstLine(e) }); }
    }
    if (done.length === 0) return { done, failed, warning: failed.length > 0 ? `derived-artifact regen failed (non-fatal): ${failed.map((f) => f.cmd).join(', ')}` : undefined };
    const changed = (tryGit(['diff', '--name-only']) || '').split('\n').filter(Boolean);
    if (changed.length === 0) return { done, failed }; // regen was a no-op (inputs didn't change)
    try {
      gitC(['add', ...changed]);
      gitC(['commit', '-m', `chore: regen derived artifacts post-land (#2182) [${done.map((c) => c.replace('npm run ', '')).join(', ')}]`]);
      gitPushMain([REMOTE, `HEAD:${BASE}`]);
    } catch (e) { return { done, failed, warning: `derived-artifact regen committed but push to ${BASE} failed (${firstLine(e)}) — re-run gen:inventory + gen:reference-index on ${BASE} by hand` }; }
    return { done, failed };
  }
}
