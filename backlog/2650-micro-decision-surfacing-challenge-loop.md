---
bornAs: x4ea5tr
kind: story
size: 8
parent: "2577"
status: resolved
scope: ["plateau-app:src/", "we:scripts/"]
dateOpened: "2026-07-24"
dateStarted: "2026-07-25"
dateResolved: "2026-07-25"
tags: []
---

# Micro-decision surfacing + challenge loop

Surface only CONTESTED forks one micro-choice at a time, with challenge, ask-a-question, and open-for-full-discussion affordances — the human analogue of the #2640 invite.

**Ratified forward-fit.** Part of the jury-of-#2576 disposition seam: the human only ever sees the forks worth their attention. Decision record: https://claude.ai/code/artifact/273a2dbd-402d-4bd4-98f4-ec45475a7052

Surface **only CONTESTED forks** — a per-fork contention classification produced by the judge decides which forks are contested and which auto-clear. Present them **one micro-choice at a time**, each with three affordances: **challenge** the proposed disposition, **ask a question**, or **open for full discussion**. This is the human analogue of the #2640 invite (a juror inviting another in), and it extends #2577's reopenable-surface: a disposed fork stays independently addressable and can be reopened. Spans the plateau-app console (`plateau-app:src/`) and the WE surfacing scripts at [we:scripts/](scripts/).

## Progress

Delivered as a cross-locus couple:

- **WE surfacing half** — [we:scripts/lib/micro-decision-surface.mjs](scripts/lib/micro-decision-surface.mjs): a pure `buildMicroDecisionQueue` that runs the #2652 disposition judge **per fork** (consuming `disposeVerdict`, not re-deriving contention), partitions the forks into **contested** (escalate → the surfaced queue, fork-order ascending) and **auto-cleared** (auto-dispose → never surfaced), and emits the `MicroDecisionSurfaceDTO`. Fail-closed is inherited from the judge — any fork it cannot prove safe surfaces as contested.
- **plateau-app console half** — `plateau-app:src/backlog-view/micro-decision-surface.ts` + `.css` on a new `/console-micro` route: a stepper that presents the contested forks **one micro-choice at a time**, each with the three affordances (**challenge** the disposition · **ask a question** · **open for full discussion** — a deep link to the #2577 ruling surface focused on the decision). A disposed fork stays independently addressable and is reopenable (challenge/question are withdrawable back to pending).
- **Follow-up** (#xeq9sha, blockedBy this): wire the live `GET /api/backlog/micro-decisions` read port over per-fork jury ledgers, persist challenge/question to a durable per-fork record, and add a nav link into `/console-micro`. Built view-first, exactly as #2580 preceded its write path.
