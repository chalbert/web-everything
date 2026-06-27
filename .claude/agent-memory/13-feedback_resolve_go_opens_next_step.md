---
name: feedback_resolve_go_opens_next_step
description: resolving a go decision MUST open its next-step build story; never an orphan resolution
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 21891097-3147-4002-a1ce-7efe3c3c7a12
---

When a validation-gate decision resolves to **go**, you MUST open its next-step build story in the same pass and point the decision's `graduatedTo` at it — never leave a resolved go with no follow-up work. The user's rule, verbatim: "if we resolve anything, we have to open the next step." A go verdict is only the *trigger*; the work isn't captured until the story exists.

**Why:** a resolved-go with no story silently drops the work — the decision reads "done" but nothing tracks the build, so it never gets picked up.

**How to apply:** resolve via `backlog.mjs resolve <NNN> --graduated-to=<story> --codified-to=one-off`; scaffold the story first to get its NNN. Build-ready go → open an unblocked story; gated go → open the story `blockedBy` its real prerequisite (file a blocker card if none exists — see [[feedback_accepted_low_is_story_not_decision]]). A shared mechanism across several go's = ONE story they all graduate to (e.g. #1634/#1651/#1652 → one resolver story #1690). Established working the #142 dev-DX cluster (#1632–#1652). Relates to [[feedback_decision_go_is_not_whole_arc]].
