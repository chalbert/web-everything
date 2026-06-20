---
kind: epic
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:docs/agent/block-standard.md"
tags: []
---

# webblocks protocol-surface governance umbrella (79-block standard)

Surfaced by the #991 audit (§8): 79 block definitions (33 active/32 draft/14 concept) + 234 ts are built, but no item owns the block protocol surface/governance — nominal owner #237 is blocked and addresses inter-module protocols, not block specs. Today the rules exist but are scattered, validator-only, and undocumented (lifecycle enum, `BLOCK_TYPES`, the #936 `composesBehaviors` gate); this umbrella consolidates them into one governance home + closes named drift.

**Umbrella for block-standard governance; sliced into (DAG A → {B, C, D}):**
- [#1087](/backlog/1087-block-standard-governance-spec-home-block-spec-schema-refere/) — governance spec home + block-spec schema reference (the "type system" area); foundational doc the rest hang off.
- [#1092](/backlog/1092-block-status-lifecycle-governance/) — status lifecycle governance (`concept→draft→experimental→active` + graduation criteria). *blockedBy #1087*
- [#1093](/backlog/1093-block-protocol-taxonomy-governance/) — protocol taxonomy governance (define each `type` category; reconcile the `Utility` drift). *blockedBy #1087*
- [#1094](/backlog/1094-block-composability-rules-governance/) — composability rules governance (`dependsOn`/`composesIntents`/`composesBehaviors`/… semantics). *blockedBy #1087*

After #1087 lands, #1092/#1093/#1094 proceed independently. See `we:reports/2026-06-19-backlog-split-analysis.md` for the full slice rationale.
