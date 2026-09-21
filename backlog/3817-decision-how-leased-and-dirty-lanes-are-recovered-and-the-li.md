---
bornAs: x0hik3k
kind: decision
parent: "3383"
status: resolved
scope: ["we:scripts/lane-pool.mjs", "we:scripts/conveyor/lease-reaper.mjs", "we:scripts/lib/lane-lease.mjs"]
dateOpened: "2026-09-21"
dateStarted: "2026-09-21"
dateResolved: "2026-09-21"
codifiedIn: one-off
preparedDate: "2026-09-21"
preparedAgainstSha: "12dd24e0e934a05a442335426480f6ef7e8e880b"
relatedTo: ["3815", "3407", "3669", "3657", "3813"]
tags: []
---

# Decision: how leased and dirty lanes are recovered, and the live-lease invariant (#3815)

Rule how the lane pool recovers from leases that outlive their work and from lanes left dirty by abandoned work. Decisions are reviewed only in decision cards (operator rule 9, 2026-09-21), so the choice from story #3815 moves here; #3815 stays the build card. Options and defaults are copied from #3815, nothing re-researched. #3815's three open questions are forks below, each with the least invasive option marked. Ratified 2026-09-21: Forks 1 to 3 kept their defaults; Fork 4's default was changed (see the Ruling).

## FOUND (from #3815, re-checked there against main `a4ff83ea6`)

- On 2026-09-21 four lanes stayed leased to finished sessions (lane-35, an aborted `prepare-3746-and-3753`; lane-51, `build-3468`, its PR long landed; lanes 65 and 68, `fix-pr-2392-c`, whose acquire attempts were REFUSED yet left a lease), and about 40 more sat dirty from abandoned claim flips and scratch files, so `list --acquirable` showed almost nothing. They were recycled by hand; the salvage folder holds 70 entries (a directory plus a `.patch` per lane).
- Refused acquire keeps the lease: `tryClaimLane` (we:scripts/lane-pool.mjs:864) writes the lease marker (:1101, :1175) BEFORE the #3390 and #2924 refusals (:1133-1138, :1218-1223), and `fail()` (:768) exits with no rollback. This is #3407.
- A finished worker with a purpose-named session is never reaped: `itemNumFromSession` (we:scripts/conveyor/lease-reaper.mjs:119) returns `null` for `prepare-3746-and-3753`, `build-3468` and `fix-pr-2392-c`, so `sessionGoneForLease` (:345) never fires, and `reapDeadLeasesInPool` (we:scripts/lane-pool.mjs:952) reaps only on a PR-terminal signal when `isLeaseStale` holds (default 240 minutes, we:scripts/lib/lane-lease.mjs:35, :46). This is #3669's class.
- What neither #3407 nor #3669 covers: a standing recovery for the two safe dirty classes (a lane dirty only by a one-line claim flip, a lane holding only known scratch files), and the worker side (whether a brief must end with a `release`).

## The invariant — required for every option, not a fork

**A lease that is live and not stale blocks any destructive lane operation.** A lane dirty only by a one-line claim flip is also exactly how a LIVE worker's lane looks early in its work (it has just claimed an item and flipped the status line), so "looks like a claim flip" cannot be the janitor's only test; lease liveness is checked first, and the rule holds for every option (a) to (d), not just the janitor. The independent review of PR #2400 raised this, and #3815's Done-when item 3 now has a named case for it. Destructive operations are at least: reset, clean, salvage-then-clean, release, and re-lease to another session. What "live and not stale" means exactly is Fork 2.

## Recommended path at a glance

| Fork | Default | Main alternative, and why it is excluded |
| --- | --- | --- |
| 1 — what this card builds | **(d) the janitor for the two safe dirty classes; (a) and (b) ship as #3407 and #3669; (c) added to briefs as belt and braces** | (c) alone: fails exactly when a worker is stopped or refused mid-task |
| 2 — what "live and not stale" means | **(a) exactly `isLeaseStale` returning false** | (b) a stricter signal: needs a liveness source that does not exist yet |
| 3 — the two safe dirty classes | **(a) a closed list kept in one place** | (b) a heuristic: a live worker's lane can match it |
| 4 — when the janitor runs | **(a) automatically, when the runner tick finds fewer acquirable lanes than a floor** | (b) standing every tick: no floor to invent, but a pass on every tick; (c) manual only: fails silently, the same trap as Fork 1 (c) |

## Fork 1 — What this card builds

*Fork-existence:* four fixes are possible and two are already filed elsewhere; the card must say which one it builds, so the same fix is not built twice and the one nothing else builds is not dropped.

- **(a) Release the lease on a refused acquire.** This is #3407. Small and local. Rejected as this card's build: it is #3407's fix, and it does nothing for the ~40 dirty lanes.
- **(b) Reap a lease whose holder session has finished**, in the session reaper or in `list --acquirable`. This is #3669, extended to purpose-named sessions. Needs a liveness signal for a session that has no item number: the `claude agents` listing, or a heartbeat. Rejected as this card's build: it is #3669's fix, and it does nothing for dirty lanes.
- **(c) Worker briefs end with a release.** Cheapest, but it depends on the model remembering, and the failure above happened exactly when a worker was stopped or refused mid-task. Rejected as the fix; belt and braces only.
- **(d) A janitor operation for the two safe dirty classes — recommended** (#3815's proposed default). Triggered as Fork 4 rules: salvage first (the same patch-plus-directory format the salvage folder uses), then clean and release. Refuses any lane with real uncommitted work, and any lane whose lease is live and not stale (the invariant). This is the piece nothing else builds. #3815's default in full: (a) and (b) ship as the fixes of #3407 and #3669, not here; this card builds (d), with (c) added to worker briefs as belt and braces.

**Skeptic:** SURVIVES-WITH-AMENDMENT (from the PR #2400 review, recorded on #3815). The janitor's claim-flip class matches a live worker's lane; the amendment is the invariant above, now a named Done-when case on #3815.

## Fork 2 — What "live and not stale" means

*Fork-existence:* #3815 asks it: is "live and not stale" exactly `isLeaseStale` (we:scripts/lib/lane-lease.mjs) returning false, or does the janitor need a stricter signal for a purpose-named session that has no item number? #3815 states no default.

- **(a) Exactly `isLeaseStale` returning false — recommended** (the least invasive: one definition, already used by the pool reaper). A lease younger than the stale window (default 240 minutes) blocks every destructive operation, whatever its session's name. Note: `isLeaseStale` measures age since `acquiredAt` (we:scripts/lib/lane-lease.mjs:46); nothing renews it, so it is not a heartbeat. A live worker running longer than the window counts as stale, exactly as `acquire` already treats it today. This option accepts that; the janitor still refuses any lane with real uncommitted work.
- **(b) A stricter signal for purpose-named sessions** (the `claude agents` listing, or a heartbeat). Rejected as the default: the signal does not exist yet (it is part of #3669's fix), and (a) matches how `acquire` already treats leases: a fresh lease blocks the janitor for the stale window.

**Skeptic:** not run as a separate pass; #3815 raises the question without a verdict.

## Fork 3 — Is each safe dirty class a closed list kept in one place

*Fork-existence:* #3815 asks it: are "one-line claim flip" and "known scratch file" a closed list kept in one place? The janitor deletes work, so what counts as safe must be decided before it runs. #3815 states no default.

- **(a) A closed list in one module — recommended** (the least invasive in what it can destroy): the claim-flip shape (one `status:` line changed in one backlog card) and the scratch-file names are listed once, and anything else makes the lane "real work", left untouched and named in the output.
- **(b) A heuristic** (for example "small diff, only under `backlog/` or a temp folder"). Rejected: a heuristic widens what the janitor may delete, and a live worker's early lane can match it; salvage-first limits the loss but does not remove it.

**Skeptic:** not run as a separate pass; #3815 raises the question without a verdict.

## Fork 4 — When the janitor runs

*Fork-existence:* #3815 asks it: does the janitor run standing (a tick) or only when `list --acquirable` comes back thin? #3815 states no default.

- **(a) Automatically, when the runner tick finds fewer acquirable lanes than a floor — recommended.** The tick counts lanes in `list --acquirable`; below the floor it runs the janitor, at or above it does nothing. Nobody has to notice a thin pool or remember to run anything, and the janitor still runs only when the pool needs lanes. The floor is one named constant (its value is set when #3815 is built); every pass stays gated by the invariant, the closed list of Fork 3 and salvage-first.
- **(b) Standing, on every runner tick.** Rejected as the default: it needs no floor, but it runs a destructive pass on every tick, mostly no-ops. It can be switched on later if the floor proves hard to tune.
- **(c) Manual only (an operator or agent runs the janitor when the pool looks thin).** Rejected: it depends on someone noticing and remembering, the same weakness that rules out Fork 1 (c), and the incident that opened #3815 was found by hand after the pool had already run dry. The janitor verb stays runnable by hand as well.

**Skeptic:** the on-demand default the card was prepared with (run by hand when the pool looks thin) was challenged in the ratification discussion on 2026-09-21 and replaced by (a). Not run as a separate pass; the remaining risk is that the floor is a new knob to tune, which (b) is the fallback for.

## Not in this decision

The fixes of #3407 and #3669 stay on those cards. #3657 (npm output leaking into the lane path) is a different defect. The build and its executable Done-when stay on #3815.

## Ruling (2026-09-21)

Ratified by the operator (Nicolas Gilbert) on 2026-09-21 with the explicit words "I ratify 3817", after the review and discussion in this session.

- **Invariant:** a live, non-stale lease blocks every destructive lane operation, for every option.
- **Fork 1 — (d):** build the janitor for the two safe dirty classes; (a) and (b) ship as #3407 and #3669; (c) is added to worker briefs as belt and braces.
- **Fork 2 — (a):** "live and not stale" is exactly `isLeaseStale` returning false, with the age-since-acquire caveat noted in the fork.
- **Fork 3 — (a):** the two safe classes are a closed list in one module (the one-line claim flip; named scratch files). Anything else is real work: untouched and named in the output.
- **Fork 4 — (a), changed from the prepared default:** the runner tick runs the janitor automatically when the acquirable-lane count falls below a floor. The floor is one named constant, its value chosen in #3815's build. The prepared default (on demand, by hand) is superseded.

Follow-through: #3815's `blockedBy` on this card is cleared and its Done-when gains a floor-trigger case.

## Done when

1. **Executable** — `grep -l '^## Ruling' we:backlog/*how-leased-and-dirty-lanes-are-recovered*.md` lists this card (it fails until the operator has ruled and a `## Ruling` section names the chosen option for each of the four forks).
2. #3815's `## Done when` is rewritten if the ruling picks other than Fork 1 (d), and #3815's `blockedBy` entry on this card is cleared when the ruling lands.
