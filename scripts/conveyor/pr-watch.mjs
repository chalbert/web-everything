#!/usr/bin/env node
/**
 * @file scripts/conveyor/pr-watch.mjs
 * @description The CONVEYOR MERGE WATCHER (WE #2608, epic #2612). A throwaway background process, ONE per
 *   in-flight PR: it polls `gh pr view <N> --json state,mergedAt,labels` on a fixed interval and EXITS the
 *   instant the PR reaches a terminal-for-the-conveyor state — MERGED (the resident drain daemon landed it) or
 *   PARKED (an escalation the main session must handle). The process EXIT is the wake signal: the conveyor
 *   skill (#2613) spawns this in the background, so its exit rides the task-notification wake path and the main
 *   session is woken INSTANTLY — no in-session polling, no push seam — and re-dispatches into the freed lane
 *   the same turn. The exit CODE tells the skill which happened (merged vs parked vs timeout).
 *
 * EVENT-DRIVEN LAND (WE #2683). Besides watching for the terminal state, this watcher also closes the daemon-side
 * LAND-TRIGGER gap: the resident drain daemon lands a ready PR only on its next ≤60s poll, so a PR that becomes
 * landable right after a sweep waits up to a full interval. On the false→true transition of {@link isReadyToLand}
 * — CI-green AND the non-author review sign-off both present, firing on whichever completes LAST — the watcher
 * shells the daemon's OWN land path scoped to one PR (`merge-ai-prs.mjs --only=<pr> --label=ready-to-merge`) so
 * the PR lands at once. The fast drain is NOT a caller-trusted shortcut: it re-derives the full pre-land gate
 * server-side (review sign-off, required check, mergeable), runs the identical `planLabelDrain` blockedBy /
 * impl-first ordering, and serializes its `gh pr merge` under the drain's serial-writer mutex + a per-PR
 * idempotency guard — so an early or spurious fire is a safe no-op and a concurrent daemon sweep never
 * double-merges. Best-effort: a fire failure just falls back to the daemon's ≤60s sweep. Disable with
 * `--no-fast-drain`.
 *
 * Scripted per [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment] (#2607): the
 * state→decision rule is script-decidable (a gh PR json → one of three verdicts), so it lives here as a PURE,
 * unit-tested function — never a policy the conveyor skill re-derives in prose each tick.
 *
 * PURE-CORE / IO-SHELL SPLIT (mirrors the sibling readiness scripts, e.g. conveyor-state.mjs #2611):
 *   • The PURE core ({@link classifyPr}) has NO gh / child_process / clock — it takes an ALREADY-PARSED gh PR
 *     object and returns `'merged' | 'parked' | 'pending'`. It is unit-tested directly against fixtures
 *     (scripts/conveyor/__tests__/pr-watch.test.mjs) with zero network / gh.
 *   • The IO SHELL (the `main()` CLI, gated on the main-module check) owns the `gh` poll, the interval sleep,
 *     the wall-clock deadline, and the exit code. It calls the pure core on each poll and maps its verdict to
 *     the exit contract below.
 *
 * THE EXIT CONTRACT (the conveyor skill reads process.exitCode as the outcome — keep these stable):
 *   • {@link EXIT_MERGED} (0)   — the PR MERGED. The lane it was on is now free; the skill re-dispatches into it.
 *   • {@link EXIT_PARKED} (2)   — the PR PARKED for review: it carries `review:human` / `review:pending` /
 *                                 `review:changes`. Terminal for the watcher — the main session handles it by
 *                                 running /review on the (still-OPEN) parked PR.
 *   • {@link EXIT_TIMEOUT} (3)  — the wall-clock deadline elapsed while the PR was still PENDING (never reached
 *                                 a terminal state). The skill re-arms a watcher or investigates a stuck lane.
 *   • {@link EXIT_CLOSED} (4)   — the PR was CLOSED without merging (a human abandoned it). Terminal, and kept
 *                                 DISTINCT from a review park (exit 2) precisely so the skill can branch: on 4 it
 *                                 investigates the abandoned lane; it does NOT run /review (a review-label swap
 *                                 cannot land a closed PR). One integer per action — exit 2 and exit 4 never mix.
 *   • {@link EXIT_ERROR} (1)    — bad arguments (no PR number). A per-poll `gh` failure is NOT this: it is logged
 *                                 and retried until the deadline (a transient gh hiccup must not kill the watch),
 *                                 so a permanently-unreadable PR surfaces as EXIT_TIMEOUT, not a crash.
 *
 * NOT WATCHER-VISIBLE — RED CI / GATE-RED. The classifier reads ONLY `state,mergedAt,labels`; it cannot see a
 * red `test` check. A gate-red / red-CI escalation leaves the PR OPEN + UNLABELLED, which classifies as
 * `pending` (correct — CI may still be running, and the drain's ci-lifecycle reconcile owns the red-CI label).
 * Red-CI escalation is surfaced by the DELIVERY AGENT's one-line escalation RETURN (the #2608 brief, step 7 /
 * Escalations), NOT by this watcher — never assume the watcher catches red CI.
 *
 * UPGRADE SEAM (#2605 — a CONSUMER upgrade, not a blocker). The gh-poll loop in {@link watchPr} is deliberately
 * isolated behind the injected `pollOnce`, so once #2605 lands the daemon's nudge/SSE push seam this internal
 * poller can be swapped for a single blocking call to `plateau:tools/drain-daemon/cli.mjs watch --pr <N>` —
 * WITHOUT changing the pure {@link classifyPr} verdicts or the exit contract above. The daemon's blocking watch
 * would replace the poll+sleep only; this file stays the stable interface the conveyor skill spawns. See the
 * marked seam in {@link watchPr}.
 */

// ── PURE CORE (no gh / child_process / clock — the gh PR object is passed IN) ─────────────────────────────────

/** The review labels that mark an OPEN PR as PARKED for human review — the main session runs /review to clear
 *  them. The drain daemon applies `review:human`/`review:pending` on escalation; `review:changes` is included
 *  because a human bounced a prior diff and (on the re-dispatch path) pr-land can update a `lane/<num>` PR that
 *  still carries a stale `review:changes` — it must surface as parked at once, not poll to timeout. */
export const PARK_LABELS = Object.freeze(['review:human', 'review:pending', 'review:changes']);

/** The exit-code contract (see the file header). Exported so a test / the conveyor skill can reference them by
 *  name rather than a magic number. */
export const EXIT_MERGED = 0;
export const EXIT_PARKED = 2;
export const EXIT_TIMEOUT = 3;
export const EXIT_CLOSED = 4;
export const EXIT_ERROR = 1;

/** Normalize a gh `labels` array to a plain lowercased name list. gh emits `[{name}]`; tolerate a bare-string
 *  array too (mirrors conveyor-state.mjs `shapePrs`). */
function labelNames(labels) {
  return (Array.isArray(labels) ? labels : [])
    .map((l) => (typeof l === 'string' ? l : l?.name))
    .filter(Boolean)
    .map((n) => String(n).toLowerCase());
}

/**
 * The DETERMINISTIC watcher verdict — the pure keystone. Same gh PR json → same verdict, always.
 *
 * Precedence (terminal states win over pending; MERGED wins over a stray park label):
 *   1. MERGED  — `state === 'MERGED'` OR `mergedAt` is set. The drain landed it; the lane is free.
 *   2. CLOSED  — `state === 'CLOSED'` with no `mergedAt`: a human abandoned the PR without merging. Terminal,
 *                and DISTINCT from a review park — checked BEFORE the park label so a closed PR that still
 *                carries a stale `review:*` label reads as `closed` (the skill investigates the abandoned lane),
 *                never `parked` (running /review on a closed PR is meaningless — the label swap can't land it).
 *   3. PARKED  — an OPEN PR carrying a park label (`review:human` / `review:pending` / `review:changes`). The
 *                main session runs /review to clear it. Terminal for the watcher.
 *   4. PENDING — none of the above: an open PR still in flight (green-and-queued, CI running, or a plain open
 *                PR the drain hasn't reached — note a red `test` check is UNLABELLED and lands here, correctly;
 *                red-CI escalation is the delivery agent's return, not the watcher — see the file header). Keep
 *                polling.
 *
 * @param {{state?:string, mergedAt?:string|null, labels?:Array<{name?:string}|string>}|null|undefined} pr
 *   the parsed `gh pr view --json state,mergedAt,labels` object.
 * @returns {'merged'|'closed'|'parked'|'pending'}
 */
export function classifyPr(pr) {
  if (!pr || typeof pr !== 'object') return 'pending'; // no data parsed yet → keep waiting (never a false exit)
  const state = String(pr.state || '').toUpperCase();
  if (state === 'MERGED' || pr.mergedAt) return 'merged';
  if (state === 'CLOSED') return 'closed'; // abandoned unmerged — terminal & DISTINCT from a review park
  const labels = labelNames(pr.labels);
  if (labels.some((l) => PARK_LABELS.includes(l))) return 'parked';
  return 'pending';
}

/** The required check's conclusion is SUCCESS on this PR's rollup? Mirrors merge-ai-prs `isRequiredCheckGreen`
 *  (the drain's own CI-green truth) so the trigger and the lander read "green" identically. Other checks
 *  (cla, Workers Builds) are ignored. Pure — the parsed `statusCheckRollup` is passed in. A MISSING required
 *  check reads as NOT green (in-flight), never a false green. */
export function isRequiredCheckGreen(pr, requiredCheck = 'test') {
  const roll = Array.isArray(pr?.statusCheckRollup) ? pr.statusCheckRollup : [];
  const check = roll.find((c) => (c?.name || c?.context) === requiredCheck);
  if (!check) return false;
  return String(check.conclusion || check.state || '').toUpperCase() === 'SUCCESS';
}

/** Is the non-author review sign-off PRESENT (GitHub branch-protection `reviewDecision`)? Pure. `APPROVED` → yes;
 *  an EMPTY/absent decision → the repo requires no review, so "present" (nothing to wait on); `REVIEW_REQUIRED` /
 *  `CHANGES_REQUESTED` → NOT present (a required approval is still missing / was refused). This is the SERVER
 *  truth the drain's `gh pr merge` ultimately enforces via branch protection — the trigger reads it so it fires
 *  on the review sign-off arriving, not just on CI going green (#2683 round-2). */
export function isReviewSignedOff(pr) {
  const d = String(pr?.reviewDecision || '').toUpperCase();
  if (d === '' ) return true;               // no review required by branch protection → nothing to wait on
  return d === 'APPROVED';                    // an explicit non-author approval landed
}

/**
 * #2683 — is this PR READY TO LAND right now, i.e. has the LAST of its landing preconditions completed? Pure.
 * The fast-drain trigger fires on the false→true transition of THIS predicate, so it fires on whichever of
 * {CI-green, review-sign-off} lands LAST — closing round-2's "green-only trigger fires before the sign-off, no-ops,
 * and never re-fires" gap. A PR is ready-to-land iff ALL hold:
 *   - it is OPEN (not merged/closed — those are terminal, nothing to trigger);
 *   - it carries NO uncleared review PARK label (`review:human/pending/changes`): a parked PR is the watcher's
 *     `parked` exit + a human `/review`, never a fast-drain (defensive — the loop checks `classifyPr` first anyway);
 *   - the required check is GREEN; AND
 *   - the non-author review sign-off is PRESENT.
 * The fast-drain itself re-derives every one of these SERVER-SIDE before it merges (it never trusts this
 * assertion — #2683 AC2), so a false-positive here is a harmless no-op, and a false-negative just falls back to
 * the resident daemon's ≤60s sweep.
 * @param {{state?:string, mergedAt?:string|null, labels?:Array, statusCheckRollup?:Array, reviewDecision?:string}|null} pr
 * @returns {boolean}
 */
export function isReadyToLand(pr, { requiredCheck = 'test' } = {}) {
  if (!pr || typeof pr !== 'object') return false;
  const state = String(pr.state || '').toUpperCase();
  if (state === 'MERGED' || pr.mergedAt || state === 'CLOSED') return false;
  const labels = labelNames(pr.labels);
  if (labels.some((l) => PARK_LABELS.includes(l))) return false;
  if (!isRequiredCheckGreen(pr, requiredCheck)) return false;
  if (!isReviewSignedOff(pr)) return false;
  return true;
}

/** Map a pure verdict to its exit code. `'pending'` has no exit code (the loop keeps going) → null. */
export function exitCodeForVerdict(verdict) {
  if (verdict === 'merged') return EXIT_MERGED;
  if (verdict === 'parked') return EXIT_PARKED;
  if (verdict === 'closed') return EXIT_CLOSED;
  return null;
}

// ── IO SHELL (runs only as a CLI — owns gh / the interval sleep / the wall-clock deadline / the exit) ─────────

/**
 * The watch loop: poll → classify → exit-on-terminal → sleep → repeat, until the deadline. The gh poll and the
 * sleep are INJECTED (`pollOnce`, `sleep`, `now`) so the loop is drivable in isolation and the poller can later
 * be swapped for the #2605 daemon watch (see the file-header UPGRADE SEAM) without touching this control flow.
 *
 * @param {{
 *   pollOnce: () => Promise<object|null>,     // one `gh pr view` read → parsed PR object (or null on a gh hiccup)
 *   sleep: (ms:number) => Promise<void>,      // interval wait
 *   now: () => number,                         // clock (epoch ms) — injected for determinism
 *   intervalMs: number, deadlineMs: number,   // poll cadence + wall-clock budget
 *   fireFastDrain?: (pr:object) => Promise<void>, // #2683 — fire the single-PR fast drain (best-effort; injected)
 *   requiredCheck?: string,                    // #2683 — the CI check the ready-to-land trigger waits on (default 'test')
 *   log?: (m:string) => void,                  // stderr progress line (optional)
 * }} io
 * @returns {Promise<number>} the resolved EXIT_* code (merged / parked / timeout).
 */
export async function watchPr({ pollOnce, sleep, now, intervalMs, deadlineMs, fireFastDrain = null, requiredCheck = 'test', log = () => {} }) {
  const start = now();
  // #2683 — the fast-drain trigger fires on the false→true transition of `isReadyToLand`, so it fires exactly
  // ONCE per ready-transition — on whichever landing precondition (CI-green / review-sign-off) completes LAST.
  // `wasReady` remembers the prior poll's readiness so a still-ready-but-not-yet-merged PR does not re-fire every
  // interval (no busy-drain); a PR that goes ready→not-ready (e.g. the fast drain rebase-drops it and CI
  // restarts) and later ready again correctly re-fires. EDGE (documented, not a bug): if the fast drain DEFERS
  // this target because a `blockedBy` sibling is still open (AC1 ordering), the fire is a no-op and `wasReady`
  // stays true — the target does not re-fire when the blocker later lands, so it falls back to the resident
  // daemon's ≤60s sweep for that one ordering-sensitive case (the daemon backstop, by design).
  let wasReady = false;
  for (;;) {
    // ── UPGRADE SEAM (#2605): this single `pollOnce()` is the ONLY gh touch in the loop. Swap it for a blocking
    //    `drain-daemon/cli.mjs watch --pr N` call (same parsed-PR return) and the classify/exit contract below
    //    is unchanged — the daemon push replaces the poll+sleep, nothing else. ─────────────────────────────────
    let pr = null;
    try {
      pr = await pollOnce();
    } catch (e) {
      // A transient gh failure must NOT kill the watch — log and let the deadline (below) bound it.
      log(`  ⚠ gh poll failed (retrying): ${String(e?.message || e).split('\n')[0]}`);
    }
    const verdict = classifyPr(pr);
    const code = exitCodeForVerdict(verdict);
    if (code !== null) {
      log(`  ● PR ${verdict} → exit ${code}`);
      return code;
    }
    // #2683 — EVENT-DRIVEN LAND. The PR is still `pending` (open, not parked). If it just reached the ready-to-land
    // state (the LAST precondition completed this poll), fire the single-PR fast drain NOW instead of waiting for
    // the resident daemon's next ≤60s sweep. Best-effort: a fire failure is logged and never kills the watch — the
    // daemon sweep is the backstop, and the fast drain re-derives the full gate server-side so an early/spurious
    // fire is a safe no-op (#2683 AC2). The subsequent poll observes the merge and exits `merged`.
    if (fireFastDrain) {
      const readyNow = isReadyToLand(pr, { requiredCheck });
      if (readyNow && !wasReady) {
        log(`  ⚡ PR ready to land (CI green + review signed off) → firing fast drain (#2683)`);
        try { await fireFastDrain(pr); } catch (e) { log(`  ⚠ fast-drain fire failed (harmless — the resident daemon sweep is the backstop): ${String(e?.message || e).split('\n')[0]}`); }
      }
      wasReady = readyNow;
    }
    if (now() - start >= deadlineMs) {
      log(`  ⏱ deadline reached while still pending → exit ${EXIT_TIMEOUT}`);
      return EXIT_TIMEOUT;
    }
    await sleep(intervalMs);
  }
}

/**
 * #2667 — on MERGE, auto-release the item's lane lease in EVERY pool it acquired. Delegates to the pool's own
 * cross-pool release-by-session (`lane-pool.mjs release --all-pools --session=<slug>`): the lease markers carry
 * the owning session (stamped at acquire/dispatch time), so a by-session sweep clears a cross-locus couple's WE
 * lane AND plateau-app lane in one call — no separate `(pool, lane)` ledger needed (the markers ARE that record).
 * BEST-EFFORT: a release failure is logged and NEVER changes the merge exit code (the merge is the truth; the
 * lease cleanup is secondary, and the periodic lease-reaper is the backstop for anything this misses).
 */
function releaseSessionAcrossPools(execFileSync, session, log) {
  const lanePoolCli = new URL('../lane-pool.mjs', import.meta.url);
  try {
    const out = execFileSync('node', [fileURLToPath(lanePoolCli), 'release', '--all-pools', `--session=${session}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    log(`  ● auto-released lease(s) for session "${session}" across pools on merge`);
    if (out && out.trim()) log(out.trim());
  } catch (e) {
    log(`  ⚠ auto-release for session "${session}" failed (harmless — the lease-reaper is the backstop): ${String(e?.message || e).split('\n')[0]}`);
  }
}

async function main(argv) {
  const { execFileSync } = await import('node:child_process');

  const flags = {};
  const positionals = [];
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq === -1) flags[a.slice(2)] = true;
      else flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else positionals.push(a);
  }
  const log = (m) => process.stderr.write(m + '\n');

  const prNumber = positionals[0] ?? flags.pr;
  if (prNumber == null || !/^\d+$/.test(String(prNumber))) {
    log('usage: pr-watch.mjs <pr-number> [--interval=20] [--timeout-min=30] [--repo=owner/name] [--check=test] [--no-fast-drain] [--release-session=<slug>] [--json]');
    process.exit(EXIT_ERROR);
  }

  const intervalMs = Math.max(1, Number(flags.interval) || 20) * 1000; // default 20s poll cadence
  const deadlineMs = Math.max(1, Number(flags['timeout-min']) || 30) * 60_000; // default 30min wall-clock budget
  const requiredCheck = typeof flags.check === 'string' && flags.check ? flags.check : 'test';

  // ONE gh poll → the parsed PR object (or null on any gh failure, so watchPr's retry-until-deadline applies).
  // #2683 — also fetch `statusCheckRollup` + `reviewDecision` so the ready-to-land trigger can see BOTH landing
  // preconditions (CI-green and the non-author review sign-off) and fire on whichever completes last.
  const pollOnce = async () => {
    const args = ['pr', 'view', String(prNumber), '--json', 'state,mergedAt,labels,statusCheckRollup,reviewDecision'];
    if (typeof flags.repo === 'string') args.push('--repo', flags.repo);
    const out = execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return JSON.parse(out);
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // #2683 — the EVENT-DRIVEN LAND trigger. On the ready-to-land transition, shell the daemon's OWN land path
  // scoped to one PR (`merge-ai-prs.mjs --only=<pr> --label=ready-to-merge`) so the queued PR lands the instant
  // it is ready instead of waiting for the resident daemon's next ≤60s sweep. It carries the daemon's full
  // ordering (blockedBy/impl-first via `--only`'s cross-repo context), authority (server-side re-gate), and
  // mutual-exclusion (the serial-writer mutex + per-PR idempotency guard) — never a caller-trusted shortcut.
  // `--only-repo` disambiguates a sibling-repo PR; omitted for the common local-repo PR. Disable with
  // `--no-fast-drain` (falls back to the pure daemon-sweep cadence). Best-effort — a fire error never fails the
  // watch (watchPr catches it); the drain runs one-shot and returns quickly (it is NOT `--watch`).
  const mergeCli = fileURLToPath(new URL('../merge-ai-prs.mjs', import.meta.url));
  const fireFastDrain = flags['no-fast-drain'] ? null : async () => {
    const args = [mergeCli, `--only=${prNumber}`, '--label=ready-to-merge'];
    if (typeof flags.repo === 'string') args.push(`--only-repo=${flags.repo}`);
    execFileSync('node', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  };

  log(`watching PR #${prNumber} (poll ${intervalMs / 1000}s · deadline ${deadlineMs / 60_000}min${fireFastDrain ? ' · event-driven land ON' : ''}) …`);
  const code = await watchPr({ pollOnce, sleep, now: Date.now, intervalMs, deadlineMs, fireFastDrain, requiredCheck, log });

  // #2667 — on MERGE, auto-release the item's lane lease in every pool it acquired (opt-in via
  // --release-session=<slug>). A non-merge exit (parked / closed / timeout) never releases — a still-open lane
  // is still in use. Runs BEFORE the JSON emit + exit so the release completes while this process is alive.
  if (code === EXIT_MERGED && typeof flags['release-session'] === 'string' && flags['release-session']) {
    releaseSessionAcrossPools(execFileSync, flags['release-session'], log);
  }

  if (flags.json) {
    const outcome =
      code === EXIT_MERGED ? 'merged'
      : code === EXIT_PARKED ? 'parked'
      : code === EXIT_CLOSED ? 'closed'
      : 'timeout';
    process.stdout.write(JSON.stringify({ pr: Number(prNumber), outcome, exit: code }, null, 2) + '\n');
  }
  process.exit(code);
}

// Run the IO shell only when invoked directly — never on import (keeps the pure core side-effect-free).
import { pathToFileURL, fileURLToPath } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2));
}
