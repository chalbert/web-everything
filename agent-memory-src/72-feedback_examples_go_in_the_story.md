---
name: feedback_examples_go_in_the_story
description: "a request for examples on a decision = update the item with them, not a chat-only answer"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dd2021d6-3064-4620-863a-fcd46186c88f
---

When the user asks for code examples (or any examples) while discussing a decision/backlog item,
the answer is to **write the examples into the item**, not to present them only in chat.

**Why:** the backlog item is the source of truth ([[feedback_decisions_are_workitems_not_plan_mode]],
backlog-workflow.md → *The decision item is the source of truth*). Chat-only examples are lost and
don't reach the spin-off build items; examples written into the story become acceptance-criteria
grounding the eventual build inherits.

**How to apply:** ground the examples in the real tree (file:line, [[feedback_decision_concrete_code_refs]]),
edit them into the item first (update by default, no permission needed), then present a short pointer in
chat. Surfaced on #1621.
