---
bornAs: xelgqmw
kind: task
parent: "3383"
status: open
scope: ["we:scripts/lane-pool.mjs", "we:scripts/conveyor/lease-reaper.mjs", "we:skills-src/conveyor/runner.mjs", "we:scripts/readiness/dispatch-plan.mjs"]
relatedTo: ["3435", "3427", "2748", "2667", "2700"]
dateOpened: "2026-09-01"
tags: [conveyor, lane-pool, lease, reconcile, liveness]
---

# Lane-pool lease reconciliation must not depend on an actively-ticking conveyor session

Twice tonight (2026-09-01/02), a `prepare-scope` / `prepare-decision` / `conveyor-*` build session finished
and its PR merged, but the lane it leased via `we:scripts/lane-pool.mjs acquire` stayed held indefinitely
with no live process behind it. First occurrence: 12 stale leases found and force-released ~20:13. Second
occurrence, roughly an hour later: 10 of 12 held leases were again confirmed stale (every one's PR already
merged) and force-released. Both times, releasing them immediately unblocked real capacity — the second
time, `we:scripts/readiness/dispatch-plan.mjs`'s launch plan went from 2 launchable items to 5 the instant
the stale leases cleared. This starves throughput; it is not cosmetic.

This is the TWIN of `#3435` (which reaps finished `claude agents` session *listings*) — same underlying
shape (a resource outlives the process that acquired it, because nothing reconciles it against reality
independent of a live driving session), but a **different resource**: `#3435` is about `claude agents`
registrations; this is about `we:scripts/lane-pool.mjs`'s own `.lane-lease` marker files. Fixing one does
not fix the other.

## Root cause — verified against the tree, not assumed

The system already has real machinery for this, and on paper it looks well-defended. Three separate paths
exist to clear a dead lease:

1. **Delivery/prepare agents deliberately never release their own lane.** `we:skills-src/conveyor/delivery-agent-brief.md` step 10, `we:skills-src/conveyor/prepare-scope-agent-brief.md` step 7, and
   `we:skills-src/conveyor/prepare-decision-agent-brief.md` step 7 all explicitly instruct: "Do NOT release
   the lane — the resident drain daemon lands the PR." This is **by design**, not an oversight — all three
   briefs correctly wire a `--session=conveyor-<num>` / `prepare-<num>` / `prepare-decision-<num>` lease so a
   later process can reconcile it. The gap is not a missing release step in the prepare-scope/prepare-decision
   templates — both already mirror the build brief's design intent.
2. **The intended reconciler is `we:scripts/conveyor/pr-watch.mjs --release-session=<slug>`**, a background
   watcher armed per open PR by `armWatchers` (`we:scripts/conveyor/tick-core.mjs`), which correctly derives a
   `prepare-<num>` / `prepare-decision-<num>` / `conveyor-<num>` slug per PR
   (`releaseSessionForNum`, `we:scripts/conveyor/tick-core.mjs:582`) and releases across every pool on merge
   (`releaseSessionAcrossPools`, `we:scripts/conveyor/pr-watch.mjs:272`).
3. **The backstop is `we:scripts/conveyor/lease-reaper.mjs`**, a pure/IO-split reaper whose `itemNumFromSession`
   grammar already recognizes exactly the four session shapes the dispatcher mints
   (`conveyor-`, `prepare-`, `prepare-decision-`, `fix-`), and whose `pr-merged`/`pr-closed` axis is real (one
   `gh pr list`, matched by `lane/<num>-*` head ref).

**All three of those paths are coupled to a live, actively-ticking `/conveyor` session — none is
independent of one:**

- `we:scripts/conveyor/pr-watch.mjs` watchers (path 2) are spawned as background processes by the
  `/conveyor` skill session itself (never by the delivery/prepare agent, and never by anything resident) —
  if that session is not running, no watcher is armed and none fires on merge.
- The periodic sweep of `we:scripts/conveyor/lease-reaper.mjs` (path 3) is invoked from exactly one place:
  `we:skills-src/conveyor/runner.mjs`'s tick loop (a `runQuiet` call against
  `we:scripts/conveyor/lease-reaper.mjs`, line ~195) — which only executes while a `/conveyor` session is
  actively driving that tick loop. There is **no cron/launchd job, no standing daemon, and no other caller**
  anywhere in the tree that invokes `we:scripts/conveyor/lease-reaper.mjs` (confirmed by a repo-wide search)
  on any schedule independent of that session.
- The **one process that genuinely runs continuously, unattended** — `plateau:tools/drain-daemon` (the
  resident merge-landing daemon) — never calls `we:scripts/conveyor/lease-reaper.mjs` at all. It only
  touches `we:scripts/lane-pool.mjs` for its own dedicated single-lane pool.
- `we:scripts/lane-pool.mjs`'s own `acquire`-time whole-pool reap backstop (`reapDeadLeasesInPool`, #2748)
  *does* scan every held lease in the pool on the pr-merged/pr-closed axis and *would* have caught these
  ghosts — but it only runs as a side effect of a **fresh `acquire` call**. `we:scripts/readiness/dispatch-plan.mjs`
  derives free lanes via a `list --acquirable --json` call against `we:scripts/lane-pool.mjs`
  (`we:scripts/readiness/dispatch-plan.mjs:368-376`), a pure **read** that never triggers this backstop. So
  the observed deadlock is exact and mechanical: the pool looks saturated with stale leases → the dispatch
  plan reports low/no launchable capacity → nobody calls `acquire` → the one reap path that doesn't need a
  live `/conveyor` tick never fires → the pool stays saturated. Both incidents tonight only broke that loop
  because a human manually ran `release --force`.

In short: **every reconciliation path this system has is gated on a session actively ticking `/conveyor`, or
on a fresh `acquire` happening — and the read-only capacity check that decides whether to dispatch more work
can never itself unstick the one gate (`acquire`) that would clear the ghosts.** This is exactly the shape
`#3383`'s epic exists to close (no background mechanical dispatcher yet replaces the interactive session as
delivery supervisor) and the same shape as `#3435` for a different resource. It is also squarely `#3427`'s
(the "operation manager" chokepoint decision, still being prepared under this epic) territory: a real
execution chokepoint every command routes through is exactly what would make this reconciliation
session-independent by construction, rather than an artifact of who happens to be ticking `/conveyor` right
now.

## Done when

1. **Independent of an active `/conveyor` session** — lane-pool lease reconciliation (the `pr-merged` /
   `pr-closed` axis `we:scripts/conveyor/lease-reaper.mjs` already implements) runs on a cadence that does
   NOT require a live `/conveyor` runner tick to be in progress. Concretely, at least one of:
   - the already-resident `plateau:tools/drain-daemon` poll loop also sweeps
     `we:scripts/conveyor/lease-reaper.mjs` (or an equivalent pool-wide reap) each cycle, since it is the
     one process proven to run continuously unattended; or
   - `we:scripts/lane-pool.mjs`'s read-only free-lane query (`list --acquirable`, the path
     `we:scripts/readiness/dispatch-plan.mjs` calls) itself triggers (or is always preceded by) the same
     provably-dead-ghost whole-pool reap `acquire` already runs (`reapDeadLeasesInPool`), so a capacity read
     can never under-report just because reaping today is acquire-gated.
   Either resolves the circular deadlock named above; a design that leaves reconciliation solely inside the
   `/conveyor` skill-session tick loop does not satisfy this.
2. **A real regression test** proves the fix: given a fabricated pool with N `.lane-lease` markers whose
   sessions match the recognized grammar (`conveyor-<num>` / `prepare-<num>` / `prepare-decision-<num>` /
   `fix-<num>`) and whose PRs are (fabricated as) merged, running ONLY the fixed reconciliation path — with
   no `/conveyor` session active and no `acquire` call made — still reclaims every one of them. The test must
   fail against the pre-fix code (i.e. it exercises exactly the gap this card names, not a restatement of
   `we:scripts/conveyor/__tests__/lease-reaper.test.mjs`'s existing pure-core coverage, which already passes
   today).
3. **A reserved lease is still never touched** by whatever new cadence this adds — `classifyReap` already
   excludes `isReservedLease` on every axis (#2350); the new caller must not bypass that by calling a lower
   layer directly.
4. **No duplication with `#3435`.** `#3435` owns reaping/stopping finished `claude agents` session
   *registrations*; this card owns lane-pool `.lane-lease` *marker* reconciliation. If the eventual fix for
   either card naturally generalizes into one shared "reconcile-without-a-live-session" primitive, that is a
   welcome outcome, not a requirement — do not block this card on `#3435` landing first, and do not fold
   `#3435`'s scope in here.
