---
name: right-size-the-panel-count-not-model-tier
description: Fanning agents out is a cost lever to earn, not a default — default to zero, ask before climbing a rung, and scale by COUNT not model tier
metadata:
  type: feedback
---

Before spawning a panel of agents at anything (design mocks, jury lenses, review finders), **right-size it out loud, starting at zero**: no panel (do it yourself) → one → two → more. **Ask the human before climbing a rung** — escalation spends their budget, so it is their call, never a silent upgrade. And when you do fan out, **scale by count, keep every agent at full strength** — never buy breadth by dropping model tier.

**Why:** the operator's framing (2026-08-05, while codifying `/design-committee`): "it must be scaled to the demande, including rejection of the commitee idea, 2 and them if needed" and "I sometimes feel 1 strong agent beets multiple lesser ones." They are right on the mechanism — a panel pays off through **decorrelated angles**, not extra total brainpower, and that only cashes in if each output is good enough that *seeing it* changes your mind. A weak candidate teaches nothing: you glance, reject, and the fork is no better ruled than before. So three lesser agents lose to one strong one, while two strong agents on genuinely *different* angles beat one. Count is the lever; tier is not. (Cost reinforces it from the other side — see [[workflow-lane-model-policy]]: never Fable for execution, because it is the limited premium pool.)

**How to apply:** name the rung and the reason in one line before spawning anything, and treat "no panel" as the expected answer for a tweak, a single component, or an already-obvious call. For UI proposals the ladder is written into `docs/agent/build-ui.md` § *2. Mock before build*, with `/design-committee` as its front door; the judging half has its own gate in `docs/agent/jury-refinement-method.md` § *When to run the full jury* (blast-radius dials rigor). Same instinct in both halves of the loop. Distinct from [[workflow-lane-model-policy]] and rule 134 (Opus orchestrates, Sonnet executes), which route *which model* per seat — this rule governs *how many seats exist at all*.
