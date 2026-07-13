---
bornAs: xwqsfbu
kind: epic
parent: "2445"
status: resolved
dateOpened: "2026-07-12"
dateStarted: "2026-07-13"
dateResolved: "2026-07-13"
tags: [plateau-loop, ui, console]
---

# Plateau Loop operable console — manage and operate the drain daemon from the browser

The operable-UI half of the Plateau Loop DoD ([#2445](/backlog/2445-plateau-loop-extract-the-delivery-machinery-into-a-coordinat/)):
manage the resident drain daemon's lifecycle and operate the merge-queue / review / finish
flows from the browser. Buildable **now** against the shipped phase-1 daemon
(`plateau:tools/drain-daemon/`) and its dev-panel seed (`plateau:tools/dev-panel/drain-daemon.html`)
— it does not wait on the runner decision ([#2444](/backlog/2444-plateau-loop-phase-1-agent-runner-shape-cli-spawn-contract-s/))
or the [#2456](/backlog/2456-review-the-drain-daemon-s-first-weeks-of-operating-evidence/) evidence gate.

## Growth path — the WE backlog UI morphs into this (operator direction, 2026-07-12)

This console is **not** greenfield. The existing Web Everything `/backlog/` surface (memory: *Backlog
Is The Tracker* — `/backlog/` renders from `backlog/*.md`) is the seed. Plateau Loop grows **over** it
incrementally: the same tracker UI slowly gains build status and orchestration, and gains the ability to
handle **multiple backlogs from multiple repos** — not the merge queue alone. The end state is a
multi-repo backlog + build-status + orchestration console.

Boundaries on the morph:
- **Built over, not copied.** No fork-and-diverge of the WE UI into plateau. It is grown in place / lifted
  incrementally, so the two never run as two codebases of the same surface.
- **WE is not deleted.** No rush to remove anything from the WE website; the WE backlog surface keeps
  working throughout. Deletion, if ever, is a late and separate call.
- **Per-repo backlog is the data-model prerequisite.** Multi-repo orchestration needs each repo to own its
  own `backlog/*.md` (today they live only in WE) — tracked as its own foundational item under the registry.

## Slices (daemon-first, then queue → review → finish)

Ordered so you operate the daemon **process** before the queue it drains:

1. **Daemon lifecycle** — start / stop / restart / health / review the daemon process itself.
2. **Queue & lease board** — live merge queue, `blockedBy` edges, lease holder + TTL, sole-writer.
3. **Drain operate controls** — pause / resume / force-sweep / skip + the drain policy surface.
4. **Review console** — parked/escalated PRs with findings; swap review labels from the UI.
5. **Finish surface** — stuck lanes and take-over/finish state.
6. **Incident timeline** — drain-class incidents, restart-recovery, lease-loss (also feeds #2456).

## Lineage

Surfaced 2026-07-12 in the first [#2445](/backlog/2445-plateau-loop-extract-the-delivery-machinery-into-a-coordinat/)
watch run (front-A completeness pass — the DoD's operable-UI surface had zero build items). The
multi-repo / morph framing is the operator's direction from that session.

## Resolution (2026-07-13) — all 7 slices shipped

The resident drain daemon is now observable + operable from the `plateau:tools/dev-panel/drain-daemon.html` surface. Slices delivered:
- **Daemon lifecycle** ([#2467](/backlog/2467-loop-console-daemon-lifecycle-start-stop-restart-health-and-/)) — residency / lease / counters + start/stop/restart/once.
- **Review console** ([#2470](/backlog/2470-loop-console-review-console-parked-escalated-prs-with-findin/)) — parked-PR expand + browser accept / request-changes, INVARIANT-2-guarded.
- **Queue & lease board** ([#2471](/backlog/2471-loop-console-queue-lease-board-live-merge-queue-blockedby-ed/)) — the drain's dry-run plan (ordered toMerge, blockedBy edges, parked/skipped) + lease holder / TTL / sole-writer.
- **Incident timeline** ([#2473](/backlog/2473-loop-console-incident-timeline-drain-class-incidents-restart/)) — drain-fail / dup-NNN / lease-contention + restarts.
- **Operate controls v1** ([#2466](/backlog/2466-loop-console-drain-operate-controls-pause-resume-force-sweep/)) — pause / resume (lease-held freeze) + a read-only policy & config surface.
- **Finish surface** ([#2477](/backlog/2477-loop-console-finish-surface-stuck-lanes-and-take-over-finish/)) — stuck lanes classified via the WE finish flow.
- **Structured incident markers** ([#2481](/backlog/2481-loop-console-structured-restart-recovery-lease-loss-incident/)) — restart / lease-loss emitted as structured `incidents.jsonl` records into the timeline.

Each impl is single-sourced in WE (review core / drain / lane-resume) and shelled through the dev-panel bridge, so the surface moves cleanly to whatever home [#2446](/backlog/2446-where-does-plateau-loop-live-plateau-app-module-own-repo-or-/) (placement) later picks. The longer-term **morph over the WE `/backlog/` UI into a multi-repo backlog + orchestration console** (the epic's end-state direction) remains future work, tracked under [#2472](/backlog/2472-plateau-loop-multi-project-registry-manage-we-frontier-ui-and/).
