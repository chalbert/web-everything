---
kind: task
parent: "3443"
status: open
blockedBy: ["3487", "3862", "3863", "3485", "xl9vvqj", "x6j8mi0", "xcx5m0x", "xte9opm", "xysg9z7", "x67773u", "x9lo11a"]
scope: ["we:AGENTS.md", "we:agent-memory-src/index-meta.md", "we:docs/agent/backlog-workflow.md", "we:docs/agent/dispatcher-runbook.md", "we:docs/agent/platform-decisions.md", "we:docs/agent/testing.md", "we:scripts/conveyor/run-scorecards.json", "we:backlog/3443-graduate-origin-lane-mechanical-dispatcher-to-main-in-small.md"]
dateOpened: "2026-09-22"
tags: []
---

# Graduation tail sweep: port leftovers past snapshot ff1618065, docs, and close #3443

Last slice of epic #3443. (1) Re-diff origin/main against the branch tip, which will have moved past snapshot ff1618065 while the other slices landed; port every remaining code change faithfully (no behaviour change), or file a follow-up slice if it is large. (2) Port the branch's doc changes (we:AGENTS.md, we:agent-memory-src/index-meta.md, we:docs/agent/backlog-workflow.md, we:docs/agent/dispatcher-runbook.md, we:docs/agent/platform-decisions.md, we:docs/agent/testing.md) as diffs onto main's current text. (3) we:scripts/conveyor/run-scorecards.json is runtime data, not code: record it as intentionally not ported. (4) Fold the branch-only #3383 and #3105 card narrative into main's cards by hand. (5) Resolve #3443 with the note Done-when 1 asks for. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
