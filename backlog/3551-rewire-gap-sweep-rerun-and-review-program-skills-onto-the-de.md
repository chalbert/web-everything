---
bornAs: x1hj9c4
kind: story
size: 2
parent: "3273"
status: open
dateOpened: "2026-09-06"
tags: []
scope:
  - we:skills-src/gap-sweep-rerun/SKILL.md
  - we:skills-src/review-program/SKILL.md
---

# Rewire gap-sweep-rerun and review-program skills onto the declared gap-sweep-status operation

we:scripts/operations/gap-sweep-status.mjs (#3412, resolved 2026-09-01) wraps we:scripts/gap-sweep-status.mjs as a declared operation with a we:scripts/operations/declared-homes.mjs entry, but its own Progress note says plainly it did NOT rewire the two skills that still instruct the raw CLI: we:skills-src/gap-sweep-rerun/SKILL.md (three raw `node we:scripts/gap-sweep-status.mjs` lines) and we:skills-src/review-program/SKILL.md (one). #3224s scan now WARNs on both (never errors, since the warn-only grace period), and that follow-up was never filed. Point both at `node we:scripts/operations/run.mjs gap-sweep-status` for status/--snapshot/--baseline=PATH, matching we:scripts/operations/declared-homes.mjs own three-mode mapping.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
