---
kind: story
size: 8
status: open
dateOpened: "2026-07-02"
tags: [lane, pr-flow, merge-queue, integrator, session-tooling]
blockedBy: ["2153", "2161", "2163"]
relatedTo: ["2138", "2123"]
---

# Relocate lane landing to a standalone deferred drain/monitor command (#2138): move the in-run integrator out into a human-launched unified merge command

The **spine of #2138** (settled top-level): move the integrator that today runs **inline** in `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` (Phase 4 — merge each `lane/*` one at a time, full gate per merge, rebase-and-retry, impl-first/WE-last, delete ref after land, regen derived once) **out of the producing run** into a standalone command a human launches as ready lanes accumulate. Every lane-producing session (parallel `/workflow` **and** solo `#2123` lanes) then stops at "lane pushed + marked ready-to-merge"; the drain monitors the queue and drains it serially under the existing integrator contract. Consumes the three parts: the ready-to-merge token (#2161, Fork 4) to find queued items, the lane manifest (#2163, Fork 2) for each item's couple shape/order, and the PR substrate (#2153, Fork 5) for the merge transport. **Blocked on all three.** Likely needs slicing at claim time (monitor loop · drain-one-couple · producer stop-at-push · reopen-on-fail) — a story·8 placeholder for the spine; re-size/split when its blockers clear. NOTE: reuse `we:scripts/push-if-green.mjs` (the shared land helper) rather than re-implementing the ff-push.
