---
name: project_plug_is_proposed_missing_standard
description: A WE plug = a proposed missing web standard as runnable code; unplugged = safe-now; the prep dual-posture lens
metadata: 
  node_type: memory
  type: project
  originSessionId: f7311279-4529-461b-8b2b-e89eb7bd5220
---

WE's goal is to **create the missing standard**: when a capability is *elemental to web applications* but absent from the platform spec, WE can't wait (for standards bodies) and can't force (adoption) — so it ships **both** postures:

- **Plugged** = the *proposed standard materialized as runnable code* — WE's bet on what the platform should offer, the candidate to take upstream ([[feedback_standards_bodies_are_upstream_not_competitors]]). Carries the enforcement/validation/polyfill that demonstrates the standard.
- **Unplugged** = *safe-today usage* of only what the platform actually ships — non-invasive, tree-shakeable, enforcement-free; the "real product surface" (#606).

This is **distinct from** [[feedback_native_first_default]] / `#native-first-baseline`, which covers capabilities that *exist* (Baseline-2024, assume-present, no dual contract). This new lens is for capabilities *absent from every spec*. The two compose: the statute's "polyfills are an opt-in enhancement the consumer adds" line **is** plugging — this names the vehicle.

**Guardrail:** the standard *contract* WE defines stays **single-substrate**. Plugged/unplugged is the **delivery + enforcement** axis (proposed-future vs safe-now), NOT two competing contracts for one capability — else dual-substrate contracts sneak back in past `#native-first-baseline`.

**How to apply:** in decision-prep, when a fork is about an elemental-but-missing platform capability, frame it as plugged(proposed standard) + unplugged(safe-now) — never force a single bespoke choice. Decision #1826 codifies this (platform-decisions statute + prepare-decision-item lens); first application is #1807 (declarative custom-state surface: unplugged = native CustomStateSet + sugar; plugged = declarative `states=` vocabulary + validation). See [[project_managed_offering_constellation_layering]] for the layering (plug contract→WE, impl→FUI).

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#native-first-baseline` (the statute is source-of-truth; the `#NNN` above is provenance, not the reference).
