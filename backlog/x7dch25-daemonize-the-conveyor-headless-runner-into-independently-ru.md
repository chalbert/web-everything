---
kind: story
size: 8
parent: "3383"
status: open
scope: ["we:skills-src/conveyor/runner.mjs", "we:skills-src/conveyor/supervisor.mjs", "we:skills-src/conveyor/runner-lock.mjs", "we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/operations/review-dispatch.mjs", "we:scripts/conveyor/review-round-tag.mjs", "we:scripts/conveyor/review-status-tag.mjs", "we:scripts/conveyor/verify-dispatch.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/conveyor/branch-drift.mjs", "we:scripts/conveyor/ci-queue-watch.mjs", "we:scripts/conveyor/parked-pr-conflict-watch.mjs", "we:scripts/conveyor/parked-pr-progress-watch.mjs", "we:scripts/conveyor/duplicate-pr-watch.mjs", "we:scripts/conveyor/lane-pool-health-watch.mjs", "we:scripts/conveyor/poc-branch-sync.mjs", "we:scripts/conveyor/infra-blocked.mjs", "we:scripts/lib/gh-throttle.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Daemonize the conveyor headless runner into independently-runnable processes

we:skills-src/conveyor/runner.mjs is one singleton-locked process. It is all-or-nothing to run, restart, or ship a new version of one part without touching the rest, and a blocking pass (we:scripts/operations/review-dispatch.mjs waits for a review verdict; we:scripts/conveyor/verify-dispatch.mjs waits on a gate) can stall dispatch and the lease heartbeat next to it.

DECISION (validated over 3 rounds of jury review plus a direct read of all 16 relevant scripts on the branch): separate OS processes under one manifest-driven Supervisor, not a single process with an in-process plugin toggle. An in-process design shares one event loop and one crash domain -- a blocking or crashing plugin still takes everything down with it, which is close to today's actual bug -- and cannot give real parallel execution or independent per-piece versioning, which is the operator's actual goal.

COMPONENTS (manifest entries):
1. Dispatcher -- tick-core planner + dispatchPass + we:skills-src/conveyor/hiccup-classify.mjs / we:hiccup-sink.mjs (pure, consumes this tick's own decision output, must stay in-process) + lease-reaper + session-reaper + main-ref-sync (the one process that actually writes the sync). Sole holder of we:skills-src/conveyor/runner-lock.mjs's singleton lease and the tick mutex.
2. Eight separate single-pass daemons, one manifest entry each, own interval: branch-drift, ci-queue-watch, parked-pr-conflict-watch, parked-pr-progress-watch, duplicate-pr-watch, lane-pool-health-watch, poc-branch-sync, infra-blocked (all we:scripts/conveyor/). None of the 11 mechanical passes calls the shared tick-mutex; each of these 8 already carries its own separate advisory/lease lock (or needs none), built assuming concurrent invocation. Granularity note, stated honestly: only infra-blocked (can block for minutes) was proven to need isolation from the others; the remaining 7 are split this fine because the operator wants independent restart/versioning of any single piece, not because each pairing was shown to conflict.
3. Fix-dispatch daemon -- we:scripts/conveyor/reconcile-fix-dispatch.mjs alone. Already cross-process-safe: fences its own resume-or-dispatch decision per PR through we:scripts/operations/action-store.mjs's durable, atomic (fs.openSync(path,'wx')) per-resource claim ledger, independent of the tick mutex.
4. Review daemon -- we:scripts/conveyor/reconcile-pass.mjs + we:scripts/operations/review-dispatch.mjs + we:scripts/conveyor/review-round-tag.mjs + we:scripts/conveyor/review-status-tag.mjs, kept together (one sequential pass over the same PR, not four things worth separating). we:review-dispatch.mjs already fences its dispatch the same way as we:reconcile-fix-dispatch.mjs; nothing in the other three's code objects to this grouping.
5. Verify daemon -- we:scripts/conveyor/verify-dispatch.mjs alone. THE ONE REAL GAP: its own header justifies blocking safety on 'the runner is a SINGLETON', a property that lives in we:skills-src/conveyor/runner.mjs today, not in this file. Needs we:runner-lock.mjs's lease primitive under its own distinct key BEFORE this is extracted.
6. Supervisor -- a thin top-level launcher reads a manifest and starts one existing, unmodified we:skills-src/conveyor/supervisor.mjs process per entry (its restart/backoff core already takes an injected spawnChild, so it needs no rewrite to manage N children internally). Its own manifest script-resolution must use a closed allowlist, generalized to every entry it can launch.

RESOLVED DURING REVIEW (do not re-litigate without new evidence):
- #2701 (ratified, we:docs/agent/platform-decisions.md) rules out an LLM conductor per lane and defers an LLM cross-lane supervisor. It does not forbid splitting a no-LLM runner into multiple no-LLM processes; the singleton constraint (we:runner-lock.mjs) is kept by the Dispatcher.
- #3403/#3404 (durable dispatch bookkeeping; lease heartbeated through mechanical passes) are both already resolved on this branch (dateResolved 2026-09-02).
- DRIVER_ID (we:scripts/operations/tick-mutex.mjs) is already hostname:pid:random, unique per process -- no cross-daemon collision to design around.
- we:scripts/lib/gh-throttle.mjs already exists and is cross-process-safe (a file-lock counting semaphore, built after a real secondary-rate-limit incident). Adoption is partial: we:scripts/conveyor/reconcile-pass.mjs, we:scripts/conveyor/parked-pr-conflict-watch.mjs, we:scripts/conveyor/parked-pr-progress-watch.mjs, we:scripts/conveyor/duplicate-pr-watch.mjs, and we:scripts/conveyor/reconcile-fix-dispatch.mjs all default their exec parameter to raw execFileSync instead of gh-throttle's execFileSyncThrottled (confirmed by direct read of each file). Fix is a one-line default swap per site -- same call signature, no behavior change beyond going through the shared cap.
- we:runner-lock.mjs's lease key is currently a hardcoded sentinel constant, not parameterized -- confirmed by reading the file. Needs a key parameter added (default = today's constant, for backward compatibility) before any second daemon (Verify) can take its own lease.
- Dispatcher-restart lease handling needs no new work: we:runner-lock.mjs already reclaims a stale lease via its 15-minute TTL, and the existing shutdown handlers already release the lease cleanly on a graceful stop. A Supervisor-restarted Dispatcher already behaves like today's restart path.
- main-ref-sync ordering: resolve by reusing we:review-dispatch.mjs's existing self-contained staleness check (assertMainNotStale) as a shared helper every non-Dispatcher daemon calls before acting, rather than inventing a new shared marker file. Keeps each daemon's safety self-contained instead of depending on the Dispatcher being healthy.
- Cutover: rolling, pass-by-pass. Stand up each new standalone daemon, let the old runner keep running that same pass too for a bake period (these passes already tolerate concurrent/duplicate runs -- idempotent labels, last-write-wins force-push, or already fenced through action-store), then drop the pass from the old runner's list. Exception: we:verify-dispatch.mjs must get its own lock BEFORE it ever runs standalone -- that is the one pass whose safety today genuinely depends on there being only one runner.

STILL OPEN (real, not resolvable from code alone): per-daemon credential/token scoping. No mechanism exists today to give each daemon a narrower GH/CI credential than the others; all would inherit the same environment. Needs an actual decision about credential infrastructure (a GH App or fine-grained tokens per daemon role) -- flagged as open, not solved here.

Care level: elevated (touches the singleton-lease/dispatch-safety invariants #2701/#2702 govern). This item is dev-ready for the resolved parts (gh-throttle default swap, runner-lock key parameter, supervisor-per-entry launcher, assertMainNotStale extraction, rolling per-pass cutover); the credential-scoping sub-task should stay decision-first (prepare it) rather than be batched as a build.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
