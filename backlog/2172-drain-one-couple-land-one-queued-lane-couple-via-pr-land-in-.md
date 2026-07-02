---
kind: story
size: 5
parent: "2162"
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: none
tags: []
---

# Drain-one-couple: land one queued lane couple via pr-land in manifest order (#2138 drain core)

The core of the #2162 deferred drain. Given one queued item + its `we:.lane-manifest.json`, land its lane refs via `we:scripts/pr-land.mjs` in impl-first/WE-last order, confirm the WE resolve reachable on main, then unqueue + delete the manifest. Pure planner (orders repos, decides land-vs-skip) + CLI wrapper + tests.

## Progress

**Resolved 2026-07-02.** Shipped the drain core as `we:scripts/lane-drain.mjs` (subcommand `drain-one <NNN> --manifest=<path>`):

- **Pure planner `planDrain(manifest, queuedState)`** — consumes the three shipped primitives (`we:scripts/readiness/lane-manifest.mjs` #2163, `we:scripts/readiness/queued-state.mjs` #2161, `we:scripts/pr-land.mjs` #2153). Decides: **order** (impl-first/WE-last via `orderedRepos`), **readiness** (a cross-item `blockedBy` still queued → `ready:false` + `waitOn`, defer), and validity (invalid manifest or not-queued → `ok:false`). `buildPrLandArgs` builds the per-repo pr-land invocation (WE = no `--repo`; impl repos get `--repo=<path>`; forwards `--body-file` for the #2170 dismissals). Both unit-tested (`we:scripts/__tests__/lane-drain.test.mjs`, 10 green).
- **CLI** lands each repo's `lane/*` ref via pr-land in order, **STOPS at the first failure** (impl-first/WE-last atomicity — a failed impl means WE's resolve never lands, so the item is never falsely resolved; exit 2), and on a full land confirms the WE resolve reachable on `origin/main` then clears the queued marker via `we:scripts/backlog.mjs unqueue` (the single clear point, #2161). Contract-guarded: re-uses pr-land, never re-implements the merge.
- **Dogfooded** the CLI's decision paths live: not-queued refusal, the `--dry-run` ordered plan, and the blockedBy-still-queued **defer** — all correct.

**Scope boundary (the other #2162 slices):** end-to-end draining of a *real* queue needs producers to populate it — that is **#2174** (producer stop-at-push: lanes stop at pushed+queued+manifest instead of integrating inline). The outer **monitor/watch loop** that discovers which queued item to drain and reads its manifest off the WE lane ref is **#2173**; the **reopen-on-fail** reconcile (leave a failed couple queued, `active→open` a stranded item, + the post-land `we:.lane-manifest.json` delete-from-main) is **#2175**. This slice is the couple-lander they all call. Landed itself via pr-land (dogfood, PR-flow).
