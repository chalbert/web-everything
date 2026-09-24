#!/usr/bin/env node
/**
 * @file scripts/conveyor/main-ref-sync.mjs
 * @description THE LOCAL `main` REF SYNC (epic #3383) — a small, standalone mechanical pass that keeps a
 *   checkout's LOCAL `main` branch ref fast-forwarded to `origin/main`, so the checkout's own `main` never goes
 *   silently stale behind whatever branch this checkout actually has checked out for real work.
 *
 * THE FAILURE THIS CLOSES, found live 2026-09-14 while auditing why NOTHING was auto-dispatching a fix or
 *   review against the real open-PR backlog despite genuine spare lane capacity. `we:scripts/operations/
 *   review-dispatch.mjs#assertMainNotStale` — called as the FIRST line of both `dispatchReview` (review
 *   dispatch) and `we:scripts/conveyor/reconcile-fix-dispatch.mjs#runReconcileFixDispatch` (fix dispatch),
 *   both wired into `we:skills-src/conveyor/runner.mjs`'s own mechanical-pass tick loop — THROWS whenever this
 *   checkout's LOCAL `main` ref is even one commit behind `origin/main` (it calls `we:scripts/lib/
 *   main-staleness.mjs#checkMainStaleness` with `autoFf: false`, by design: a dispatcher auto-fast-forwarding
 *   itself mid-decision is a worse hazard than refusing). Measured live: a real resident driver checkout's
 *   local `main` had not moved since a merge 33+ HOURS earlier while `origin/main` had advanced 161 commits —
 *   because nothing in this checkout's own operating loop ever touches `main` at all (its own work happens on
 *   `lane/mechanical-dispatcher`; `main` is watched, never worked). Both dispatchers are invoked as SEPARATE
 *   CHILD PROCESSES from the runner's `runQuiet` wrapper, which swallows a thrown failure into one stderr line
 *   and moves on (best-effort — a mechanical-pass failure must never stall a tick). Net effect: a real,
 *   correctly-computed, capacity-available fix/review dispatch plan (`we:scripts/conveyor/reconcile-pass.mjs`)
 *   silently refused EVERY tick, for over a day, with no alert and no visible symptom beyond a one-line stderr
 *   warning nobody was tailing — a `we:3383` PR-queue audit found ten real, currently-owed `fix` dispatches
 *   that had never fired for exactly this reason.
 *
 * THE FIX IS DELIBERATELY NARROW AND SEPARATE FROM THE STALENESS GUARD ITSELF. `assertMainNotStale` stays
 *   exactly as conservative as it was designed to be (#3439) — refuse on ANY staleness, never silently
 *   fast-forward mid-dispatch. What was missing is the OTHER half of that contract: something that keeps the
 *   ground truth it checks from going stale in the first place. This pass is that something — a plain
 *   `git fetch origin main:main`, run on the SAME cadence as every other mechanical pass, so `assertMainNotStale`
 *   almost never has anything to refuse on. It does not touch, weaken, or bypass the guard; it removes the
 *   reason the guard was tripping.
 *
 * RELATION TO `we:backlog/3474` (open, unbuilt as of this pass landing) — that item proposes making
 *   `assertMainNotStale` ITSELF auto-fast-forward on a clean (non-diverged, non-dirty) staleness instead of
 *   always refusing. That is a real, complementary improvement this pass does NOT replace or preempt — but its
 *   own design text (`git pull --ff-only` / `git merge --ff-only origin/main`) implicitly assumes the DISPATCHING
 *   checkout has `main` itself checked out; run on a checkout parked on a DIFFERENT branch (exactly this
 *   resident driver's own shape — permanently on `lane/mechanical-dispatcher`), either operation would fast-
 *   forward/merge into the WRONG branch, not update `main`'s own ref. This pass sidesteps that gap entirely by
 *   never touching the working tree at all — a plain ref-only fetch — so it needs no design decision about which
 *   branch is checked out and is safe to land ahead of #3474's own (still-unbuilt) fuller fix. Whoever builds
 *   #3474 should read this file's own header before assuming a bare `--ff-only` pull is sufficient on every
 *   caller's checkout shape.
 *
 * WHY A DIRECT REF-UPDATING FETCH, NOT `checkMainStaleness`'s OWN `autoFf: true` PATH. That path runs a bare
 *   `git pull --ff-only --autostash` with NO refspec — which fast-forwards whatever branch is CURRENTLY CHECKED
 *   OUT against ITS OWN configured upstream, not `main` against `origin/main`, unless `main` happens to be the
 *   checked-out branch. On a driver checkout (checked out to `lane/mechanical-dispatcher`), turning that flag on
 *   would silently try to fast-forward the WRONG branch — a latent mismatch in that path, named here rather than
 *   worked around by relying on it. `git fetch origin main:main` sidesteps it entirely: it updates ONLY the
 *   local `refs/heads/main` ref, never touches the working tree, and refuses harmlessly (caught, logged, and
 *   skipped) if `main` happens to be the currently checked-out branch (git will not let a fetch write into the
 *   ref HEAD points at) — exactly the one case where the checkout's normal `git pull`/checkout flow already
 *   keeps `main` fresh on its own.
 *
 * PURE-CORE / IO-SHELL SPLIT (mirrors `we:scripts/conveyor/branch-drift.mjs`'s own shape):
 *   • {@link shouldSyncMainRef} is PURE — no fs/git/clock — unit-tested directly.
 *   • The IO shell (`sync` CLI verb, gated on the main-module check) owns the two git calls: read the current
 *     branch, then fetch `main:main` unless the pure core says not to.
 *
 * THE CADENCE — wired into `we:skills-src/conveyor/runner.mjs`'s existing best-effort mechanical passes,
 *   BEFORE `reconcile-fix-dispatch.mjs` and the review-dispatch reconcile call, so both dispatchers see a fresh
 *   `main` ref by the time they run in the SAME tick. Same "piggyback on a pass the headless runner already
 *   ticks" shape every sibling mechanical pass in this file already uses — no new cron, no new daemon.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// ── PURE CORE (no fs / git / clock — every input is injected) ──────────────────────────────────────────────

/**
 * Should this pass even attempt the fetch? PURE. The one case it refuses: `main` is the CURRENTLY CHECKED OUT
 * branch, where `git fetch origin main:main` would fail anyway (git refuses to write a ref that HEAD points
 * at) — refusing here is the SAME verdict `git` itself would reach, just without paying for a failed
 * subprocess and a logged error on every single tick of a checkout that happens to live on `main`.
 * @param {{currentBranch?:string|null}} o
 * @returns {boolean}
 */
export function shouldSyncMainRef({ currentBranch = null } = {}) {
  const branch = typeof currentBranch === 'string' ? currentBranch.trim() : '';
  return branch !== 'main';
}

// ── IO SHELL (git / subprocess only past this point) ────────────────────────────────────────────────────────

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

/**
 * Read the checkout's currently checked-out branch name, or `null` on anything unreadable (a detached HEAD, a
 * fresh repo with no commits, a non-git directory) — {@link shouldSyncMainRef} treats `null` the same as "not
 * main", which is the SAFE direction: worst case this pass attempts a fetch that git itself then refuses.
 * `run` is injectable (same effect {@link syncMainRef} threads through to the fetch call below) so a test can
 * drive both git calls this pass makes through one fake, with no real subprocess.
 * @param {{cwd:string, run?:Function}} o
 * @returns {string|null}
 */
export function readCurrentBranch({ cwd, run = sh }) {
  try {
    const out = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd }).trim();
    return out || null;
  } catch { return null; }
}

/**
 * THE WHOLE PASS: read the current branch, and — unless {@link shouldSyncMainRef} refuses — fetch `origin main`
 * straight into the local `main` ref. Never throws: a failed fetch (offline, a diverged local `main` some other
 * process pushed ahead, `main` checked out after all) is reported and swallowed, exactly like every sibling
 * mechanical pass in this file — this is observability plumbing for `assertMainNotStale`'s ground truth, never
 * a gate of its own.
 * @param {{cwd?:string, run?:Function}} [o]
 * @returns {{attempted:boolean, synced:boolean, currentBranch:string|null, error?:string}}
 */
export function syncMainRef({ cwd = process.cwd(), run = sh } = {}) {
  const currentBranch = readCurrentBranch({ cwd, run });
  if (!shouldSyncMainRef({ currentBranch })) {
    return { attempted: false, synced: false, currentBranch, reason: 'main is the currently checked-out branch — the normal checkout flow already keeps it fresh' };
  }
  try {
    run('git', ['fetch', 'origin', 'main:main', '--quiet'], { cwd });
    return { attempted: true, synced: true, currentBranch };
  } catch (e) {
    // A non-fast-forward (a diverged local `main` — should not happen on a checkout that never commits to it,
    // but a git-level guarantee is stronger than an assumption about this repo's own convention) or a network
    // miss both land here. Either way: report, never throw — `assertMainNotStale` still owns the actual refusal
    // if `main` stays stale; this pass only removes the ORDINARY reason it would be stale.
    return { attempted: true, synced: false, currentBranch, error: String((e && e.message) || e).split('\n')[0] };
  }
}

const IS_CLI = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (IS_CLI) {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const cwdFlag = (argv.find((a) => a.startsWith('--repo-dir=')) || '').slice('--repo-dir='.length);
  const result = syncMainRef({ cwd: cwdFlag || process.cwd() });
  if (asJson) process.stdout.write(JSON.stringify(result) + '\n');
  else if (result.synced) process.stderr.write(`main-ref-sync: local main fetched fresh against origin/main\n`);
  else process.stderr.write(`main-ref-sync: ${result.reason || result.error || 'not synced'}\n`);
  // Never a non-zero exit for a sync failure — this is best-effort observability plumbing, not a gate; a
  // caller that wants to gate on staleness already has `assertMainNotStale`/`branch-drift.mjs check` for that.
  process.exitCode = 0;
}
