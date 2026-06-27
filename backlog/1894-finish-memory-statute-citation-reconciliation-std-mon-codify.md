---
kind: story
size: 3
status: open
dateOpened: "2026-06-27"
tags: []
---

# Finish memory statute-citation reconciliation (STD/MON + codify NONE + collapse)

Finish the agent-memory statute-citation reconciliation started in #1893 — optional polish on the now-lazy memory tier. Three deferred sub-tasks: (1) run the additive anchor-citation pass over the STD and MON statute clusters the way the ARCH cluster was done; (2) codify the three rules that had no covering statute anchor (cross-origin dev-server hygiene, reusable-to-neutral-home, bias-toward-separation) into we:docs/agent/platform-decisions.md, and fix the bias-toward-separation placeholder link which is referenced about six times but has no anchor heading; (3) collapse memory bodies that merely restate the statute into thin pointers, one file at a time (bulk is unsafe — verification already caught one over-classification). Lineage: #1893, #1868, #1855.
