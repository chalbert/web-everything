---
name: always-set-subagent-model-explicitly
description: Every Agent() call passes an explicit model sized to the job — never inherit, never default-cheap
metadata:
  type: feedback
---

**Every `Agent(...)` call passes an explicit `model`, chosen for that job.** Never omit it and let the
subagent inherit the session model, and never blanket-downgrade either — the ask is *right-sized*, not
*small*. Pass it even when the chosen tier happens to equal the current session model.

**Why:** omitting `model` is the failure that killed 24 lanes on Fable credits
([[workflow-lane-model-policy]]) — inheritance, not downgrading, is the historical bug. Explicit also puts
the tier in the transcript, so a bad routing call is something the user can see and correct instead of
silently paying for. Outside `/workflow` there is no test gate or drain to catch a cheap model's
confident-but-wrong return, so the tier is the only control there.

**How to apply:** route on the *shape of the return* — knowable before spawning — never on self-rated
difficulty (self-rating is banned by [[delegate-by-default-the-loop-only-orchestrates]]).

- **Haiku** — returns pointers verifiable in seconds: locate a symbol, list/count files, "does X still
  exist", one mechanical edit with an exact spec.
- **Sonnet** — execution against a decided spec: implement a prepared/DoR item, mechanical multi-file
  refactor, run a build/suite and report. The default for lane work.
- **Opus** — judgment otherwise done in the main loop and not cheaply verifiable: review a diff, red-team,
  design critique, ambiguous investigation, anything whose conclusion gets relayed and acted on.
- **Never Fable** for subagents — expensive/limited premium pool, never for execution.

Tie-break: **when torn between two tiers, go up.** Over-spending costs a few tokens; under-spending returns
a wrong answer that looks exactly like a right one. Same bias as
[[delegate-by-default-the-loop-only-orchestrates]]. A cheap subagent's return is a *lead to verify*, not a
fact — see [[verify-before-you-claim]].

Structural backstop where it exists: pin `model:` frontmatter in `.claude/agents/*.md` so an agent type
carries its own tier and routing stops being recall. For ad-hoc `general-purpose` calls the explicit param
is the only lever.
