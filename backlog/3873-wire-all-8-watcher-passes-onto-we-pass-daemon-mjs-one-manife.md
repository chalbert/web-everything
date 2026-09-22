---
bornAs: xkpma5b
kind: story
size: 5
parent: "3383"
status: resolved
blockedBy: ["3871"]
scope: ["we:skills-src/conveyor/daemon-manifest.mjs", "we:skills-src/conveyor/__tests__/daemon-manifest.test.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
tags: []
---

# Wire all 8 watcher passes onto we:pass-daemon.mjs, one manifest entry each

All 8 watcher passes -- we:scripts/conveyor/branch-drift.mjs, we:scripts/conveyor/ci-queue-watch.mjs, we:scripts/conveyor/parked-pr-conflict-watch.mjs, we:scripts/conveyor/parked-pr-progress-watch.mjs, we:scripts/conveyor/duplicate-pr-watch.mjs, we:scripts/conveyor/lane-pool-health-watch.mjs, we:scripts/conveyor/poc-branch-sync.mjs, we:scripts/conveyor/infra-blocked.mjs -- already carry their own separate advisory/lease lock (or need none), confirmed by direct read: none calls the shared tick mutex. we:scripts/conveyor/ci-queue-watch.mjs uses withHistoryLock, we:scripts/conveyor/infra-blocked.mjs uses withInfraLock (its own header reasons about concurrent writers), we:scripts/conveyor/poc-branch-sync.mjs uses withPocLandLock (shared with a real PR landing), we:scripts/conveyor/lane-pool-health-watch.mjs has a TOCTOU re-check gating its own mutation; the rest need no lock. Wire all 8 onto #3871's we:skills-src/conveyor/pass-daemon.mjs as one manifest entry each, own interval per entry, kept as ONE slice (not 8 separate cards) since each entry is a near-identical, small manifest wiring -- fragmenting further would just multiply review overhead for repetitive work. Only we:scripts/conveyor/infra-blocked.mjs (can block for minutes on its own resumeOpen call) was proven to need isolation from the others; the granularity itself (8 independent daemons vs. fewer groups) is sized to the operator's explicit ask for independent restart/versioning of any single piece, stated honestly rather than implied as a correctness requirement. Drop each from we:skills-src/conveyor/runner.mjs's own mechanicalPasses list as it bakes. Part of daemonizing the conveyor runner under epic #3383; see #3860 for the design context.

## Progress

Correction found by direct read, mirroring #3876's own earlier correction: we:scripts/conveyor/poc-branch-sync.mjs does not exist on main -- no such file under we:scripts/conveyor/, and no reference to it anywhere in the tree outside a stray, unrelated .git/poc-branch-sync ref. The card's own digest even described its internal locking (withPocLandLock) -- a stale claim about a file that was never built, carried over the same way #3876's "action-store fencing" claim was. Wired the 7 REAL passes; did not invent a new pass from scratch (a different, much bigger task than "wire an existing pass").

Second correction, found while wiring rather than assumed: 4 of the 7 passes (we:scripts/conveyor/ci-queue-watch.mjs, we:scripts/conveyor/parked-pr-conflict-watch.mjs, we:scripts/conveyor/parked-pr-progress-watch.mjs, we:scripts/conveyor/lane-pool-health-watch.mjs) already run PER-REPO today inside we:skills-src/conveyor/runner.mjs's own loop (run(path, args, key, slug) appends --repo=${slug} for every constellation repo) -- confirmed by direct read of each script (all four accept --repo). A single WE-only manifest entry per pass would have silently narrowed each one's real coverage from three repos to one -- the exact class of bug just live-caught and fixed in we:skills-src/conveyor/review-daemon.mjs (#xvyuwtg, plateau-app PR #167 sat unwatched because ITS daemon never asked any repo but WE). Wired one manifest entry PER (pass, repo) pair instead (15 total, via a small perRepoEntries generator, not 12 hand-written near-duplicate lines). we:scripts/conveyor/branch-drift.mjs and we:scripts/conveyor/infra-blocked.mjs stay WE-only correctly -- neither script has a --repo flag at all, confirmed by direct read (both watch WE-specific concepts with no cross-repo equivalent). we:scripts/conveyor/duplicate-pr-watch.mjs also stays WE-only, but for a different reason: it DOES accept --repo, but we:skills-src/conveyor/runner.mjs's own comment states why it is never called with one ("duplicate item numbers refer to WE backlog ids, not cross-repo deliveries") -- a real invariant, not a gap.

This directly matters for lane-pool-health-watch-plateau-app: plateau-app's own lane pool had zero health-watch coverage before this, discovered investigating why plateau-app PR #167 couldn't get a review lane (all 8 of its pool lanes sat dirty/held). Verified by direct dry-run that this specific gap is real (node we:scripts/conveyor/lane-pool-health-watch.mjs --repo=chalbert/plateau-app --dry-run had never been run against that pool before) -- though also confirmed none of plateau-app's 6 dirty-unleased lanes today are pure allowlisted litter, so wiring this daemon does NOT by itself unblock PR #167; it closes the coverage gap going forward, not today's specific backlog of real dirty state.

we:skills-src/conveyor/runner.mjs is intentionally UNTOUCHED in this PR -- per the card's own "drop each from we:skills-src/conveyor/runner.mjs's own mechanicalPasses list AS IT BAKES," the same rolling, pass-by-pass cutover discipline #3870/#3876 already followed. Standing up the manifest here does not yet retire the old runner's own copy of any of these 7 sweeps; dropping them is later, separate work once each is confirmed stable running standalone.

## Done when

1. **Executable** — npx vitest run we:skills-src/conveyor/__tests__/daemon-manifest.test.mjs passes (20/20): DAEMON_MANIFEST has exactly 15 entries (3 WE-only + 4 passes × 3 repos); every entry independently validates; the 3 WE-only entries carry no --repo flag; the 4 repo-generic passes each get one entry per constellation repo with the matching --repo=<slug>; lane-pool-health-watch-plateau-app is present and correctly scoped; poc-branch-sync is absent from the manifest (confirmed, not assumed, that the script doesn't exist).
