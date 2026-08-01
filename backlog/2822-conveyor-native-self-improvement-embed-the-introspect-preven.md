---
bornAs: xchzc45
kind: epic
parent: "2612"
status: open
dateOpened: "2026-08-01"
tags: [conveyor, self-improvement, closing-session, prevention, agent-memory, hooks]
---

# Conveyor-native self-improvement — embed the introspect→prevent→gate/memory loop in each autonomous step, not gated on /close

The self-improvement loop (introspect a finding/failure → generalize to its class → propose a deterministic gate per #51 or a working-style correction → route durable ones to backlog/hooks and working-style ones to agent memory) currently lives only in the closing-session skill (/close), which needs a HUMAN session boundary. The conveyor is session-free (#2753) and its subagents work autonomously — there is no /close to run — so autonomous work never self-improves. This epic makes the loop step-local and continuous: each autonomous step (review, build, drain, dispatch) emits its own improvement introspection at the moment it acts, routing outputs the same way /close would, with no session boundary. /close stays a human-session convenience, not the only place improvement happens, and not a one-off.

## The principle

The self-improvement loop is: **introspect a finding/failure → generalize it to its class → propose a deterministic gate (per rule #51, hookable→hook) or a working-style correction → route the durable ones to `backlog/`/hooks and the working-style ones to agent memory (rule #9)**. Today this loop lives in the **closing-session skill (`/close`)** — it surfaces improvement candidates, red-teams agent-memory changes, and lands the survivors via a lane → PR. All of it fires only at a **human session boundary**.

The **conveyor is session-free** (#2753). Its delivery and review subagents do most of the work autonomously, and **there is no `/close` to run**. So a self-improvement loop gated on a session-close ritual means **autonomous work never self-improves** — every lesson a background agent could have generalized into a gate or a memory correction is lost when the agent exits.

Therefore the loop must be **step-local and continuous**. Each autonomous step emits its own improvement introspection **at the moment it acts**, routing outputs exactly as `/close` would, with no session boundary. `/close` remains the human-session convenience; it is **no longer the only place improvement happens — and not a one-off.**

### The introspection is a blameless author post-mortem, not a symptom list

The introspection each step runs is a **blameless root-cause post-mortem of the AUTHOR's error**, not a list of symptoms. For **every finding — a nit AND a major/blocker alike** — it asks **"why did the creator get this wrong?"**: the authoring or process failure mode behind the finding, as a short "why" chain. It then produces the fix as one of **two outputs**:

1. **A deterministic gate** — where the finding's class is script-decidable, propose the hook (rule #51: script-decidable → hook). This is the nit→gate capture that stops the whole class from recurring.
2. **A process / brief / working-style fix** — where the class is judgment and a gate can't catch it, name the concrete process, delivery-brief, or working-style correction and route it to `backlog/` or **agent memory (rule #9)**.

A finding whose cause is **un-gateable still owes a named process/memory improvement** — it is never dropped for being "just judgment". That is exactly the half `/close` does today through its red-teamed memory changes, and exactly why it must become step-local when there is no `/close`.

So, stated as the per-step contract: **each autonomous step, on any finding it surfaces, emits `{ class, why-the-author-erred, gate-or-process/memory fix, route }` — continuously, across all severities, with no session boundary.**

### The introspection is a converged negotiation, and a step's output isn't final until its prevention is captured

The per-step self-improvement is **not a one-sided note.** It is a **converged negotiation**, and the step's output is **not "final / accepted" until its agreed prevention is captured** — with **no session boundary.**

1. **Converged negotiation, not a monologue.** Where a step has a creator and a reviewer (build↔review, dispatch↔drain), the reviewer *proposes* the prevention per finding and the creator *responds* — agrees, refines the mechanism, or argues on the merits why a gate isn't warranted — and the two **converge** on "everything that could reasonably be done to prevent this class from recurring." This reuses the panel↔editor↔re-review convergence loop (**#2437**), applied to the *prevention*, not just the fix. A single-agent step runs the same converge-with-itself: propose, challenge, settle.
2. **Output gated on capture.** A step's result is **not accepted until every agreed prevention is done** — which **normally means it is FILED as a backlog item** (a hook / gate / process story), not necessarily built in that step. A finding whose agreed prevention is **neither built nor filed holds the step open.** This is the step-local form of the acceptance gate, and it closes the **"unfiled intention" gap** exactly where it bites hardest: autonomous work, where there is no `/close` and no human to remember the filing.

## Likely slices (this epic stays unsliced; a /slice candidate)

1. **Review-step self-improvement** — the FIRST instance, already being filed as its own story ("Reviews must produce prevention introspection"): make the blameless post-mortem a **mandatory output of the shared review core**, so every finding (nit through blocker) emits `{class, why-the-author-erred, gate-or-process/memory fix, route}` and nit→gate capture is maximized. The prevention is **negotiated to convergence** (creator responds; the two agree) and **PR acceptance is gated** on it being built-or-filed — riding the #2437 convergence loop. Reference it as this epic's first child.
2. **Build-step self-improvement** — build agents mine prevention from their own **review-fix convergence**, running the same author post-mortem on each fix they made (extends the warm-lane self-review floor — #2819 / warm build-lane daemon, and the build-time self-review of #2672).
3. **Drain/dispatch-step self-improvement** — a drain escalation/incident or a stuck-lane classification **emits a prevention proposal** (a named gate or process/memory fix), not just a park. The "why did this reach escalation" post-mortem runs at dispatch/drain time.
4. **Decentralize the closing-session machinery** — extract the improvement-candidate + red-team + route-to-backlog/memory core **out of `/close`** into a shared caller any step can invoke without a session boundary (the current standing-introspection step #2436 lives inside `/close`). `/close` becomes **one caller among several**.
5. **Surface per-step improvements on the transparency ledger** so the introspections are **inspectable, not silent** — each step's `{class, why, fix, route}` emission lands on the ledger.

## Cross-references

- **closing-session skill** (`we:.claude/skills/closing-session/SKILL.md`) — the current, session-boundary-only home of the loop; §1a red-team → lane → PR is the machinery slice 4 extracts.
- **#2753** — session-free conveyor: the reason a session-close ritual can't be the only trigger.
- **#2436** — the standing efficiency/introspection step that today lives inside `/close`.
- **#2819** — review-fix convergence in the warm build-lane daemon (self-review floor slice 2 extends); **#2672** — build-time visual self-review; **#2624** — delivery prepare self-review subagent handing its verdict.
- **#2437** — the panel↔editor↔re-review convergence loop each step's prevention negotiation reuses (same machinery, applied to the prevention; the step's output is gated on the converged result being captured).
- **rule #51** (hookable vs judgment) — the gate-vs-judgment split the "two outputs" step applies.
- **rule #9** (memory-management policy) — where working-style / judgment corrections land.
- Transparency ledger (slice 5) and the specific hooks a review would now auto-produce (slice 1).

## Acceptance

An autonomous conveyor run with **no human `/close`** still lands **prevention gates + agent-memory improvements from its own findings** — every finding it surfaces, nit through blocker, emits `{class, why-the-author-erred, gate-or-process/memory fix, route}` and the durable outputs are routed and landed. The self-improvement rate **does not depend on a session boundary.** Each step's prevention is a **converged negotiation** (creator responds; the two agree — reusing #2437), not a one-sided note, and **no step's output is "final" until its agreed prevention is built-or-filed** — a finding whose prevention is neither built nor filed holds the step open, closing the unfiled-intention gap with no session boundary.
