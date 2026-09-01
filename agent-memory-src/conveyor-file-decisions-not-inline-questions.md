---
name: conveyor-file-decisions-not-inline-questions
description: Don't use closed multiple-choice questions (AskUserQuestion) for routing/mechanism calls — file genuine decisions as type:decision cards, and fix-and-rerun everything else yourself, kanban-style
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

**Sharpened 2026-09-01, a repeat correction — closed-choice questions specifically, and "kanban style."**
Mid a live-fire dispatcher test on epic #3383, a stuck-session cleanup path hit friction (`claude stop`
wouldn't confirm) and I stopped to surface a 4-option `AskUserQuestion` menu instead of just fixing it.
Operator, verbatim (their own typo kept): *"I though my instruction on my use were clear, I dislike those
closed up question UI. second, we need to work kanban style, each time we find an issue you have to apply the
real best fix merit base to the mechanics and reruns it after. this should be in the epic so it is clear from
now on."* Also written into `backlog/3383` itself as a standing working doctrine for that epic (2026-09-01
entry), since the operator asked for it to live there, not only in agent memory.

**Why (sharpened):** this isn't only "the operator can't track it" (the 2026-07-27 framing above) — the
operator actively dislikes the `AskUserQuestion` UI itself for this kind of call, independent of session
speed. And it generalizes past the conveyor specifically: when I'm driving a mechanism (a script, an
operation, a dispatcher) and hit an obstacle with a diagnosable root cause, the move is to diagnose it and
apply the real fix — not present it as a menu of workarounds. Reserve `AskUserQuestion` for genuinely
binary/trivial confirmations the instructions already carve out, not for "here are N ways to handle this
obstacle, which do you want."

**How to apply (sharpened) — and the boundary a 2026-09-01 independent review correctly caught: this is about
not STOPPING TO ASK before acting, never about skipping review of the resulting change.** When a live run
hits friction, default to diagnosing and fixing it on my own judgment rather than presenting a menu — same as
bullet 3 above but now explicit that this covers debugging/tooling obstacles too, not just PR-label-style
routing calls. But "apply the fix" still means the SAME thing it always has for any code/doc/mechanism change
in this repo: commit it in a lane and land it through the normal reviewed PR pipeline
[[edit-work-runs-in-a-lane-clone]] — never a silent edit nobody but a later `git diff` would catch. What this
rule removes is the interactive stop-and-ask-a-menu step, not the review step. Escalate to the operator
(prose discussion or a filed decision card, never `AskUserQuestion`) only for a genuine authorization gate
(dispatching something live for the first time, an irreversible/destructive action) or a real unresolved
decision.
