---
kind: story
size: 5
parent: "2241"
status: open
blockedBy: ["2243"]
dateOpened: "2026-07-04"
tags: []
---

# Port the self-approved PR-merge transport + drain/merge/pr skills to plateau-app

Copy the transport scripts (we:scripts/merge-ai-prs.mjs, we:scripts/pr-land.mjs and lib deps) and the drain/merge/pr .claude/skills into plateau-app, adapting to plateau's test check and repo. plateau-app has only the explorer/stress-test skills today — no merge transport. Blocked by the plateau CI test check (the merge gate). Validate by landing one plateau PR through the ported /drain.
