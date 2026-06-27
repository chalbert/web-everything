---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: "docs/agent/platform-decisions.md#composition-preserves-a11y-contract"
tags: []
---

# Composition non-destructiveness contract statement (a11y add-only invariant)

Codify, as a citable WE contract, the ratified rule from #1795: every sanctioned HTML-first composition strategy (slot, decoration, scoped-replace, abstract-piece-split) must be ADD-ONLY to the base block's a11y contract — may extend roles/focus/keyboard/aria, never override or remove. WE owns the contract statement only; per-variant verification is a FUI/Plateau conformance concern. Rule: we:docs/agent/platform-decisions.md#composition-preserves-a11y-contract.

**Delivered.** Added the standalone **contract clause** under the `#composition-preserves-a11y-contract` anchor: the add-only invariant stated explicitly across all four a11y dimensions (roles · focus order · keyboard model · aria) for each of the four sanctioned strategies, framed as a forced, citable conformance target (MAY add / MUST NOT override-remove-reorder-strip). The #1795 resolve had written the rule through the developer-test and strategy-menu lens; #1832 lands the crisp clause a downstream FUI/Plateau conformance run cites verbatim. WE owns only the statement; per-variant verification stays downstream (`[conformance-verifier-vs-subject]`, WE-zero-standard-implementation). No new entity — a docs/contract enhancement of the existing platform-decisions anchor.
