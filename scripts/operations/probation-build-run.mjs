#!/usr/bin/env node
/**
 * @file scripts/operations/probation-build-run.mjs
 * @description THE PROBATION DOC-FIX BUILD RUN (agy-launcher-probation, #4291) — the detached per-dispatch
 *   process `dispatch-providers/probation-worker.mjs` starts for one opened, non-critical `doc-fix` `build`.
 *   PR #2819 opened the model-probation gate and started RECORDING a doc-fix pick; this script is what actually
 *   LAUNCHES it, the doc-fix sibling of `we:scripts/operations/probation-heal-run.mjs` (`ci-heal`). It follows
 *   the same arc as a normal mechanical `build` dispatch (claim, build, gate, resolve, PR), with the SCRIPT
 *   doing every script-decidable step and the probation worker (Codex / Antigravity-Claude) doing only the
 *   writing itself:
 *
 *     1. claim the item in the lane (`we:scripts/backlog.mjs claim`);
 *     2. run the worker SYNCHRONOUSLY through its launcher (`gemini-direct-task.mjs` / `codex-direct-task.mjs`,
 *        both foreground-blocking by design) against the item's own spec text;
 *     3. bound the build diff to the `doc-fix` envelope (`we:scripts/lib/provider-routing.mjs#PROVEN_TASK_ENVELOPES`);
 *     4. resolve the item (`we:scripts/operations/run.mjs resolve`) and commit everything — the worker's files
 *        plus the item's own now-resolved backlog card — in ONE commit, trailers naming the worker;
 *     5. run the gate on the FINAL commit (the default, marker-writing `verify-lane` mode, not the marker-less
 *        `run` mode `probation-heal-run.mjs` uses — this script needs a fresh marker for `open-pr
 *        --requireVerified=true` below, which a heal never calls);
 *     6. open the PR through the canonical producer (`we:scripts/operations/run.mjs open-pr`), PARKED
 *        `review:pending` — never `ready-to-merge` — because a probation launch always "owes a run rating"
 *        (`selectProbationWorker`'s own docblock): promotion out of probation is an explicit human decision,
 *        never automatic, and that starts with every probation PR getting a real look;
 *     7. append one `probation-launch` scorecard row whenever the worker actually ran (an item that could not
 *        even be claimed writes no row — it is not a trial of the worker).
 *
 * UNLIKE `probation-heal-run.mjs`, this script CLAIMS and RESOLVES a backlog item (a heal repairs an existing
 * PR's CI and touches no item state at all), and it OPENS a brand-new PR rather than pushing to one that
 * already exists.
 *
 * HOW A FAILED ATTEMPT UNDOES ITSELF (agy-launcher-probation, #4291 plan review). Nothing is ever pushed until
 * `open-pr` succeeds, so — up to that point — every mutation this script makes (the claim's `active` stamp, the
 * worker's diff, the resolve's `resolved` stamp, even a commit already made) lives ONLY in this lane's own
 * working tree/history, never visible to `main` or any other dispatch. A single `git reset --hard` back to
 * {@link baseSha} (captured right after the claim, before this script's own commit ever exists) therefore undoes
 * ALL of it in one step — the claim included. This is deliberately NOT `we:scripts/backlog.mjs release`: by the
 * time a late failure (a red final gate) is detected, the on-disk item file already reads `resolved` (inside
 * the commit this script just made), and `release` only transitions `active`/`preparing` → `open` — calling it
 * against a `resolved` file (or, after the reset already ran, an already-pristine `open` file) refuses. Relying
 * on the git-level undo instead of the CLI verb sidesteps that mismatch entirely and is exactly as correct: the
 * canonical item was NEVER anything but `open` throughout a failed attempt, because nothing left the lane.
 *
 * TWO try/catches, split exactly at the gate (`runProbationBuild` below), so an unexpected thrown error — not
 * just an explicit `ok:false` — is always handled, but never handled the SAME way on both sides of it. Every
 * step up to and including the gate is inside the first: any thrown error there resets the lane (`abandon`),
 * same as an explicit check failing. `writePrBody`/`openPr` run inside a SECOND, inner try/catch instead: by
 * the time they run the commit is gate-GREEN, and a throw there reports `escalated-needs-human` and leaves the
 * built commit in the lane, never resetting it — exactly like the `submitted.ok === false` case already
 * handled explicitly beside it.
 *
 * NEVER merges, never touches `main` directly (the PR opens `review:pending`, and the resident drain daemon
 * lands it once a human clears the review), never releases the LANE on success (the lease ages out, matching
 * every other conveyor delivery arc's own EXIT step) or on failure (matching `probation-heal-run.mjs`, which
 * never releases the lane either — the lease reaper reclaims it).
 *
 * IO lives in the `io` object so the whole arc is testable with fakes; the CLI block at the bottom wires the
 * real processes.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendScorecard as appendScorecardRow } from '../conveyor/run-scorecard-store.mjs';
import { CONSTELLATION_REPOS, DEFAULT_REPO_KEY } from '../lib/constellation-repos.mjs';
import { hookSurfaceChanged, resetHookSurface, snapshotHookSurface, withHooksDisabled } from '../lib/git-hook-surface.mjs';
import { PROVEN_TASK_ENVELOPES } from '../lib/provider-routing.mjs';
import { isDocScopePath } from '../lib/dispatch-task-type.mjs';
import {
  buildDocFixCommitMessage, buildDocFixTask, buildWorkerArgv, frontmatterTamperedBeyondClaim,
  healDiffWithinEnvelope, launchScorecardRow, newUntrackedPaths, summarizeNumstat,
} from '../lib/probation-launcher.mjs';
import { extractSubmitResult } from './open-pr.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** The WE checkout every tool is resolved from — by script location, never cwd. */
export const WE_ROOT = resolve(HERE, '..', '..');
const REPO_SLUG = CONSTELLATION_REPOS[DEFAULT_REPO_KEY].slug;
const GATE_TIMEOUT_MS = 20 * 60 * 1000;
/** The `doc-fix` roster (`we:scripts/lib/provider-routing.mjs#PROBATION_ROSTER`) carries no `checker` — this
 *  launch never needs the second-model approval step `probation-heal-run.mjs` runs for Antigravity-Gemini. */
const DOC_FIX_ENVELOPE = PROVEN_TASK_ENVELOPES['doc-fix'];
/** This launcher only ever calls plain `claim`/`resolve` — never `prepare-stamp`, never `resolve` with
 *  `--graduated-to=`/`--codified-to=` — so its own frontmatter-tamper checks allow only what THOSE two calls
 *  can legitimately produce (#4291 plan-review finding, round 8; see `frontmatterTamperedBeyondClaim`'s own
 *  docblock for why this must be narrower than the shared default). */
const BUILD_OWNED_FRONTMATTER_KEYS = Object.freeze(['status', 'dateStarted', 'dateResolved']);

/**
 * The item's own declared `scope:`, repo-prefix stripped. PURE. #4291 plan review, round 7 — this IS the
 * allowlist a doc-fix worker's touched paths are checked against; an empty result means the item declared no
 * scope, which the arc refuses to build against at all (see the "no declared scope" refusal) rather than
 * falling back to an ever-incomplete denylist (rounds 4-6's own history: statute, then `CLAUDE.md`/
 * `AGENTS.md`, then `GEMINI.md` — a denylist never runs out of paths it forgot).
 * @param {string[]} scope
 * @returns {string[]}
 */
function declaredScopePaths(scope) {
  return (scope || [])
    .map(String)
    // #4291 plan-review finding (security, round 10) — a doc-fix item's scope CAN name another repo
    // (`frontierui:docs/x.md`), because this launcher runs whole-item scope through, not a WE-only filtered
    // copy of it. Blindly stripping ANY `<repo>:` prefix would let a `frontierui:docs/a.md` entry allowlist a
    // same-named `docs/a.md` in THIS (WE) lane that was never actually declared for WE. Keep only bare paths
    // and explicit `we:` entries — this launcher (`probationLaunchDecision`'s own `repo === 'we'` gate) only
    // ever builds in the WE lane, so a foreign-repo entry is simply not an allowlist member here.
    .filter((p) => !/^[a-z][\w-]*:/.test(p) || p.startsWith('we:'))
    .map((p) => p.replace(/^we:/, ''));
}

/**
 * Does `path` fall inside `scopeEntries` (from {@link declaredScopePaths})? PURE. #4291 plan-review finding
 * (correctness, round 9) — a scope entry ending in `/` is a DIRECTORY prefix (every path under it counts,
 * mirroring `we:scripts/lib/dispatch-task-type.mjs#isDocScopePath`'s own `DOC_PATH_PREFIXES` convention); any
 * other entry is an exact file path. Without this, an item scoped to a directory (a legitimate, ordinary
 * `scope:` shape) would have EVERY file the worker touches rejected as "out of scope" — after the worker
 * already spent its full synchronous run finding that out.
 * @param {string} path
 * @param {string[]} scopeEntries
 * @returns {boolean}
 */
function pathInScope(path, scopeEntries) {
  return scopeEntries.some((entry) => (entry.endsWith('/') ? path.startsWith(entry) : path === entry));
}

/** Parse `--k=v` flags. PURE. */
export function parseArgs(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  const worker = typeof flags.worker === 'string' ? JSON.parse(flags.worker) : null;
  return {
    num: flags.num ? String(flags.num) : null,
    session: String(flags.session ?? ''),
    attemptTag: flags.attempt ? String(flags.attempt) : '',
    lane: flags.lane ? Number(flags.lane) : null,
    scope: typeof flags.scope === 'string' && flags.scope ? flags.scope.split(',') : [],
    worker,
    dryRun: flags['dry-run'] === true,
  };
}

/**
 * THE ARC. Returns `{outcome, executor, detail}` — `executor` is who actually wrote the change (the worker's
 * own executor whenever it ran; `'none'` when nothing was ever attempted).
 * @param {ReturnType<typeof parseArgs>} args
 * @param {object} io - see {@link realIo} for the shape.
 */
export async function runProbationBuild(args, io) {
  const { num, session, worker } = args;
  if (!num || !session || !worker?.id) throw new Error('probation-build-run: --num, --session and --worker are required');
  const log = (m) => io.log(`probation-build-run #${num} [${worker.id}]: ${m}`);
  const finish = (outcome, executor, detail, row = {}) => {
    // One `probation-launch` row per build the WORKER actually ran — an item that could never be claimed or
    // found is not a trial of it.
    if (executor === worker.executor) {
      io.appendScorecard(launchScorecardRow({
        worker, pr: row.pr ?? null, repo: REPO_SLUG, handle: session, item: num, launchOutcome: outcome, diff: row.diff ?? null,
      }));
    }
    log(`${outcome} — ${detail}`);
    return { outcome, executor, detail };
  };

  // Mutable across the whole arc, read by the ONE catch at the bottom — #4291 plan review round 4
  // (claim-accuracy): every earlier draft protected only PART of the arc (`baseSha`/`preexisting` captured
  // outside a try, or a separate try per phase), which meant an error in the unprotected part propagated past
  // this function entirely instead of reporting cleanly. Wrapping the WHOLE arc in one try/catch — with these
  // three variables as the only state the catch needs — closes that for every call, not just the ones a
  // reviewer happened to name.
  let lanePath = null;
  let baseSha = null;
  let preexisting = [];
  let workerRan = false; // did the worker actually run? decides the caught error's scorecard attribution.
  // `executor` defaults to the worker's (a launch attempt worth a scorecard row) but a pre-worker consistency
  // check that never ran it passes `'none'` explicitly, so `finish` never credits/blames it for a trial it had
  // no part in.
  const abandon = (outcome, detail, row = {}, executor = worker.executor) => {
    if (baseSha != null) io.discardChanges(lanePath, baseSha, preexisting);
    return finish(outcome, executor, detail, row);
  };

  try {
    lanePath = io.acquireLane({ lane: args.lane, session, scope: args.scope });
    if (!lanePath) return finish('not-applicable', 'none', 'could not acquire a lane for this build');

    // x55dojc — force a known-clean git-hook baseline BEFORE any claim/worker/commit runs in this lane, so a
    // PREVIOUS dispatch's leftovers in a reused pooled lane are never silently inherited. A cleanup that
    // cannot fully complete means no safe baseline exists — refuse outright before running any worker.
    const hookReset = io.resetHookSurface(lanePath);
    if (!hookReset.clean) {
      log(`SECURITY: could not establish a clean git-hook baseline in ${lanePath} (leftover: ${hookReset.leftover.join(', ') || '(config write failed)'}) — refusing before any git command runs`);
      return finish('escalated-needs-human', 'none', 'refused: could not establish a clean git-hook baseline in the lane');
    }

    const item = io.findItem(num, lanePath);
    if (!item) return finish('not-applicable', 'none', `no backlog/${num}-*.md file in this checkout`);

    // Captured BEFORE the claim, so the check right after it can tell "claim only edited the working tree"
    // (the assumption every `abandon` below rests on) apart from "claim also committed", which would move
    // HEAD and quietly invalidate treating `baseSha` as the true pre-claim state.
    const preClaimSha = io.headSha(lanePath);

    if (!io.claim(num, session, lanePath)) {
      return finish('not-applicable', 'none', 'the item could not be claimed (already active/resolved, or a blocker reopened)');
    }

    // Captured right after the claim succeeds, BEFORE this run's own commit ever exists — see the file
    // docblock for why a plain `git reset --hard` back to this sha (never `backlog.mjs release`) is what
    // `abandon` uses to undo the claim along with everything after it, in one step.
    baseSha = io.headSha(lanePath);
    // #4291 plan review, round 4 (claim-accuracy) — verified LIVE, not just asserted: if `claim` ever committed
    // (moving HEAD), `baseSha` just captured would be that commit, not a true pre-claim state, and every
    // `abandon` path's `git reset --hard` would silently stop being the full undo the file docblock promises.
    if (baseSha !== preClaimSha) {
      const moved = baseSha;
      baseSha = null; // nothing was legitimately captured — `abandon` must not reset to an unexplained HEAD.
      return abandon('escalated-needs-human', `claim moved HEAD (${preClaimSha} → ${moved}) — refusing before running any worker, because this launcher's undo assumes claim never commits`, {}, 'none');
    }
    // Snapshot what is untracked BEFORE the worker runs, so only files it creates can join the build.
    preexisting = io.untracked(lanePath);

    // #4291 plan review, round 4 — every design decision from here on (relying on a plain `git reset --hard`
    // to undo the claim, never `backlog.mjs release`; the doc-fix guard's own frontmatter allow-list) rests on
    // ONE assumption: `claim` only ever splices `status`+`dateStarted`, ground-truthed by reading
    // `we:scripts/backlog/frontmatter.mjs#applyTransition` directly (see `CLAIM_OWNED_FRONTMATTER_KEYS`'s own
    // docblock). Rather than leave that as a one-time review-time fact, RE-CHECK it live on every run: if
    // `claim` ever changes to write something else, this catches it immediately — before the worker ever
    // runs, while undoing it costs nothing — instead of that drift surfacing later as a silently-wrong
    // envelope/tamper check.
    const afterClaim = io.findItem(num, lanePath);
    if (frontmatterTamperedBeyondClaim(item.raw, afterClaim?.raw, BUILD_OWNED_FRONTMATTER_KEYS)) {
      return abandon('escalated-needs-human', 'claim wrote frontmatter this launcher does not expect — refusing before running any worker (see CLAIM_OWNED_FRONTMATTER_KEYS)', {}, 'none');
    }

    // #4291 plan review, round 7 — a doc-fix build REFUSES outright with no declared `scope:`, before running
    // any worker. Rounds 4-6 tried bounding an unscoped worker's touch-set with a DENYLIST of specific
    // dangerous paths (statute, `CLAUDE.md`/`AGENTS.md`, another backlog card, …) and it kept being provably
    // incomplete — round 5 named `CLAUDE.md`, round 6 named `GEMINI.md`, and any next round could name a
    // `git mv` trick or a path the denylist never enumerated. A doc-fix item is already expected to declare a
    // plausible `scope:` (the readiness pre-check's own "scope sane" criterion, and the ROUTER already needs
    // `filesTouched`/`estimatedSize` to offer a probation worker at all — `we:scripts/lib/provider-routing.mjs
    // #selectProbationWorker`'s `isWithinProvenEnvelope` check), so refusing the rare unscoped item is not a
    // capability this loses so much as a precondition this launcher was always going to need anyway — and it
    // closes the whole class of "the denylist didn't name X" findings at once, rather than growing the list
    // forever.
    const scopeEntries = declaredScopePaths(args.scope);
    if (!scopeEntries.length) {
      return abandon('not-applicable', 'the item declares no scope: — refusing before running any worker; a doc-fix build needs a declared scope to bound what the worker may touch', {}, 'none');
    }

    // The item's own file is EXCLUDED from every diff/envelope measurement below, on top of `preexisting` — the
    // claim (and later the resolve) mutate it too, and that bookkeeping diff is not the worker's own change;
    // left in, it would inflate the doc-fix envelope's file/line count with an unrelated frontmatter edit
    // (agy-launcher plan review, #4291). It is added to the final commit explicitly and separately, exactly
    // once.
    const excludeFromDiff = [...preexisting, item.path];

    const task = buildDocFixTask({ num, title: item.title, spec: item.spec, scope: args.scope });
    const taskFile = io.writeTaskFile(lanePath, 'probation-build-task.md', task);
    const preHookSurface = hookReset.snapshot;
    log(`running ${worker.launcher} --model=${worker.model}`);
    const run = io.runWorker(buildWorkerArgv({ worker, weRoot: WE_ROOT, dir: lanePath, taskFile }));
    workerRan = true;
    // x55dojc — checked BEFORE the `run.ok` gate below on purpose: even a worker that crashed or timed out
    // could have planted a hook before it did, so this must never be skipped just because the run itself
    // failed.
    const postHookSurface = io.snapshotHookSurface(lanePath);
    const hookCheck = hookSurfaceChanged(preHookSurface, postHookSurface);
    if (hookCheck.changed) {
      log(`SECURITY: the worker's own run changed the lane's git-hook surface — refusing, discarding, never committing/pushing: ${hookCheck.reason}`);
      io.resetHookSurface(lanePath);
      return abandon('escalated-needs-human', `refused: ${hookCheck.reason}`, {});
    }
    // #4291 plan-review finding (correctness, round 2) — a worker that crashed or timed out but still left a
    // partial, envelope-sized diff must never be treated as a clean build: a resolved item + an opened PR would
    // credit a failed run as a success. `run.ok` (not just "did it change anything") gates everything after it.
    if (!run.ok) return abandon('escalated-needs-human', `not built: the worker did not finish cleanly: ${String(run.out ?? '').slice(0, 300)}`, {});

    const summary = summarizeNumstat(io.diffNumstat(lanePath, baseSha, excludeFromDiff), { exclude: excludeFromDiff });
    const diffRow = { files: summary.files, loc: summary.loc };
    if (!summary.files) return abandon('not-applicable', 'the worker changed nothing', { diff: diffRow });

    // #4291 plan-review finding (security) — a doc-fix worker is TOLD to touch documentation only, but nothing
    // upstream enforces it: a hostile or mistaken spec could steer it into a test/config/CI file that still fits
    // the tiny envelope. Every path it actually touched (never `item.path` — checked separately below, because
    // a `.md` backlog card would otherwise pass this exact check too) must be a documentation path.
    const nonDocPaths = summary.paths.filter((p) => !isDocScopePath(p));
    if (nonDocPaths.length) {
      return abandon('gate-red', `not built: touched non-documentation path(s) — a doc-fix worker may edit documentation only: ${nonDocPaths.join(', ')}`, { diff: diffRow });
    }
    // #4291 plan-review finding (security, rounds 4-7) — `isDocScopePath` accepts ANY `.md`/`docs/` path, which
    // is too wide on its own (round 5 named `CLAUDE.md`, round 6 named `GEMINI.md` against an earlier denylist
    // fallback that no longer exists — see the "no declared scope" refusal above). The ALLOWLIST is the item's
    // own declared `scope:`, guaranteed non-empty by that refusal: the worker may touch ONLY the paths the item
    // itself names.
    const outOfScopePaths = summary.paths.filter((p) => !pathInScope(p, scopeEntries));
    if (outOfScopePaths.length) {
      return abandon('gate-red', `not built: touched path(s) outside the item's own declared scope — a doc-fix worker may edit only what the item names: ${outOfScopePaths.join(', ')}`, { diff: diffRow });
    }

    const fits = healDiffWithinEnvelope(summary, DOC_FIX_ENVELOPE);
    if (!fits.ok) return abandon('gate-red', `not built: ${fits.reason}`, { diff: diffRow });

    // #4291 plan-review finding (correctness/security) — `item.path` is excluded from the diff/envelope above
    // (it is the CLAIM's own bookkeeping, not the worker's change), which means a worker that rewrites the
    // item's own file directly — disobeying "do not resolve the backlog item" — would otherwise be invisible
    // to every check above AND silently committed. Re-read the item and require BOTH its BODY (the spec text)
    // and its frontmatter (beyond the claim's own stamp fields) to be unchanged from before the worker ran.
    const postWorkerItem = io.findItem(num, lanePath);
    if (postWorkerItem?.spec !== item.spec || frontmatterTamperedBeyondClaim(item.raw, postWorkerItem?.raw, BUILD_OWNED_FRONTMATTER_KEYS)) {
      return abandon('escalated-needs-human', 'not built: the worker edited the item\'s own backlog card — refusing', { diff: diffRow });
    }

    const resolved = io.resolveItem(num, lanePath);
    if (!resolved.ok) return abandon('escalated-needs-human', `resolve refused: ${resolved.reason}`, { diff: diffRow });

    // x55dojc — re-checked immediately before the ONE commit this arc ever makes: `resolveItem` is its own
    // subprocess (`run.mjs resolve`) between the post-worker snapshot above and here, so this is not a
    // redundant re-read of the same window.
    const preCommitHookSurface = io.snapshotHookSurface(lanePath);
    const preCommitCheck = hookSurfaceChanged(postHookSurface, preCommitHookSurface);
    if (preCommitCheck.changed) {
      log(`SECURITY: the lane's git-hook surface changed during resolve — refusing, discarding, never committing/pushing: ${preCommitCheck.reason}`);
      io.resetHookSurface(lanePath);
      return abandon('escalated-needs-human', `refused: ${preCommitCheck.reason}`, { diff: diffRow });
    }

    io.commit(lanePath, [...summary.paths, item.path], buildDocFixCommitMessage({ num, worker }));

    // The FINAL gate, on the commit that carries both the build and the resolve — the marker-writing mode
    // (unlike `probation-heal-run.mjs#runGate`'s marker-less `run` mode), because `open-pr --requireVerified=true`
    // below needs a fresh GREEN marker keyed to this exact HEAD.
    const gate = io.runGate(lanePath);
    if (!gate.pass) return abandon('gate-red', 'the gate is red after the build and the resolve', { diff: diffRow });

    // #4291 plan-review finding (claim-accuracy, round 2) — a SEPARATE try/catch starts here, deliberately NOT
    // covered by the outer one's `abandon`: everything above this point undoes on ANY error, but the commit is
    // now gate-GREEN, and this docblock's own promise ("a failure after the gate is green leaves the built
    // commit in the lane for a human") must hold for an unexpected thrown error here too, not only for the
    // `submitted.ok === false` case already handled explicitly. `writePrBody`/`openPr` therefore never reach
    // `abandon` — a throw here reports `escalated-needs-human` and stops, exactly like a `!submitted.ok` result.
    try {
      const bodyFile = io.writePrBody(lanePath, { num, worker, diff: diffRow });
      const submitted = io.openPr({ lanePath, num, slug: item.slug, attemptTag: args.attemptTag, bodyFile });
      if (!submitted.ok) {
        // The build is committed and gate-green in the lane either way — never discarded here. A
        // `blocked-on-infra` ref push is auto-retried by the conveyor's own recovery pass; anything else is a
        // real question for a human, and the built work stays in the lane for them to pick up rather than
        // being lost.
        return finish(submitted.blockedOnInfra ? 'blocked-on-infra' : 'escalated-needs-human', worker.executor, submitted.reason, { diff: diffRow });
      }
      return finish('opened-pr', worker.executor, `opened PR #${submitted.pr}, parked review:pending — full review and a run rating are owed`, { diff: diffRow, pr: submitted.pr });
    } catch (e) {
      return finish('escalated-needs-human', worker.executor, `unexpected error opening the PR (the build is committed, gate-green, in the lane): ${e?.message ?? e}`, { diff: diffRow });
    }
  } catch (e) {
    // `workerRan` (set the instant `io.runWorker` returns, above) decides the executor: `'none'` for anything
    // that failed before the worker ever ran (so `finish` never writes a scorecard row for a trial the worker
    // had no part in), the worker's own otherwise — see the `abandon` docblock above.
    return abandon('escalated-needs-human', `unexpected error: ${e?.message ?? e}`, {}, workerRan ? worker.executor : 'none');
  }
}

// ─── the real processes ────────────────────────────────────────────────────────────────────────────────────

function sh(bin, args, opts = {}) {
  return execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, ...opts });
}
function trySh(bin, args, opts = {}) {
  try { return { ok: true, out: sh(bin, args, opts) }; } catch (e) { return { ok: false, out: `${e?.stdout ?? ''}${e?.stderr ?? e?.message ?? ''}` }; }
}
const node = (script, args, opts) => trySh(process.execPath, [join(WE_ROOT, script), ...args], opts);

/**
 * argv (after `node scripts/operations/run.mjs`) for opening a probation build's PR. PURE, and exported
 * specifically so a test can assert `--mode=park`/`--parkLabel=review:pending`/`--requireVerified=true` are
 * present WITHOUT running a real `open-pr` process (#4291 plan review, round 3: a fake-io arc test can never
 * catch a later edit that drops one of these — this is the direct, cheap defence). Every probation build PR is
 * parked `review:pending`, never `label-on-green` — see the file docblock for why.
 * @param {{num: string|number, attemptTag?: string, slug: string, bodyFile: string}} o
 * @returns {string[]}
 */
export function openPrArgv({ num, attemptTag, slug, bodyFile }) {
  const ref = `lane/${num}${attemptTag ?? ''}-${slug}`;
  return [
    'open-pr', `--ref=${ref}`, '--sha=HEAD', '--base=main', `--bodyFile=${bodyFile}`,
    '--mode=park', '--parkLabel=review:pending', '--requireVerified=true', '--json',
  ];
}

/** The real `io` for {@link runProbationBuild}. Every call is bounded and never throws past its own contract.
 *  x55dojc — `laneEnv` disables git hooks (see `../lib/git-hook-surface.mjs`) for EVERY subprocess spawned in
 *  the lane, the worker's own launcher process included, so a planted hook can never fire regardless of which
 *  of these calls happens to run it. */
export function realIo({ session, env = process.env } = {}) {
  const laneEnv = withHooksDisabled({ ...env, LANE_SESSION: session });
  return {
    log: (m) => console.error(m),
    acquireLane: ({ lane, session: s, scope }) => {
      const args = ['acquire', `--repo=${WE_ROOT}`, '--purpose=probation-doc-fix-build', `--session=${s}`, '--base=main'];
      if (lane) args.push(`--lane=${lane}`);
      if (scope?.length) args.push(`--scope=${scope.join(',')}`);
      const r = node('scripts/lane-pool.mjs', args, { env: laneEnv, timeout: 15 * 60 * 1000 });
      if (!r.ok) return null;
      const last = r.out.trim().split('\n').filter(Boolean).at(-1) ?? '';
      return last.startsWith('/') ? last : null;
    },
    resetHookSurface: (dir) => resetHookSurface(dir),
    snapshotHookSurface: (dir) => snapshotHookSurface(dir),
    // The item's own backlog file, resolved by listing `backlog/` for `<num>-*.md` — never a hand-rolled loader
    // of `src/_data/backlog.js` (that loader's own consumer, `dispatch-lane-io.mjs#findItem`, is what handed
    // THIS dispatch its `num` in the first place; re-deriving the same fact a second way risks disagreeing
    // with it). The title is the file's own `# ` heading; the spec is the whole file body below the frontmatter.
    findItem: (n, dir) => {
      let names;
      try { names = readdirSync(join(dir, 'backlog')); } catch { return null; }
      const name = names.find((f) => f.startsWith(`${n}-`) && f.endsWith('.md'));
      if (!name) return null;
      const path = `backlog/${name}`;
      const text = readFileSync(join(dir, path), 'utf8');
      const body = text.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
      const titleMatch = /^#\s+(.+)$/m.exec(body);
      // `raw` — the file's whole text, unmodified — is what `frontmatterTamperedBeyondClaim` compares a later
      // re-read against (#4291 plan review): `spec` alone (the body) cannot see a worker that rewrites a
      // frontmatter FIELD (`scope:`, `blockedBy:`, …) rather than the body.
      return { path, slug: name.slice(String(n).length + 1, -3), title: titleMatch ? titleMatch[1].trim() : '', spec: body, raw: text };
    },
    claim: (n, s, dir) => node('scripts/backlog.mjs', ['claim', String(n), `--session=${s}`], { cwd: dir, env: laneEnv }).ok,
    headSha: (dir) => sh('git', ['-C', dir, 'rev-parse', 'HEAD'], { env: laneEnv }).trim(),
    writeTaskFile: (dir, name, text) => {
      // Inside `.git`, so the task text never shows up in the build diff.
      const p = join(dir, '.git', name);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, text);
      return p;
    },
    runWorker: (argv) => {
      // SYNCHRONOUS on purpose: both launchers block until the model's turn ends (see their own headers).
      // x55dojc: `laneEnv` (not the bare `env`) so the worker's own git use, if any, inherits hooks-disabled.
      const r = trySh(process.execPath, argv, { env: laneEnv, timeout: 70 * 60 * 1000 });
      return { ok: r.ok, out: r.out.slice(-4000) };
    },
    untracked: (dir) => sh('git', ['-C', dir, 'ls-files', '--others', '--exclude-standard'], { env: laneEnv }).split('\n').filter(Boolean),
    diffNumstat: (dir, base, exclude = []) => {
      const created = newUntrackedPaths(exclude, sh('git', ['-C', dir, 'ls-files', '--others', '--exclude-standard'], { env: laneEnv }).split('\n').filter(Boolean));
      if (created.length) trySh('git', ['-C', dir, 'add', '--intent-to-add', '--', ...created], { env: laneEnv });
      if (exclude.length) trySh('git', ['-C', dir, 'reset', '-q', '--', ...exclude], { env: laneEnv });
      // #4291 plan-review finding (security, round 8) — `--no-renames`, explicit and unconditional: with rename
      // detection on (a local `diff.renames` config, not this repo's own default), a renamed file's numstat
      // line reads `old => new` (or `{old => new}`) as ONE path string, which `summarizeNumstat` would then
      // treat as a single opaque path — matching neither the old nor the new name in the scope allowlist, so
      // it would ALREADY refuse (an unmatched path is out-of-scope), but only by accident of string mismatch,
      // not by design. Forcing rename detection off makes a rename report as a plain delete + add — two
      // ordinary paths the allowlist checks exactly like any other change — so the safety no longer depends on
      // arithmetic on an opaque `a => b` string ever failing to match.
      return sh('git', ['-C', dir, 'diff', '--no-renames', '--numstat', base], { env: laneEnv });
    },
    // Undo ALL of this run's own changes back to `base` (the claim's stamp, any uncommitted diff, and a commit
    // already made alike — see the file docblock for why this, not `backlog.mjs release`, is the one undo this
    // script needs), then delete just the untracked paths the worker itself created.
    // #4291 plan-review finding (correctness, round 2) — every call here is `trySh` (never the throwing `sh`),
    // deliberately: this is the LAST-RESORT cleanup `abandon` calls from inside a `catch`, so a git hiccup here
    // must degrade (best-effort) rather than throw past it and skip the scorecard row / final report entirely.
    discardChanges: (dir, base, preexisting = []) => {
      const listed = trySh('git', ['-C', dir, 'ls-files', '--others', '--exclude-standard'], { env: laneEnv });
      const created = listed.ok ? newUntrackedPaths(preexisting, listed.out.split('\n').filter(Boolean)) : [];
      trySh('git', ['-C', dir, 'reset', '--hard', base], { env: laneEnv });
      if (created.length) trySh('git', ['-C', dir, 'clean', '-f', '--', ...created], { env: laneEnv });
    },
    resolveItem: (n, dir) => {
      const r = node('scripts/operations/run.mjs', ['resolve', `--ref=${n}`, '--json'], { cwd: dir, env: laneEnv });
      if (r.ok) return { ok: true };
      let reason = r.out.trim().slice(0, 500);
      try { reason = JSON.parse(r.out)?.reason ?? reason; } catch { /* not JSON — keep the raw tail */ }
      return { ok: false, reason };
    },
    commit: (dir, paths, message) => {
      const msgFile = join(dir, '.git', 'probation-build-commit-msg.txt');
      writeFileSync(msgFile, message);
      sh('git', ['-C', dir, 'add', '--', ...paths], { env: laneEnv });
      sh('git', ['-C', dir, 'commit', '-F', msgFile, '--', ...paths], { env: laneEnv });
    },
    runGate: (dir) => {
      // The DEFAULT (marker-writing) mode — never `run` mode — so `open-pr --requireVerified=true` below finds
      // a fresh GREEN marker keyed to the commit this gate just verified.
      const r = node('scripts/verify-lane.mjs', ['--json'], { cwd: dir, env: laneEnv, timeout: GATE_TIMEOUT_MS });
      return { pass: r.ok, output: r.out.slice(-12000) };
    },
    writePrBody: (dir, { num: n, worker: w, diff }) => {
      const bodyFile = join(dir, '.pr-body.md');
      writeFileSync(bodyFile, [
        `Doc-fix build on probation (${w.executor}/${w.model}) for #${n} (agy-launcher-probation, #4291).`,
        '',
        `Probation worker \`${w.id}\` built this item to spec via its own synchronous launcher, then the launcher`,
        `ran the gate, resolved the item and committed. ${diff.files} file(s), ${diff.loc} line(s) changed —`,
        'within the proven `doc-fix` envelope.',
        '',
        'Full review and a run rating are owed on this change; promotion out of probation stays an explicit',
        'human decision.',
        '',
      ].join('\n'));
      return bodyFile;
    },
    openPr: ({ lanePath: dir, num: n, slug, attemptTag, bodyFile }) => {
      const r = node('scripts/operations/run.mjs', openPrArgv({ num: n, attemptTag, slug, bodyFile }), { cwd: dir, env: laneEnv });
      if (!r.ok) {
        const blockedOnInfra = /blocked-on-infra|outside dependency|network fault/i.test(r.out);
        return { ok: false, blockedOnInfra, reason: r.out.trim().slice(0, 1000) };
      }
      try {
        const submit = extractSubmitResult(JSON.parse(r.out));
        if (!submit?.pr) return { ok: false, blockedOnInfra: false, reason: `open-pr reported no PR number: ${r.out.slice(0, 500)}` };
        return { ok: true, pr: submit.pr, url: submit.url ?? null };
      } catch (e) {
        return { ok: false, blockedOnInfra: false, reason: `open-pr --json did not parse: ${e?.message ?? e}` };
      }
    },
    appendScorecard: (row) => {
      // Best-effort: a lost trial row must never fail a build that worked.
      try { appendScorecardRow(row); } catch (e) { console.error(`probation-build-run: scorecard row not written: ${e?.message ?? e}`); }
    },
  };
}

/** Refused before any process, mirroring `probation-heal-run.mjs`'s own script-existence discipline. */
export function assertRunnable() {
  if (!existsSync(join(WE_ROOT, 'scripts', 'operations', 'run.mjs'))) {
    throw new Error('probation-build-run: scripts/operations/run.mjs is not in this checkout');
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  assertRunnable();
  const args = parseArgs(process.argv.slice(2));
  const io = realIo({ session: args.session });
  runProbationBuild(args, io).then((result) => {
    console.log(JSON.stringify(result));
    process.exitCode = result.outcome === 'opened-pr' || result.outcome === 'not-applicable' ? 0 : 1;
  }).catch((e) => {
    console.error(`probation-build-run: ${e?.stack || e}`);
    process.exitCode = 1;
  });
}
