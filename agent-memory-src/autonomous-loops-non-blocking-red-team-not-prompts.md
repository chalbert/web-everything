---
name: autonomous-loops-non-blocking-red-team-not-prompts
description: For this user's heavy self-improving loops, replace per-iteration human approval prompts with a machine-adversarial (red-team) gate + auto-landed lane→PR + retrospective revert — prompting kills throughput
metadata:
  type: feedback
---

The user runs self-improving/autonomous loops **heavily**, so any per-iteration human approval **prompt**
is a throughput killer, not a safety feature. When a loop mutates durable content (memory, skills,
config), the design must be **non-blocking end-to-end**: an automated **adversarial gate** (a red-team
sub-agent that defaults to reject) is the reviewer, the change **auto-lands via lane→PR on green**, and
the human's oversight is **retrospective** (inspect the PR / git history anytime, `git revert` if the
gate ever lets a bad change through) — never a blocking approval step.

**Why:** 2026-07-04, designing the closing-session auto-memory-improvement (SKILL.md §1a). The user
rejected, in order: "always prompt make the loop very ineficient"; "I cannot just review a batch of work
then launch it" (human-as-gate is not viable); "I don't want skill prompt, we use auto improving loop too
much". The consistent reframe: shift the gate from *human-synchronous* to *machine-adversarial +
revertable*.

**How to apply:** when adding autonomous self-improvement, don't gate it with a permission prompt or a
"review this batch first" step. Gate it with (1) an adversarial red-team that must actively clear the
change, (2) auto-land on green via the standard lane→PR transport, (3) a cheap revert path. Reserve
prompts only for the few things a loop must never self-modify unreviewed (its own hooks / permission
rules). Distinct from [[55-feedback_hand_back_early_in_interactive_loops]], which governs *interactive
design* work where the human drives — this is about *autonomous execution* loops. See
[[104-feedback_commit_to_default_branch_ok]], [[no-work-ever-in-primary-all-repos]].
