---
kind: story
size: 5
parent: "2241"
status: open
blockedBy: ["2242"]
dateOpened: "2026-07-04"
tags: []
---

# Port the self-approved PR-merge transport + drain/merge/pr skills to frontierui

Copy the transport scripts (we:scripts/merge-ai-prs.mjs, we:scripts/pr-land.mjs and their lib deps) and the .claude/skills for drain, merge and pr into frontierui, adapting the gate to FUI's test check and repo. Today FUI has none of this — no skills dir, no scripts — so producers cannot land through a gated self-approved transport and PRs accumulate. Blocked by the FUI CI test check (that check is the merge gate). Validate by opening one FUI ready-to-merge PR and landing it via the ported /drain.
