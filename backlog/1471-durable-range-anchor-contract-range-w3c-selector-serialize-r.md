---
kind: story
size: 8
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:range-anchor/contract.ts"
tags: []
---

# durable-range-anchor contract — Range↔W3C-selector serialize, re-resolve (fuzzy+orphan), anchorStrategy dimension

Foundational contract ratified by #1408 (Fork 2 split). Author the target-agnostic durable-range-anchor standard: capture a Range, serialize to a W3C selector bundle (TextQuote/TextPosition/Range), re-resolve later with fuzzy fallback + first-class orphan state. Homes Fork 3's anchorStrategy (quote|position|bundle, default bundle) as ITS dimension. Adopts the W3C selector vocabulary wholesale at the wire layer; its we:contract.ts is the foundational slice the annotation intent imports. Reusable beyond annotation (deep-linking, citations, #:~:text=-style scroll-to-text, durable test selectors). File via /new-standard. Per #1408 codifiedIn intents-ux-only corollary.

## Progress (batch-2026-06-21-1429-1487)

Filed the standard (modelling the webgraph artifact set), id `range-anchor`:
- **`we:range-anchor/contract.ts`** (new — the **foundational slice**) — type-only/compile-erased
  (`@webeverything/contracts/range-anchor`). W3C selectors adopted verbatim (`TextQuoteSelector`,
  `TextPositionSelector`, `RangeSelector`); `SelectorBundle` (several selectors → fall back to the
  survivor); `AnchorStrategy` (`quote|position|bundle`) + `DEFAULT_ANCHOR_STRATEGY = 'bundle'` (#1408
  Fork 3, most-flexible default); `AnchorResolution = anchored | fuzzy(confidence) | orphan` (orphan
  first-class); `SerializeOptions`/`ResolveOptions` (context length, fuzzy min-confidence — tuning knobs,
  not forks); the swappable **`RangeAnchor`** serialize/resolve interface (target-agnostic — `root` is any
  node). Runtime (offset math + fuzzy matcher) → FUI; contract is the only lock.
- **`we:contracts/range-anchor.ts`** (new) — the type-only re-export entry.
- **`we:src/_data/projects/range-anchor.json`** + **`we:src/_includes/project-range-anchor.njk`** (new) —
  the project tile + page (Mission/Scope/Contract + the `protocol-durable-range-anchor` anchor section).
- **`we:src/_data/protocols/durable-range-anchor.json`** (new) — the conformance-reference protocol.
- **`we:src/_data/semantics/durable-range-anchor.json`** (new) + **`we:src/assets/icons/range-anchor.svg`**
  (new) — glossary term + tile icon.

Gate green (0 errors), contract typechecks clean. The `annotation` intent (Fork 2a, separate item) +
any FUI behavior block + the FUI runtime impl compose/realize this contract; only the contract lands here.
(Also fixed a `[[wiki-link]]` the #1479 Progress note left in a backlog body — memory-only syntax, gate-red.)
