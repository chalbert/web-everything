---
kind: story
size: 3
status: open
scope: ["we:skills-src/conveyor/delivery-agent-brief-v2.md", "we:skills-src/conveyor/delivery-agent-brief.md", "we:skills-src/conveyor/fix-agent-brief.md", "we:skills-src/conveyor/fix-agent-ci-brief.md"]
dateOpened: "2026-09-27"
tags: []
---

# Catch up with main once, right before the final gate

Evidence: inside the same 48-minute daemon-fix session card x000pcl documents, a mid-work merge of main (#2818/#2819 landing meanwhile) forced a fresh full we:scripts/verify-lane.mjs run under today's exact-sha marker keying and conflicted on we:scripts/operations/ci-heal-pr-dispatch.mjs. Change the generic worker/fixer procedure (we:skills-src/conveyor/delivery-agent-brief-v2.md, we:skills-src/conveyor/delivery-agent-brief.md, we:skills-src/conveyor/fix-agent-brief.md, we:skills-src/conveyor/fix-agent-ci-brief.md) so a lane merges origin/main at most once, immediately before the final gate, never speculatively mid-work, unless an active conflict is actually blocking the worker's own edits (the sole sanctioned exception). Pairs with xsndck6 (marker keying) so an unavoidable mid-work merge that touches none of the lane's files does not cost a re-run either way; this card is the procedure change, that one is the marker mechanism.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
