---
name: conveyor-file-decisions-not-inline-questions
description: In fast/background-heavy sessions the operator can't track inline questions — file decisions as type:decision cards, file decided work as backlog items, and just make routing calls yourself
metadata:
  type: feedback
---

In a fast-moving conveyor / background-heavy session, the operator cannot track questions asked inline in chat — ticks and PR-completion notifications scroll them away before they're read. Operator, 2026-07-27: *"I cannot track your question in a fast moving session like this, if you need a decision, create decision items."*

**Why:** background events move faster than the operator reads chat; a buried "which should I do?" blocks nothing on my side and just gets lost. A tracked card survives; an inline prose/multiple-choice question does not.

**How to apply:**
1. A genuine decision the operator must make → file a `type:decision` backlog card (it reaches them through the decision queue / `/prepare`), never an inline question. [[never-take-an-unprepared-decision]]
2. Work I've already decided on → file a backlog item and clear it for the conveyor; don't ask permission to file buildable work.
3. Operational routing I own (which label a PR gets, re-accepting a false-positive block, stripping a stray out-of-scope file) → just do it correctly per route-by-actual-risk; that's the operator agent's job, not a question.

Corollary to the standing "decisions are workitems, not plan-mode" guidance, sharpened for the conveyor: the faster the session, the more strictly blocking-questions must become cards or self-made calls.
