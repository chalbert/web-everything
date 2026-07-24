---
bornAs: x4ea5tr
kind: story
size: 8
parent: "2577"
status: open
scope: ["plateau-app:src/", "we:scripts/"]
dateOpened: "2026-07-24"
tags: []
---

# Micro-decision surfacing + challenge loop

Surface only CONTESTED forks one micro-choice at a time, with challenge, ask-a-question, and open-for-full-discussion affordances — the human analogue of the #2640 invite.

**Ratified forward-fit.** Part of the jury-of-#2576 disposition seam: the human only ever sees the forks worth their attention. Decision record: https://claude.ai/code/artifact/273a2dbd-402d-4bd4-98f4-ec45475a7052

Surface **only CONTESTED forks** — a per-fork contention classification produced by the judge decides which forks are contested and which auto-clear. Present them **one micro-choice at a time**, each with three affordances: **challenge** the proposed disposition, **ask a question**, or **open for full discussion**. This is the human analogue of the #2640 invite (a juror inviting another in), and it extends #2577's reopenable-surface: a disposed fork stays independently addressable and can be reopened. Spans the plateau-app console (`plateau-app:src/`) and the WE surfacing scripts at [we:scripts/](scripts/).
