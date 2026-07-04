---
name: feedback_ai_over_contract_not_as_artifact
description: Good AI = dev-time layer over a deterministic codified contract; bad AI = emits disposable UI artifacts with no durable standard underneath (wandb/openui as the anti-pattern)
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 131b8fc8-3895-42d7-b94d-02ddcd434af5
---

User's stated value (2026-06-21): the **anti-pattern** for AI is using it to directly *emit the artifact* with no durable contract underneath — wandb/openui (prompt → live-generated HTML/components, non-deterministic, no canonical model, no conformance) is the example of the BAD approach.

**Why:** when AI's output IS the product, every run is fresh, unverifiable, locked to that tool, and there's nothing stable to cite, conform to, or escape. WE's good approach inverts it: AI is a **dev-time productivity layer over a deterministic neutral contract** — it improves the generation adapter at author/dev-time, never inside the gate or the running output ([[polyglot_reach_forward_adapters]] #463). The SoT is the codified standard; the AI output is disposable. Reinforced by [[project_linear_cost_revenue_on_device]] (no uncapped per-call AI in the running product) and [[feedback_minimize_lock_in_protocol_only_lock]] (devtools = zero lock-in, protocol = the only lock).

**How to apply:** when evaluating any "AI + UI" project or proposal, ask *where the AI sits*. AI over a deterministic contract at dev-time = good. AI as the runtime/SoT emitting the artifact = the bad approach to flag. Same test for plateau's vision direction — outputs reach the standard, the capability stays a no-leakage client ([[project_vision_is_plateau_service_no_leakage]]).
