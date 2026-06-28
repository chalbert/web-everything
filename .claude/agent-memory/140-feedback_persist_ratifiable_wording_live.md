---
name: feedback_persist_ratifiable_wording_live
description: "In decision/definition discussion, the moment you present wording for the user to ratify, write that exact wording into the item the SAME turn — unprompted. The user should never have to ask 'update the story with that'."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7bdeda47-8004-45be-8441-c145cc73f2b7
---

**While discussing/defining a `decision` (or any story), every candidate wording you ask the user to ratify must already be in the item file that same turn — never only in chat, never gated on the user asking for it.** The recurring friction: the user has to repeat "update the story with the latest wording" after each iteration. That ask should not exist — persisting is the default action, not an opt-in. Present the wording *and* bake it into the item in one turn, then say you did ("folded it into Fork 2 / the proposed-ruling block").

**Why:** the item is the source of truth; ratification is always *against the item's current text*, so wording that lives only in chat makes any ratify-against-it invalid (the item is stale). The user wants the file to track the live candidate continuously, so a last look is just reading the item, not re-dictating it back to me.

**How to apply:** this is already the canonical rule — [docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md) → *The decision item is the source of truth* (L281 "write it into the item in the same turn you say it"; L284 "never ask the user to ratify anything that lives only in chat"; L287 the `## Proposed ruling — AWAITING RATIFICATION` staging block). My gap was *compliance*, not a missing rule. So in decision-mode (`/next decision`, `/prepare`): propose → write-in → report, every turn; reserve the pause-to-ask only for a genuinely ambiguous conclusion (L285). NOT enforceable by a Stop hook — a script can't read chat to tell I proposed wording — so it lives as working-style discipline. Relates to [[feedback_state_representing_edits_need_no_permission]], [[feedback_backlog_is_tracker]], rule 44 (state-representing edits need no permission).
