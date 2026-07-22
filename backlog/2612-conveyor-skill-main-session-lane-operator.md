---
bornAs: xkggoo0
kind: epic
parent: "2606"
status: open
dateOpened: "2026-07-22"
tags: [plateau-loop, conveyor, skill, lane, delivery]
---

# Conveyor skill: main-session lane operator

The interim swimlane-progression loop, run from a live session: the main session operates a conveyor of background delivery agents across the lane pool — dispatching scope-disjoint backlog items, watching PRs, and reviewing escalations — because the product conveyor (the #2527 console board) is not built yet and one-story-at-a-time delivery is too slow. Ratified 2026-07-22 (conveyor design session, Nicolas); child stories carry the scope. Parent: the delivery-throughput program #2606.

## Ratified shape (settled 2026-07-22)

Each point below is a settled design ruling from the session, recorded here so the slices build against it rather than re-opening it:

- **The main session is the operator seat.** The conversation about readiness, the queue verbs, and escalation review stay in the main session. Ticks arrive via **chained background sleep** — the proven wake path in the VS Code extension (ScheduleWakeup does not fire mid-run). Each tick executes a scripted dispatch plan by spawning **one background delivery agent per launch entry**.
- **Delivery agents stop at ready-to-merge.** The resident drain daemon (plateau:tools/drain-daemon/) is the **single landing serializer**. Green couples auto-land; escalations (statute-touching changes, review disagreement) park `review:human` and are reviewed in the main session.
- **Instant merge notification without push:** a throwaway background watcher process per in-flight PR polls `gh` and **exits on merge/park** — the exit rides the task-notification wake path, so the main session is woken instantly and dispatches into the freed lane the same turn. Upgrades to the daemon's `watch` verb (plateau:tools/drain-daemon/cli.mjs) when #2605 lands (#2605 is a consumer upgrade, **not** a blocker).
- **Idle-wait stop:** queue empty + no user feedback for a configured window → the conveyor stops itself.
- **State is reflected on the lane board FOR FREE.** Agents work only through the normal verbs (claim → lane clone → lane/NNN branch → PR → daemon merge → resolve), which are exactly the channels plateau's board reads (plateau:src/backlog-view/lane-board-data.ts — `claimed.session`, `queued.lane`, `pr.state`+`ci`, the scope-lease collect; console design record plateau:docs/backlog-console-design.md §3i). **No parallel state store, ever.**
- **Deterministic core, thin judgment** per [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](docs/agent/platform-decisions.md#deterministic-core-thin-judgment) (#2607): the dispatch plan, state reads, watchers, idle clock, and health checks are scripts; judgment is scope prediction, building, escalation review, and the readiness discussion.

## Slices

Dispatch-plan script + `scope:` field (#2609), tick state-read script (#2611), the /conveyor skill itself (#2613, blocked on the two scripts), the delivery-agent brief + merge watchers (#2608), and the learnings drop-box + close-session sweep (#2614). The later product-feedback epic (#2610, under #2527) reuses the drop-box seam when the console goes multi-tenant.
