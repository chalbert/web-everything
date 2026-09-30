---
bornAs: xrc6npb
kind: task
status: resolved
preparedDate: "2026-09-30"
scope: ["we:scripts/operations/probation-build-run.mjs"]
dateOpened: "2026-09-29"
dateResolved: "2026-09-29"
tags: []
---

# Standalone runner refuses a card with an open blockedBy before claiming it

2026-09-30: a standalone Codex run (we:scripts/operations/probation-build-run.mjs) claimed #3096 although its frontmatter says blockedBy: [3353] and #3353 is still open. Codex correctly declined, but only after spending a whole run, and it opened PR #3042. MVP: before acquiring a lane or claiming, read the card's blockedBy; if any blocker is not resolved on main, refuse with outcome 'blocked' naming the open blockers. No lane, no claim, no PR.

## Done when

1. **Executable** — The related Vitest suite (`npx vitest related <path> --run`) for `we:scripts/operations/probation-build-run.mjs` passes: an open blocker refuses before lane/claim IO; resolved blockers and cards without blockedBy proceed.

## Prep

Read blockedBy before lane acquisition or claiming. Check blocker frontmatter status on origin/main using the existing readField helper; return blocked naming unresolved blockers. Keep the remaining build arc unchanged.
