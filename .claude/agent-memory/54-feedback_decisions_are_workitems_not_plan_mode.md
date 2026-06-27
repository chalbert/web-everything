---
name: feedback-decisions-are-workitems-not-plan-mode
description: "Design decisions go in a backlog decision work item (type:decision), never a Claude plan-mode plan; don't self-enter plan mode for design forks"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3095a24d-fd26-43f4-a67f-bd6d880eb8e9
---

Never use Claude **plan mode** (`EnterPlanMode`/`ExitPlanMode`, the `~/.claude/plans/*.md` file) to
present or stage a **design decision** — and don't self-enter plan mode for a design fork. The user
rejected this twice and corrected: "we are always supposed to work from work item, no plan like this."

**Why:** the backlog **is** the tracker and the plan of record ([[feedback_backlog_is_tracker]],
[[project_backlog_workflow_clis]]). A separate Claude-plan artifact is invisible to the backlog, duplicates
it, and isn't the form the team works from.

**How to apply:** when a real design fork appears (layer placement, own-project-vs-intent, schema shape,
etc.), create a backlog **decision work item** — `type: decision`, lay out the fork + options + the ruling
+ rationale, and put the implementation outline *in that item* (it carries the plan). Resolve it with
`graduatedTo: <produced entity>`. The candidate/gap story then graduates to the resulting artifact and
references the decision item. Follow `docs/agent/design-first.md` + `docs/agent/backlog-workflow.md`.
First applied: #409 (master-detail = standalone intent, not a project). Relates to
[[feedback_decision_mode_engage_real_fork]], [[feedback_support_all_coherent_fork_existence_test]],
[[feedback_self_contained_plans]].

**Never solicit a call inline in chat — file the card, don't ask the user to decide ad-hoc.** When work
surfaces an architectural call (even a small one — a gate's vocabulary, a remap, a fold), the user **does
not make the call without a decision card**: "I do not make call without a decision card." So do **not**
end with a tail-question asking them to pick inline. Instead **create the `kind: decision` card** (prepared
to DoR where you can), and let it go through the normal flow (`/prepare` → `/next decision`). Filing the
card *is* the response; the user reviews it later. Surfaced 2026-06-21 when I asked inline "want me to
remap isExec / fold the #1457 dissolution?" → user: "I do not make call without a decision card … just
create the cards for later review." Relates to [[feedback_never_take_unprepared_decision]].

**A fork must NOT live inline in a non-decision body (idea/epic/story) — flip or carve.** If the
item *is* the fork, flip its `type` to `decision`. If the item is a legitimate build idea/epic/story
that *also* carries forks (common epic shape: capability framing + "open design points"), **carve**:
scaffold a *separate* `type: decision` item holding the fork(s) (prepared-fork shape, cluster coupled
forks #004-style), set the original `blockedBy` that decision, and trim the fork out of the original to
a one-line pointer (never duplicate). Don't ratify a buried fork in place. Codified in
backlog-workflow.md (after the mis-flagged lever-map). Worked example: #192's four foundation forks
carved to #441, which `blocks` #192.

**Deferral never licenses burying — it parks the card, not skips it.** A fork that's intentionally
deferred ("decide near release", "don't freeze a moving target") still gets carved to its own
`type:decision` card; set that card `status: parked` and decide later. Deferral governs *when you
ratify*, not *whether the fork is tracked* — don't leave it as an "open shape" line / checkbox in the
parent. Worked example: #563 epic's artifact-shape fork → carved to parked decision #569 (after I'd
wrongly argued the defer-until-release guardrail meant *don't file the card*).
