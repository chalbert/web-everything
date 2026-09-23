---
kind: story
size: 2
parent: "x9ah1zb"
status: open
locus: plateau-app
blockedBy: ["x8gsl5r", "x7dqrln"]
dateOpened: "2026-09-22"
tags: []
---

# Open one step on a /wip card to see what it did — the scrubbed excerpt, fetched on tap, never stored

Tapping a step sends one `agent-step` ask; the answer (tool, exit, times, output tail or edit summary) renders under the step; a running step refreshes every 5 s while open. Withheld and offline states per plateau:docs/wip-live-agent.md §5 (16, 17).

## Done when

1. **Executable** — `npx vitest run src/wip`: a tap sends exactly one `agent-step` ask; a running step re-asks every 5 s and stops when closed; `withheld: true` renders "Output hidden — it looked like it contained a secret."; a stale connection renders "details need your laptop" and sends no ask.
