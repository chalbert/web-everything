---
name: feedback_backlog_closeout_resolve_not_delete
description: "On completing a backlog item, mark it status:resolved — do NOT delete the file"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 30ea9034-383b-42ca-a88b-fb9bf0a96ce2
---

When a backlog item is fully done, **mark it `status: resolved`** (add `dateResolved`, and `graduatedTo` if it became a real entity) and **keep the file** — do not `rm` it. `resolved` items are dropped from selection and hidden by default on `/backlog/`, so they serve as an audit trail, not clutter.

**Why:** The rule changed from delete → resolve. The user confirmed it explicitly ("latest skill … resolve the backlog item instead of deleting"). Both the `next-backlog-item` SKILL.md (step 7) **and** `docs/agent/backlog-workflow.md` ("Closing out a completed item — mark it `resolved`") now say resolve; deletion is reserved for items opened in error or fully superseded.

**How to apply:** At close-out, still run the full gate (tests + `check:standards` green, capture leftovers as their own items), but the final action is flipping `status` → `resolved` (+ `dateResolved`, and `graduatedTo` if it became a real entity), not deleting. Note `check:standards` warns on a `resolved` item with no `graduatedTo`. See [[feedback_backlog_is_tracker]].
