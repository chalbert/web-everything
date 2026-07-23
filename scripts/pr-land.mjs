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
 * 3 = unmergeable / gh error / push failed / EMPTY DESCRIPTION (#2324 — nothing merged; recoverable — rebase the
 * ref and re-run, or pass --fallback-git; an empty-body refusal is fixed by editing the PR body and re-running).
 * A non-zero exit means `main` was left UNTOUCHED.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { assertMayMerge, hasNonEmptyBody } from './lib/pr-merge-gate.mjs';
import { numberPendingHashes, isPostLandTreeDirty } from './lane-drain.mjs'; // JIT numbering + dirty-probe, shared single source (#2288/#xzxc92d/#2348)
import { withNumberingLock } from './readiness/drain-lock.mjs'; // #2391 — the numbering-critical-section mutex (sole-serial-writer)
export { isPostLandTreeDirty }; // re-exported for backward compat — callers/tests still import it off pr-land.mjs
import { findDuplicateIds, summarizeDuplicates } from './lib/duplicate-id-tripwire.mjs'; // post-land dup-NNN tripwire (#2318)
import { computeNetDiffChangedFiles } from './merge-ai-prs.mjs'; // SHARED net-diff basis w/ the drain, single source (#1821/#2373)
import {
  scoreEscalation, producerReviewLabel, shouldApplyReviewLabel, REVIEW_LABEL_META,
  buildEscalationReasonBlock, bodyHasEscalationReason,
} from './lib/review-escalation.mjs'; // #2307 — deterministic review-escalation label AT PR-OPEN
import { parseManifest, embedManifestInBody, repoKeyFromSlug, manifestBaseForRepo } from './readiness/lane-manifest.mjs'; // xnsk54v — manifest rides the PR body, not a tracked file

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
// xnsk54v — the lane manifest (drain metadata: cross-repo `repos`, `blockedBy`, `mergeRiskFiles`,
// `dismissedFindings`) is passed as a SCRATCH file (never committed into the tree) and ridden in the PR body
// instead. Load it here; a missing/malformed file degrades to no manifest (the drain then finds none and the
// escalation score loses the couple-shape signal — never a hard failure). Distinct from `--body`: this is the
// machine payload the drain reads, appended to the human body as a delimited block at create.
const LANE_MANIFEST = typeof flags['manifest-file'] === 'string'
  ? (() => { try { return parseManifest(readFileSync(expandHome(flags['manifest-file']), 'utf8')); } catch { return null; } })()
  : null;
// The body actually shipped to `gh pr create` — the human body with the manifest block embedded. The
// #2332/#2324 body guards still run on the HUMAN `BODY` (a manifest-only body must not pass as real content).
const CREATE_BODY = LANE_MANIFEST ? embedManifestInBody(BODY, LANE_MANIFEST) : BODY;
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

/**
 * #2284 — the producer's per-poll verdict on an open PR's merge state. Pure (unit-tested transition table).
 * pr-land NO LONGER merges (the drain is the sole writer and rebases a behind PR before merging), so a
 * BEHIND-but-green PR is landable: the producer LABELS it and hands off rather than aborting — behind-ness is
 * the drain's job, never a labelling precondition (the bug that defeated the handoff live: #145 / the
 * 2026-07-06 pipeline batch, where a churning main left every re-land BEHIND and pr-land refused to label a
 * green PR). Verdicts:
 *   'conflict' — CONFLICTING / DIRTY → abort (rebase or --fallback-git).
 *   'red'      — a required check failed → abort.
 *   'behind'   — BEHIND but this path actually MERGES (non-producer; only the break-glass git-merge) → abort.
 *   'label'    — ready to apply the producer label + hand off: CLEAN/UNSTABLE+passed, OR (producer) BEHIND with
 *                a NON-EMPTY passed required set (never the empty-set 'passed', which for a not-yet-registered
 *                check would race a premature label on a behind PR — CLEAN/UNSTABLE is guarded by GitHub state).
 *   'wait'     — not ready yet (checks pending / BLOCKED) → keep polling.
 * @param {{state:string, checkStatus:string, requiredCount:number, labelWhenGreen:boolean, conflicting?:boolean}} o
 * @returns {'conflict'|'red'|'behind'|'label'|'wait'}
 */
export function pollVerdict({ state, checkStatus, requiredCount = 0, labelWhenGreen = false, conflicting = false } = {}) {
  if (conflicting || state === 'DIRTY') return 'conflict';
  if (checkStatus === 'failed') return 'red';
  if (state === 'BEHIND') {
    if (!labelWhenGreen) return 'behind';
    return requiredCount > 0 && checkStatus === 'passed' ? 'label' : 'wait';
  }
  if ((state === 'CLEAN' || state === 'UNSTABLE') && checkStatus === 'passed') return 'label';
  return 'wait';
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
 *  for a remote-only lane/* head). Result: the create is always non-interactive. (#2332: the CLI create path
 *  now REFUSES a bodyless open upstream via `prCreateBodyGuard`, so this empty-body branch is only ever
 *  reached by the dry-run plan render, never by a real `gh pr create`.) */
export function buildCreateArgs({ base, head, title, body }) {
  const args = ['pr', 'create', '--base', base, '--head', head];
  if (title != null) args.push('--title', title);
  // A title with no body must still carry a body — otherwise gh prompts interactively (fails headless, #2176).
  if (body != null) args.push('--body', body);
  else if (title != null) args.push('--body', '');
  if (title == null && body == null) args.push('--fill');
  return args;
}

/**
 * #2332 — producer fail-fast: NEVER open a bodyless PR. An empty-body PR passes the producer, but the #2324
 * drain-side gate then REFUSES to LAND it, stalling the queue until a human hand-fills the body (observed
 * 2026-07-08: #2226/PR #222 opened bodyless, blocking the drain). #2324 fixed only the consumer-side refusal;
 * this is the missing producer-side prevention. The producer requires a non-empty `--body-file`/`--body` AT
 * OPEN and fails fast where the omission is — never emitting a PR that stalls a later drain and needs manual
 * repair. Guards the CREATE path ONLY: a re-run against an already-open PR is exempt (its body already exists).
 * Pure decision; the CLI turns `ok:false` into a fail-fast emit BEFORE `gh pr create`. */
export function prCreateBodyGuard(body) {
  return hasNonEmptyBody(body)
    ? { ok: true }
    : { ok: false, reason: 'refusing to open a bodyless PR — pass --body-file=<path> (or --body) with a non-empty body (#2332: the #2324 drain gate rejects an empty body at land, stalling the queue)' };
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

/**
 * #2312 — scope a heal's `git diff --name-only` output to ONLY the renumber plan's own touched paths, so
 * `runHeal` never builds its commit from the ambient checkout state. `plan` is the parsed JSON that
 * `backlog-renumber-collisions.mjs --json` prints (carries `writePaths`/`deletePaths`, the exact
 * `backlog/*.md` basenames this renumber wrote/deleted); `allChanged` is every path `git diff --name-only`
 * reports in the checkout AFTER running that CLI. Pure — no fs, no git.
 *
 * Splits `allChanged` into:
 *   - `changed` — the subset that IS one of the renumber's own expected paths (safe for `git add`).
 *   - `foreign` — anything else (a dirty tracked file the heal must NEVER commit — e.g. a concurrent
 *     session's in-flight edits sitting uncommitted in the SAME primary checkout, the #2301 "primary leak"
 *     class). A non-empty `foreign` means the checkout wasn't clean beyond the renumber's own writes; the
 *     caller must ABORT the heal rather than either (a) silently commit the foreign paths too (the bug this
 *     fixes — observed live, PR #168, #2312) or (b) silently drop them from `changed` and proceed (that
 *     would report `healed:true` while a real foreign edit is left half-adopted by a detached-HEAD checkout).
 * @param {{writePaths?:string[], deletePaths?:string[]}} plan
 * @param {string[]} allChanged
 * @returns {{changed:string[], foreign:string[]}}
 */
export function scopeHealChangedPaths(plan, allChanged) {
  const expected = new Set([
    ...(Array.isArray(plan?.writePaths) ? plan.writePaths : []),
    ...(Array.isArray(plan?.deletePaths) ? plan.deletePaths : []),
  ].map((name) => `backlog/${name}`));
  const changed = [];
  const foreign = [];
  for (const f of Array.isArray(allChanged) ? allChanged : []) {
    if (expected.has(f)) changed.push(f); else foreign.push(f);
  }
  return { changed, foreign };
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

/**
 * #2307 — resolve the review-escalation label pr-land should apply AT PR-OPEN (deterministically, never
 * lazily left to a later drain sweep — #2281's rule applied to the review dimension), from signals the
 * producer already has: the net two-dot diff (`changedFiles`/`diffLines`) and the lane's `.lane-manifest.json`
 * (`dismissedFindings`/`crossRepo`). Pure — wraps the shared rubric
 * (`scoreEscalation` → `producerReviewLabel`) plus the shared double-apply guard (`shouldApplyReviewLabel`),
 * the SAME two the drain (`merge-ai-prs.mjs`) reads back later, so producer- and drain-applied verdicts can
 * never drift. `currentLabels` is normally empty at open (a fresh PR) but is honoured either way — re-running
 * pr-land against an already-labelled PR (e.g. a retried `--label-on-green`) must not double-apply.
 * @param {{changedFiles?:string[], diffLines?:number, humanBasisFiles?:string[]|null, dismissedFindings?:number,
 *          crossRepo?:boolean, currentLabels?:Array}} o
 * @returns {{label:string|null, apply:boolean, reasons:string[], humanRequired:boolean}}
 */
export function resolveProducerReviewLabel({
  changedFiles = [], diffLines = 0, humanBasisFiles = null, dismissedFindings = 0, crossRepo = false, currentLabels = [],
} = {}) {
  const score = scoreEscalation({ changedFiles, diffLines, humanBasisFiles, dismissedFindings, crossRepo });
  const label = producerReviewLabel(score);
  return { label, apply: shouldApplyReviewLabel(label, currentLabels), reasons: score.reasons, humanRequired: !!score.humanRequired };
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
  const createArgs = buildCreateArgs({ base: BASE, head: REF, title: derivedTitle, body: CREATE_BODY });

  if (DRY_RUN) {
    emit({
      repo: REPO, merged: false, reason: 'dry-run', ref: REF, base: BASE, method: METHOD,
      plan: [
        `node scripts/lint-locus-prefix.mjs --range=${REMOTE}/${BASE}..${refSha}   # #2331 producer locus-prefix re-check (fail fast on the #2170 review-append leak) — CI is not the first to catch it`,
        `git push ${REMOTE} ${SRC}:refs/heads/${REF}   # publish the lane clone's ${SRC} (${refSha.slice(0, 8)}) to the lane ref`,
        prCreateBodyGuard(BODY).ok ? `gh ${createArgs.join(' ')}` : `REFUSE (if no PR exists yet): ${prCreateBodyGuard(BODY).reason}  # #2332 fail-fast — an existing PR for this head is exempt`,
        PLAN.waitForChecks ? 'poll: gh pr view <pr> mergeStateStatus + gh pr checks <pr> --required  (wait until green; abort on red)' : '(--no-wait: skip check-wait, leave for a later drain pass)',
        // #2199 — the label is applied ONLY after the required checks are green, never eagerly at open.
        LABEL && PLAN.labelWhenGreen ? `gh pr edit <pr> --add-label ${LABEL}   # #2196 label — applied ONLY once required checks pass (#2199)` : (PLAN.mode === 'open-only' ? '(--no-wait: PR opened UNLABELLED — CI not confirmed green; use --label-on-green)' : '(--no-label)'),
        // #2307 — score the SAME deterministic rubric the drain uses and apply review:human/review:pending
        // AT OPEN when it escalates, so a PR needing review is never indistinguishable from a plain ready PR.
        PLAN.labelWhenGreen ? 'score scoreEscalation(net-diff, .lane-manifest.json) → gh pr edit <pr> --add-label review:human|review:pending (#2307, only when it escalates)' : null,
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

  // 1c. #2331 — PRODUCER locus-prefix re-check. The #2170 pre-PR review can edit an item body AFTER the
  //     author's write-time gate ran (and via a route the PostToolUse hook does not see), leaking a bare
  //     code-path ref (#883) that only CI would catch — going red AFTER the PR is open. Re-lint THIS lane's
  //     OWN committed corpus changes (${REMOTE}/${BASE}..SRC) before publishing, so the producer fails fast,
  //     never CI. A real leak (linter exit 2) is a hard stop; any other failure (git/node infra) is
  //     best-effort — CI still backstops it — never a false block.
  const LOCUS_LINT = resolve(fileURLToPath(new URL('./lint-locus-prefix.mjs', import.meta.url)));
  try { execFileSync('node', [LOCUS_LINT, `--range=${REMOTE}/${BASE}..${refSha}`], { cwd: REPO, stdio: ['ignore', 'inherit', 'inherit'] }); }
  catch (e) {
    if (e && e.status === 2) emit({ repo: REPO, merged: false, reason: 'locus-prefix', detail: `bare code-path ref(s) without a <repo>: prefix in this lane's corpus changes (#883/#2331 — the #2170 review-append leak) — prefix them (e.g. "foo.ts" → "we:foo.ts"), \`git commit --amend\`, and re-run; refusing to open a PR CI would fail` }, 3);
    if (!AS_JSON) process.stderr.write(`pr-land [${REPO}] · locus-prefix range sweep could not run (${String(e.message || e).split('\n')[0]}) — CI still backstops it\n`);
  }

  // 2. Publish the source commit to the lane ref on origin (guard-safe: lane/*). Never force, no local branch.
  try { gitC(['push', REMOTE, `${SRC}:refs/heads/${REF}`]); }
  catch (e) { emit({ repo: REPO, merged: false, reason: 'push-failed', detail: `git push ${REMOTE} ${SRC}:refs/heads/${REF} failed (${String(e.message || e).split('\n')[0]})` }, 3); }

  // 2b. (#2291 — pruned) The PRE-CHECK id-collision self-heal (#2222) that used to run here is now DEAD wiring:
  //     under JIT numbering (#2288) a NEW backlog item is born with a collision-free hash id, never an `NNN`,
  //     so "this lane's new item reuses a base NNN" is structurally unrepresentable before the drain assigns
  //     the real number — this precheck could only ever return `{ action: 'none' }`. The shared collision-heal
  //     helper (`scripts/lib/nnn-collision-heal.mjs`) is NOT deleted — it is retained as a dormant backstop at
  //     the drain (`scripts/merge-ai-prs.mjs`'s `HEAL_COLLISION`, and folded into `rebase-drop-manifest.mjs`),
  //     the sole writer to main. pr-land no longer merges by default (#2290), so healing HERE, before a PR the
  //     drain will separately merge (and separately precheck-heal), was pure duplicated dead weight.

  // 3. Find an existing open PR for this head, else create a self-approved one.
  let prNum = null;
  try { prNum = JSON.parse(ghC(['pr', 'list', '--head', REF, '--state', 'open', '--json', 'number']))?.[0]?.number ?? null; } catch { /* gh may be absent */ }
  if (prNum == null) {
    // #2332 — fail fast BEFORE creating: never open a bodyless PR (the #2324 drain gate would refuse to land
    // it, stalling the queue for a human to hand-fill the body). Create-path only — an existing PR is exempt.
    const bodyGuard = prCreateBodyGuard(BODY);
    if (!bodyGuard.ok) emit({ repo: REPO, merged: false, reason: 'empty-body', detail: `${bodyGuard.reason} (head ${REF})` }, 3);
    try { const out = ghC(createArgs); prNum = (out.match(/\/pull\/(\d+)/) || [])[1] ?? null; }
    catch (e) { return ghFailed(`gh pr create failed (${String(e.message || e).split('\n')[0]})`); }
  } else if (LANE_MANIFEST) {
    // xnsk54v — an existing PR (a re-run, or one opened before the manifest was ready) may lack the manifest
    // block the drain reads. Best-effort embed it (idempotent — embedManifestInBody replaces in place); a gh
    // hiccup never aborts a land, the drain's ref fallback still covers it.
    try {
      const liveBody = JSON.parse(ghC(['pr', 'view', String(prNum), '--json', 'body'])).body || '';
      const withManifest = embedManifestInBody(liveBody, LANE_MANIFEST);
      if (withManifest !== liveBody) ghC(['pr', 'edit', String(prNum), '--body', withManifest]);
    } catch { /* best-effort — drain ref fallback covers a miss */ }
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

  // #2307 — the deterministic REVIEW-ESCALATION label, applied AT PRODUCER TIME (never left for a later drain
  // sweep to be the first to apply it — #2281's rule applied to the review dimension). Scores the SAME rubric
  // the drain reads back later (`scoreEscalation`, shared module — see `resolveProducerReviewLabel` above) off
  // signals the producer already has once checks are green: the net two-dot diff (origin/BASE..refSha — the
  // content actually landing, not a stale PR `files` list) and the lane's `.lane-manifest.json`
  // (dismissedFindings / cross-repo couple shape). Best-effort: a
  // signal-fetch miss degrades to no-escalate — never blocks a green land over a scoring hiccup, and the
  // drain's own idempotent backstop pass still catches an unlabelled-but-should-be PR later.
  //
  // #2373 — the diff basis comes from `computeNetDiffChangedFiles` (SHARED with the drain backstop's own
  // scoring, in merge-ai-prs.mjs), which fetches `BASE` with an EXPLICIT destination refspec
  // (`+BASE:refs/remotes/REMOTE/BASE`) rather than a bare `git fetch REMOTE BASE`: the bare form relies on
  // git's opportunistic tracking-ref update and can silently leave a stale local `REMOTE/BASE` even after a
  // "successful" fetch, sweeping already-landed upstream commits (e.g. a gate-fix another lane merged onto
  // `main` between this lane's claim and its PR-open, live repro: PR #324) into the score as if the PR itself
  // touched them.
  const applyReviewEscalationLabel = () => {
    const exec = (cmd, args, opts) => execFileSync(cmd, args, { cwd: REPO, ...opts });
    // xnsk54v — prefer the SCRATCH manifest (--manifest-file, the new off-tree carrier); fall back to the
    // legacy tree-committed `.lane-manifest.json` off the ref for a lane that still commits it. Loaded BEFORE
    // the net diff so #2390's per-repo `base` can seed the diff basis.
    let manifest = LANE_MANIFEST;
    if (!manifest) {
      const manifestRaw = tryGit(['show', `${refSha}:.lane-manifest.json`]);
      if (manifestRaw) { try { manifest = JSON.parse(manifestRaw); } catch { /* malformed — degrade to no manifest signal */ } }
    }
    // #2390 — score this lane on its OWN delta from the manifest per-repo `base` (its predecessor's tip when
    // overlap-stacked), NOT the cumulative diff vs main — the SAME basis the drain backstop uses (#2373's
    // no-drift invariant). The repo key comes from this clone's origin slug; a sibling lane has no base → null →
    // the unchanged `origin/main` basis.
    const originSlug = (() => { try { const u = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); const m = u.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/); return m ? m[1] : null; } catch { return null; } })();
    const baseRev = manifestBaseForRepo(manifest, repoKeyFromSlug(originSlug));
    const net = computeNetDiffChangedFiles({ exec, remote: REMOTE, base: BASE, baseRev, rev: refSha });
    const changedFiles = net.changedFiles;
    const diffLines = net.diffLines;
    // #2390-review-fix — the CUMULATIVE origin/main…head basis the gate-self/human trigger scores over; a
    // stacked base de-inflates SIZE (`changedFiles`) but can never shrink this.
    const humanBasisFiles = net.humanBasisFiles;
    const crossRepo = manifest && Array.isArray(manifest.repos) ? manifest.repos.length > 1 : false;
    const dismissedFindings = manifest && Number.isFinite(Number(manifest.dismissedFindings)) ? Number(manifest.dismissedFindings) : 0;
    let currentLabels = [];
    try { currentLabels = (JSON.parse(ghC(['pr', 'view', String(prNum), '--json', 'labels'])).labels || []).map((l) => l.name); } catch { /* fresh PR — no labels yet */ }
    const verdict = resolveProducerReviewLabel({ changedFiles, diffLines, humanBasisFiles, dismissedFindings, crossRepo, currentLabels });
    if (verdict.label && verdict.apply) {
      const meta = REVIEW_LABEL_META[verdict.label];
      try { ghC(['label', 'create', verdict.label, '--color', meta.color, '--description', meta.description]); } catch { /* already exists — fine */ }
      try { ghC(['pr', 'edit', String(prNum), '--add-label', verdict.label]); }
      catch (e) { if (!AS_JSON) process.stderr.write(`pr-land [${REPO}] · could not apply review label "${verdict.label}" to #${prNum} (${String(e.message || e).split('\n')[0]}) — land continues\n`); }
      // Stamp the WHY into the PR body (mirrors the drain's #2324 guarantee) so an operator sees it without
      // re-deriving the rubric. Best-effort + idempotent (bodyHasEscalationReason guards a re-append).
      try {
        let liveBody = '';
        try { liveBody = JSON.parse(ghC(['pr', 'view', String(prNum), '--json', 'body'])).body || ''; } catch { /* fetch miss — augment from empty */ }
        if (!bodyHasEscalationReason(liveBody)) ghC(['pr', 'edit', String(prNum), '--body', liveBody + buildEscalationReasonBlock(verdict.reasons)]);
      } catch { /* best-effort — the label already carries the signal */ }
    }
    return verdict;
  };

  // open-only (`--no-wait`, no `--label-on-green`): open WITHOUT the `ready-to-merge` landing-gate label
  // (nothing has confirmed it green) and leave it. #2421 — this is NOT an ambiguous bare state read from a
  // label's absence: the drain's total ci-lifecycle reconcile (`lifecycleLabelFromCiTruth`,
  // `merge-ai-prs.mjs`'s `reconcileCiLifecycleLabels`, every drain pass + `--watch` interval) picks up this PR
  // on its next sweep and applies `checking`/`ci:failed`/`blocked` from CI truth — never per-check-tick writes
  // from HERE. `ready-to-merge` itself keeps its unchanged landing-gate absence-semantics (#2183 F1/#2138 F4):
  // its absence still means "not queued"; the label lander won't collect a red PR either way. A producer that
  // wants the drain to land it must use `--label-on-green` (wait → label when green → hand off).
  if (PLAN.mode === 'open-only') {
    if (!AS_JSON && LABEL) process.stderr.write(`pr-land [${REPO}] · #${prNum} opened UNLABELLED (--no-wait): use --label-on-green so the ${LABEL} label is applied only when required checks pass; the drain's ci-lifecycle reconcile labels its checking/ci:failed/blocked state on its next sweep (#2421)\n`);
    emit({ repo: REPO, merged: false, reason: 'opened', pr: Number(prNum), ref: REF, label: null, labelApplied: false, detail: `opened self-approved PR #${prNum} for ${REF} (--no-wait, no ready-to-merge label yet — CI not confirmed green; the drain's ci-lifecycle reconcile covers its checking/ci:failed/blocked state, #2421)` }, 0);
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

    const verdict = pollVerdict({ state, checkStatus: reqVerdict.status, requiredCount: required.length, labelWhenGreen: !!PLAN.labelWhenGreen, conflicting: view.mergeable === 'CONFLICTING' });
    if (verdict === 'conflict') emit({ repo: REPO, merged: false, reason: 'conflict', pr: Number(prNum), detail: `PR #${prNum} has merge conflicts with ${BASE} — ${BASE} left untouched (rebase the ref + re-run, or --fallback-git)` }, 3);
    // #2421 — this abort intentionally does NOT write a `ci:failed` label itself (never a per-check-tick
    // pr-land write, per the #2281 ruling): the drain's `reconcileCiLifecycleLabels` reads the SAME required-
    // check truth on its next sweep and applies `ci:failed`, so a PR left here is never a permanently-ambiguous
    // bare state — just a producer-side exit the drain's self-healing reconcile corrects shortly after.
    if (verdict === 'red') emit({ repo: REPO, merged: false, reason: 'check-red', pr: Number(prNum), detail: `PR #${prNum} required check RED — ${reqVerdict.reason}; ${BASE} left untouched (fix + re-run) — the drain's ci-lifecycle reconcile will label it ci:failed (#2421)` }, 2);
    if (verdict === 'behind') emit({ repo: REPO, merged: false, reason: 'behind', pr: Number(prNum), detail: `PR #${prNum} is behind ${BASE} (strict up-to-date) — rebase the ref onto ${BASE} + re-run` }, 3);
    if (verdict === 'label') break; // ready: green (for BEHIND, a NON-EMPTY green set) → apply the producer label
    // verdict === 'wait' → not ready yet (checks pending / BLOCKED); keep polling until the timeout. A timeout
    // below likewise leaves the PR for the drain's reconcile to label `checking`/`ci:failed` from CI truth —
    // never inferred from this exit's absence of a label (#2421).
    if (Date.now() > deadlineMs) emit({ repo: REPO, merged: false, reason: 'check-timeout', pr: Number(prNum), detail: `PR #${prNum} not ready past timeout (mergeStateStatus=${state}); leaving for a later drain pass — the drain's ci-lifecycle reconcile covers its labelling (#2421)` }, 3);
    execFileSync('sleep', ['20']);
  }

  // Required checks are GREEN — before labelling, refuse to land a PR carrying an empty/whitespace description
  // (#2324: PR #206 landed bodyless even though a body is nominally required — enforce it here, loud, not as
  // unenforced skill prose). Read the PR's LIVE body (not just the `--body`/`--body-file` this invocation
  // passed) since an already-open PR found via `gh pr list --head` may predate this run; a fetch miss falls
  // back to the body this invocation supplied, defaulting to "no body confirmed" (fail-safe, never fail-open).
  if (PLAN.labelWhenGreen) {
    let liveBody = BODY;
    try { const v = JSON.parse(ghC(['pr', 'view', String(prNum), '--json', 'body'])); if (typeof v.body === 'string') liveBody = v.body; } catch { /* gh miss — fall back to the body this invocation supplied, if any */ }
    if (!hasNonEmptyBody(liveBody)) {
      emit({ repo: REPO, merged: false, reason: 'empty-body', pr: Number(prNum), detail: `PR #${prNum} has an empty/whitespace description — refusing to land it (pass --body-file with a real summary of what changed and why; #2324); ${BASE} left untouched` }, 3);
    }
  }

  // Required checks are GREEN — NOW apply the producer-certified label (#2199: never before this point).
  if (PLAN.labelWhenGreen) applyLabel();

  // #2307 — and the deterministic review-escalation label (review:human / review:pending), alongside
  // ready-to-merge — a green producer PR IS ready; the review label is the *landing gate*, which the drain
  // already honours (a couple with a human-required half withholds via the existing blockedBy/crossRepo path).
  const reviewVerdict = PLAN.labelWhenGreen ? applyReviewEscalationLabel() : { label: null, apply: false, reasons: [], humanRequired: false };

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
    ...(reviewVerdict.label ? { reviewLabel: reviewVerdict.label, reviewLabelApplied: reviewVerdict.apply, escalateReasons: reviewVerdict.reasons, humanRequired: reviewVerdict.humanRequired } : {}),
    ...(drainTrigger ? { drainTriggered: !!drainTrigger.triggered } : {}),
    ...(primarySynced !== null ? { primarySynced } : {}),
    detail: `PR #${prNum} (${REF}) required checks green${labelApplied ? ` — labelled ${LABEL}` : ''}`
      + (reviewVerdict.label ? `${reviewVerdict.apply ? ' — labelled' : ' — already labelled'} ${reviewVerdict.label} (${reviewVerdict.reasons.join('; ')})` : '')
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
      // JIT numbering (#2288 / #xzxc92d): the fallback-git merge is a LAND path too — the last one #2288 left
      // un-numbered. Number every provisional hash file the merge just brought onto BASE BEFORE the push, so
      // no hash strands on main (this is the exact route that stranded #xzxc92d itself). Shares lane-drain's
      // `numberPendingHashes` (single source, never a fork); it commits the rename+rewrite locally, so the push
      // below carries the numbering to main together with the merge. Best-effort — a numbering error is
      // surfaced but never unwinds the successful merge (the post-land heal is the collision backstop).
      // #2391 — number+publish is the NUMBERING CRITICAL SECTION (sole-serial-writer, #2288/#2290). Wrap it in
      // the TTL-bounded numbering mutex so this break-glass land never races a concurrent drain onto the same NNN.
      const numLock = withNumberingLock(() => {
        const n = numberPendingHashes(REPO);
        if (n && n.error) process.stderr.write(`pr-land [${REPO}] ⚠ JIT numbering skipped (${n.error}) — a provisional hash may reach ${BASE} un-numbered; run the drain's numbering by hand\n`);
        gitPushMain([REMOTE, `${BASE}:${BASE}`]);
        return n;
      });
      const numbered = numLock.result;
      if (numLock.contended) process.stderr.write(`pr-land [${REPO}] ⚠ numbering mutex not acquired (held by ${numLock.heldBy || '?'}) — numbered+pushed without it (#2391); the #2318 duplicate-NNN tripwire is the backstop\n`);
      if (SYNC_PRIMARY) syncPrimaryMain(); // ff-sync the user's primary checkout too (the lane's local BASE is already merged)
      // #xsyia6k — snapshot the duplicate set on BASE BEFORE the heal mutates the local tree. gitPushMain above
      // just published the merged tree to ${BASE}, so this reflects what actually sits on BASE; the tripwire below
      // falls back to it when the heal healed-but-didn't-publish (else it would read the healed-but-unpushed local
      // dir as clean — the read-local-tree hazard the drain's tripwire guards with `healPublished`).
      const preHealDups = findDuplicateIds(resolve(REPO, 'backlog'));
      const heal = HEAL ? runHeal({ ontoRef: preMergeBaseSha }) : null;
      if (heal && heal.warning) process.stderr.write(`pr-land [${REPO}] ⚠ ${heal.warning}\n`);
      const regen = REGEN ? runRegen() : null;
      if (regen && regen.warning) process.stderr.write(`pr-land [${REPO}] ⚠ ${regen.warning}\n`);
      const skipped = postLandSkips(heal, regen);
      if (skipped.length) process.stderr.write(`pr-land [${REPO}] ⚠⚠ POST-LAND ${skipped.join(' + ')} SKIPPED (tracked-dirty tree) — ${BASE} may carry an unhealed id collision / stale derived artifacts; run the steps by hand.\n`);
      // #2318 — post-land DUPLICATE-NNN tripwire. runHeal above renumbers an intra-corpus collision, but if a
      // duplicate SURVIVES (heal skipped on a dirty tree, or a mode the healer can't resolve), it must be LOUD,
      // never silent on main. Re-detect after the heal and surface it so the fallback-git land can't leave a
      // duplicate id sitting on ${BASE} (the #2316 double-land failure mode).
      // #xsyia6k — but runHeal WRITES the renumber to the local tree before it gates/commits/pushes, so a heal that
      // healed-but-didn't-publish (gate red, or push failed → `renumbered.length && !healed`) leaves the local dir
      // clean while ${BASE} still holds the dup. Trust the fresh scan only then; otherwise report the pre-heal set.
      const healUnpublished = !!(heal && Array.isArray(heal.renumbered) && heal.renumbered.length && !heal.healed);
      const residualDups = healUnpublished ? preHealDups : findDuplicateIds(resolve(REPO, 'backlog'));
      if (residualDups.length) process.stderr.write(`pr-land [${REPO}] ✗✗ TRIPWIRE (#2318): duplicate id(s) on ${BASE} after heal — ${summarizeDuplicates(residualDups)}; resolve by hand (${BASE}'s standards gate will stay RED until then).\n`);
      emit({ repo: REPO, merged: true, reason: 'merged-git-fallback', ref: REF, healed: heal && heal.healed ? heal.renumbered : [], ...(heal && heal.warning ? { healWarning: heal.warning } : {}), ...(numbered && numbered.assigned && numbered.assigned.length ? { numbered: numbered.assigned } : {}), regenDone: regen ? regen.done : [], regenFailed: regen ? regen.failed : [], ...(regen && regen.warning ? { regenWarning: regen.warning } : {}), ...(skipped.length ? { skipped } : {}), ...(residualDups.length ? { duplicateIdsOnMain: residualDups } : {}), detail: `${detail}; landed ${REF} onto ${BASE} via the local git-merge fallback${numbered && numbered.assigned && numbered.assigned.length ? `; JIT-numbered ${numbered.assigned.map((a) => `${a.hash}→#${a.nnn}`).join(', ')}` : ''}${residualDups.length ? `; ⚠ DUPLICATE ids survive: ${summarizeDuplicates(residualDups)}` : ''}${postLandReport(heal, regen)}` }, 0);
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
    // #2312 — SCOPE the commit to the renumber's OWN file set (`plan.writePaths`/`deletePaths`), never a bare
    // `git diff --name-only`. This checkout is often the user's PRIMARY (REPO defaults to `process.cwd()`, and
    // the detached checkout above deliberately never resets a local branch so an accidental
    // `--repo=<primary-with-work>` isn't yanked out from under the user, see the comment above `runHeal`) — it
    // can carry OTHER dirty tracked files from a concurrent session's in-flight work (the exact #2301 "primary
    // leak" class: agent-memory/skill/script edits sitting uncommitted). A bare unscoped diff would sweep those
    // straight into this heal's commit and land them on `${BASE}` (observed live, PR #168, #2312). If the diff
    // carries anything OUTSIDE the renumber's own paths, ABORT loud rather than silently drop or silently land
    // foreign content — mirrors the #2290 regen fix's `outputPaths` discipline.
    const allChanged = (tryGit(['diff', '--name-only']) || '').split('\n').filter(Boolean);
    const { changed, foreign } = scopeHealChangedPaths(plan, allChanged);
    if (foreign.length) return { healed: false, renumbered, warning: `id collision healed on disk but the checkout at ${REPO} also carries FOREIGN tracked change(s) outside the renumber's own file set (${foreign.join(', ')}) — ABORTING the heal (nothing committed/pushed) to avoid landing foreign content; reset this checkout to a clean ${BASE} and re-run, or run scripts/backlog-renumber-collisions.mjs on ${BASE} by hand` };
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
