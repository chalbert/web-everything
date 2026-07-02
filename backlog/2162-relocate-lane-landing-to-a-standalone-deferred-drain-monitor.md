---
kind: epic
status: open
dateOpened: "2026-07-02"
tags: [lane, pr-flow, merge-queue, integrator, session-tooling]
dateStarted: "2026-07-02"
relatedTo: ["2138", "2123"]
---

# Relocate lane landing to a standalone deferred drain/monitor command (#2138): move the in-run integrator out into a human-launched unified merge command

The **spine of #2138** (settled top-level): move the integrator that today runs **inline** in `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` (Phase 4 — merge each `lane/*` one at a time, full gate per merge, rebase-and-retry, impl-first/WE-last, delete ref after land, regen derived once) **out of the producing run** into a standalone command a human launches as ready lanes accumulate. Every lane-producing session (parallel `/workflow` **and** solo `#2123` lanes) then stops at "lane pushed + marked ready-to-merge"; the drain monitors the queue and drains it serially under the existing integrator contract. Consumes the three parts: the ready-to-merge token (#2161, Fork 4) to find queued items, the lane manifest (#2163, Fork 2) for each item's couple shape/order, and the PR substrate (#2153, Fork 5) for the merge transport — all three now resolved. NOTE: reuse `we:scripts/pr-land.mjs` (the #2153 PR transport) + `we:scripts/push-if-green.mjs` (the shared ff-push helper) rather than re-implementing the merge.

## Sliced at claim (2026-07-02) — the spine's four pieces

Blockers cleared, so the story·8 placeholder is split into four agent-ready child slices (this item is now the tracking **epic**). The **core** is drain-one-couple; the rest depend on it:

- **#2172 — drain-one-couple (core spine).** Given one queued item + its `we:.lane-manifest.json`, land its lane refs via `we:scripts/pr-land.mjs` in impl-first/WE-last order, confirm the WE resolve reachable, then `unqueue` + delete the manifest. Pure planner + CLI + tests. *Ready now.*
- **#2173 — monitor/watch loop.** Poll `we:.claude/skills/batch-backlog-items/queued.json`, order by cross-item `blockedBy`, drain ready couples serially via #2172, regen derived artifacts once at the end. *blockedBy #2172.*
- **#2174 — producer stop-at-push.** Wire `/workflow` + solo `#2123` lanes to STOP at "lane pushed + queued + manifest written" instead of integrating inline (the relocation's other half). *blockedBy #2172.*
- **#2175 — reopen-on-fail.** The drain leaves a failed couple queued and reconciles a stranded/partial item back to `open` (the #2072 reconcile, drain-side). *blockedBy #2172.*
