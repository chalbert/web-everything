---
bornAs: xjtogd2
kind: story
size: 3
parent: "2418"
status: open
dateOpened: "2026-07-11"
tags: []
---

# review-core CLI: reduce + mandate subcommands

Add a command line over the pure fns in we:scripts/lib/review-core.mjs — reduce (findings→verdict/outcome/disposition + verdict table) and mandate (--lens / --editor). Replaces 5× inline node -e in /drain; makes the reductions testable. Foundational: unblocks the review-parked-prs Workflow (slice C).
