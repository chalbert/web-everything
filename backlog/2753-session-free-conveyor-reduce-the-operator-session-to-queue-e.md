---
bornAs: xthv8dq
kind: epic
status: open
dateOpened: "2026-07-28"
relatedTo: ["2677", "2445", "2527", "2626", "2636", "2464", "2703"]
tags: [conveyor, session-free, plateau-loop, roadmap]
---

# Session-free conveyor — reduce the operator session to queue + expose-state

The path from today's session-operated conveyor to a session-free, app-run conveyor is real but scattered across several epics (#2677 done, #2445, #2527, #2636, #2626) with no single coordinating roadmap. This epic **owns that end-to-end "get to app-run" story**, which is currently un-owned. It does not duplicate the existing items' scope — it **sequences** them into one DAG and names the critical path, plus it closes two unfiled gaps. The crisp target is a hard line: the operator session (or any session) should do **only what the product UI does** — queue items to the conveyor and read state — and everything else moves into the runner/app.

## Target state / the residue

When this epic is done, an operator session does **exactly two things** — the same two the product UI does:

1. **Queue items** to the conveyor — `node [we:scripts/conveyor/queue.mjs](../scripts/conveyor/queue.mjs) add <NNN…>`.
2. **Expose / read state** — surface what's running, what's blocked, what landed.

Everything else the session does today is **mechanized into the session-free runner/app**, not performed by a model in a chat: agent-spawning, PR-watch, review-label routing, lane-reap / release, resolve-on-land, board generation, and ratification execution. The session becomes a thin operator surface over a runner that needs no session to keep delivering.

## Already done (do not re-file)

The mechanical core of the tick already landed — this epic sequences what remains, it does not redo this:

- **#2699** — the conveyor tick core is a tested state machine (dispatch orchestration + the three guards + watcher arming). Resolved.
- **#2700** — ghost-release wired into the tick (lease-reaper + `pr-watch --release-session`) plus the health/stall scan. So **lane-reap / release** is mechanized. Resolved.
- **#2702** — a headless per-lane runner drives the mechanical tick core for one lane. Resolved.
- **#2703** — retired the main-session **serial** tick loop.

**Read #2703's nuance precisely: it means "serial tick retired," NOT "session-free."** After #2703 the main session no longer runs a chained-sleep tick, but it **still supervises the runner and still spawns the delivery agents** — that supervision is a named **interim bridge**, not the end state. The session-in-the-loop is smaller, not gone. This epic is what removes the rest of it.

## The sequence to zero-session (the DAG)

The open items below, in dependency order, are what still stands between "serial tick retired" (#2703) and "no session in the loop":

1. **#2464 — agent-runner CLI backend — the LONG POLE / critical path.** It spawns the local `claude` CLI as supervised children from the runner. This is *the one open item that removes agent-spawning from the session* — until it lands, a session must still spawn the delivery agents (the #2703 interim bridge above). **Flag it as the critical path; nothing downstream reaches zero-session without it.**
2. **#2418 — coordinator delegates the review pipeline.** The main loop stops running the review glue by hand and delegates it (scripts the glue, templates the renders). Review pipeline feeders: **#2636 / #2649 / #2642** (jury-based PR review to convergence, the subject-agnostic jury engine, and juror management).
3. **#2626 (ratify) + #2742 (DO/D1 operational-state store).** #2626 decides the operational state store (session-local sidecars now → a shared DO/D1 store at product). #2742 stands that shared store up so a **session-free runner can read operational state cross-session**. #2742 is `blockedBy` #2703 (✓), #2626, and #2642.
4. **#2505 / #2555 / #2508 — the console surface.** The operable backlog console, the launch-review board, and operable backlog actions (claim / prioritize / launch / resolve from the UI). This **replaces the chat as the operator UI** — the "expose/read state" half of the target, made a real surface.
5. **#2445 / #2527 — the Plateau Loop app that hosts the runner with no session.** The delivery machinery extracted into a coordinator product / autonomous AI build queue — the runner's session-free home.

## The gaps this epic closes (its two children)

Two mechanizations on the critical path were un-owned; this epic files them as children:

- **Shadow→enforce flip for decision auto-ratification** (child 2754). #2704 mechanized decision auto-disposition/auto-ratify but runs **shadow-only** — nothing tracks turning it on. Without the flip, ratification still needs a human in the loop, so a session can't fully leave.
- **Mechanize epic-resolve-on-last-child out of the session** (child 2752). Today `/resolve` for an epic is a session-run skill; the runner/drain should resolve an epic when its final child lands.

## Ownership note — sequences, does not duplicate

This epic is a **roadmap / coordinator**: it owns the ordering, the critical-path call, and the two gap children. It is intentionally **not nested under another epic** because it spans several (#2677, #2445, #2527, #2626, #2636). Each referenced item keeps its own scope; this epic only makes the "get to app-run" story a single owned thing, with a named long pole (#2464) and a clear finish line (session = queue + expose-state, nothing more).
