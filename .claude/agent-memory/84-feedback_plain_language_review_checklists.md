---
name: feedback-plain-language-review-checklists
description: "Explain in plain terms (no invented jargon), and present a checklist to review before applying larger changes"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1368513a-6ed8-40a5-9812-496cc6327b7f
---

When explaining or grouping work, use plain language and concrete terms — do **not** coin
internal labels/jargon (the user pushed back on an invented "core-generics cluster" name, and
on a name choice without verifying it). Define any term in everyday words, name the actual files
and behavior, and verify factual claims (e.g. "is X a DOM property?") rather than asserting.

For larger or multi-step changes, present a **reviewable checklist first** and apply only on
explicit go-ahead, then come back with the next problem one at a time — the user works this
iteratively (`apply and come back with the next problem`).

**Why:** the user reviews and steers as they go; invented jargon and unverified claims slow that
down and erode trust. **How to apply:** plain-language explanations + per-step checklists +
verify-before-asserting; relates to the
discussion-not-multiple-choice planning style.
