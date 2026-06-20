---
kind: story
size: 3
parent: "1040"
status: resolved
blockedBy: ["1087"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:docs/agent/block-standard.md"
tags: []
---

# Block composability rules governance

Document the composition-field semantics — composesIntents / composesBehaviors / composesWith / dependsOn / implementsIntent / consumesIntent — codifying the #936 composesBehaviors resolution gate (`we:scripts/check-standards.mjs:151-182`) and the dependsOn block-graph rules, as a governance section under #1087's spec home.

## Progress (resolved 2026-06-19)

Added a **Composability governance (#1094)** section to we:docs/agent/block-standard.md (the #1087 spec home), covering all six composition fields across three axes:
- **Intent axis** — `implementsIntent` (one; owns the runtime) vs `composesIntents` (many; delegates) vs `consumesIntent` (one; reads from scope), with the discriminator (runtime ownership) and the compose-don't-reimplement discipline (#933).
- **Behavior axis** — `composesBehaviors`, codifying the **gate-enforced** #936 rules verbatim from `we:scripts/check-standards.mjs`: must resolve to a provided `traits[].name`, must be an array, `composesTraits` is the reserved/rejected legacy name (collides with The Map).
- **Block-graph axis** — `dependsOn` (hard prerequisite → directed acyclic graph, no active-on-unbuilt) vs `composesWith` (soft advisory affinity), with the Bias-toward-Separation rationale.

Section landed below the #1093 taxonomy section (which had already merged on the integration branch); the "What this home does not cover" closing was reconciled — lifecycle/taxonomy/composability are now all authored. Verified the gate claims against the real `we:scripts/check-standards.mjs:166-190` enforcement. Added an honest gate-coverage note: only `composesBehaviors`/`composesTraits` is validator-enforced today; the intent-axis discipline and `dependsOn` acyclicity/status-floor are documented authoring governance, not yet machine-checked. Whole-repo gate green.
