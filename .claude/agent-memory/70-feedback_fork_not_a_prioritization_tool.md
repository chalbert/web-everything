---
name: feedback_fork_not_a_prioritization_tool
description: "a fork decides the best option on merit; cost/effort is never a fork branch — it's prioritization, applied at what-to-work-on-next time"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d53ee13e-889b-449c-a39c-d1c3157e3276
---

A fork is **not** a prioritization tool. A fork decides the **absolutely best option on merit** — which branch is *correct* (forced invariant) or which is a *genuine on-merit either/or*. Cost/effort/sequencing is **never** a fork branch.

**Why:** "do the better thing vs the cheaper thing because the better thing is expensive" is prioritization wearing a fork's clothing. Whether the best option is affordable *right now* is decided at a different moment — *what-do-we-work-on-next* time (backlog selection / burndown ordering) — not inside the design decision.

**How to apply:** strip cost out of the decision → **rule for the best end-state**, then file its build as a *separately-prioritized* backlog item whose **priority (not its existence) is the open knob**. If both branches agree on the end-state and differ only on *when / worth-it-now*, there is no design decision — there is a ruling + a backlog ordering. Effort/cost asymmetry alone never makes a fork.

**Applies *inside* a legitimate fork too, not just to whole forks** (sharpened on #370): even when a fork is genuine, every per-branch *tradeoff* listed must be a **merit** tradeoff (correctness, composability, a11y, UX, lock-in) — never effort. Tells = "**more to build**", "**a second entry**", "**more entries**", "**more to maintain**", "**lighter**". Strip them: a winning branch's effort lives on its build item's `size`, not in the decision's pros/cons; listing it as a con biases the on-merit call toward the cheaper branch. A branch's only valid downside is a way it is *worse on merit* — if its only con is "costs more", it has **no** con in the fork. Watch the inverse too ("lighter"/"simplest" as a *pro* of the cheap branch). Codified into the same `backlog-workflow.md` blockquote (line ~244).

Sharpens the fork-existence test [[feedback_support_all_coherent_fork_existence_test]] (a fork is real only if a branch is broken/won't-work — and the differentiator must be *merit*, not cost). Decisions are work items [[feedback_decisions_are_workitems_not_plan_mode]]. Codified in `docs/agent/backlog-workflow.md` (standing fork-existence test). Worked example: #465 — "shape-only vs portable cross-field compiler" dissolved once cost was seen as prioritization; ruling = best end-state (portable CEL cross-field, optional/advertised), schedule = burndown ordering, leaving only CEL-the-representation as the genuine on-merit choice.
