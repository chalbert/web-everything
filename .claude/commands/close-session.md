---
description: Pre-close safety check — confirm nothing is lost before ending the session (routes to the closing-session skill)
---

Invoke the `closing-session` skill to audit whether session context is durably captured, run the repo health gate, and report working state.

Then run this repo's **memory/instruction reflection pass** (#1878, the model-usage-watch #1855 cadence beat): execute `npm run reflect` and act on its propose-only checklist — capture this session's durable learnings as candidate memories (or right-home into `docs/agent/platform-decisions.md` per rule 1), confirm any near-duplicate/orphan/stale candidates it surfaces, and prune per rule 3. **Propose, don't auto-apply** — nothing is written to memory without an explicit go. Skip silently when it reports nothing to consolidate (a zero-finding close stays one step). This step is repo-local (does not modify the global `closing-session` skill).

$ARGUMENTS
