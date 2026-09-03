---
kind: task
parent: "3383"
status: open
dateOpened: "2026-09-03"
tags: []
---

# we:skills-src/conveyor/delivery-agent-brief.md step 5 instructs we:run.mjs resolve before any PR exists

we:skills-src/conveyor/delivery-agent-brief.md's step 5 (Run the gate GREEN) currently shows `node we:scripts/operations/run.mjs resolve --ref={{ITEM_NUM}} --json` run right after the pre-commit gate verify, BEFORE the commit/PR exist (step 8). we:scripts/operations/resolve.mjs's own docblock calls resolve 'the CLOSE' of the claim/resolve lifecycle -- it flips the item active->resolved. Running it at step 5 would resolve the backlog item while nothing has landed on main, contradicting the brief's own repeated doctrine elsewhere (stop at ready-to-merge, never merge/resolve yourself, the resident drain daemon resolves the item after it lands the PR). Found 2026-09-03 while building #3444; skipped running it there rather than folding an unrelated fix into that item's PR. Fix: remove/relocate the resolve call out of step 5 in we:skills-src/conveyor/delivery-agent-brief.md, or clarify it targets something other than the backlog item's status.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
