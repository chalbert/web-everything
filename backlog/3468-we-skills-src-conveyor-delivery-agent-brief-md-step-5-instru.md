---
bornAs: x8nsmdr
kind: task
parent: "3383"
status: resolved
dateOpened: "2026-09-03"
dateResolved: "2026-09-21"
tags: []
---

# we:skills-src/conveyor/delivery-agent-brief.md step 5 instructs we:run.mjs resolve before any PR exists

we:skills-src/conveyor/delivery-agent-brief.md's step 5 (Run the gate GREEN) currently shows `node we:scripts/operations/run.mjs resolve --ref={{ITEM_NUM}} --json` run right after the pre-commit gate verify, BEFORE the commit/PR exist (step 8). we:scripts/operations/resolve.mjs's own docblock calls resolve 'the CLOSE' of the claim/resolve lifecycle -- it flips the item active->resolved. Running it at step 5 would resolve the backlog item while nothing has landed on main, contradicting the brief's own repeated doctrine elsewhere (stop at ready-to-merge, never merge/resolve yourself, the resident drain daemon resolves the item after it lands the PR). Found 2026-09-03 while building #3444; skipped running it there rather than folding an unrelated fix into that item's PR. Fix: remove/relocate the resolve call out of step 5 in we:skills-src/conveyor/delivery-agent-brief.md, or clarify it targets something other than the backlog item's status.

## Done when

1. **Executable** — `npx vitest run skills-src/conveyor/__tests__/` passes. The test is the "resolve rides the PR, never runs before the work is built (#3468)" block in `we:skills-src/conveyor/__tests__/scratch-dir-rule.test.mjs`. It reads `we:skills-src/conveyor/delivery-agent-brief.md` and fails on the old text (step 5 ran the `resolve` operation; five of its assertions fail) and passes on the new text: step 5 carries no resolve call, the brief runs `resolve --ref={{ITEM_NUM}}` exactly once, in step 8 and before that step's `git commit -F`, states that the resolve rides the same PR as the claim and only when every `## Done when` item holds, and the guardrails no longer put resolve after the daemon merge.

## Resolution (design followed)

The brief follows `we:docs/agent/backlog-workflow.md` (*Working an item*: `claim`/`release`/`resolve` "run in the lane clone and land in the item's own PR") and `we:skills-src/batch-backlog-items/SKILL.md` ("the claim + resolve ride the PR"): resolve is authored by the producer in the lane, once, at step 8 just before the commit, after the gate, `/converge` and the visual review. The drain's `resolveLandedItem` flip (`we:scripts/lane-drain.mjs`) is only the fallback "when the producer didn't pre-author it". This card's own premise, that the daemon resolves the item after landing, describes that fallback, not the primary path.
