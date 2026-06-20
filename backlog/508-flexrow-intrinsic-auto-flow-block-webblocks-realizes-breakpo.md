---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
tags: [webblocks, breakpoint, container-queries, layout, resize-observer, deferred, book-candidate]
relatedReport: reports/2026-06-13-responsive-container-query-layout.md
---

# FlexRow intrinsic auto-flow block (webblocks) — realizes breakpoint scope:container

Deferred webblocks block: an intrinsic auto-flow container that flows/wraps its children by available space, realizing the breakpoint intent at scope:container (ratified in #467). Native-first default is CSS @container / flex-wrap; ResizeObserver is named as the implementation substrate (impl-is-not-a-standard, like CSS Anchor Positioning under webpositioning), not its own protocol. The standard-worthy surface is the semantic vocabulary + container-query wiring + the ResizeObserver fallback contract — not the flex CSS.

> **Unparked 2026-06-16 (prioritization call).** Was deferred-until-demand; deliberately un-parked to
> build ahead of a hard consumer need. Spec below is ready to execute.

## Origin

Carved from decision [#467](/backlog/467-responsive-container-query-layout-placement-new-project-vs-i/) (Fork 3, default A). The two rejected alternatives, for the record:

- **B — a dimension of the `layout` intent.** Rejected: `layout` is app-shell altitude (drawer / rail / pane / dock); FlexRow is content-flow altitude. Folding them overloads `layout` and violates bias-toward-separation.
- **C — nothing (it's just CSS `flex-wrap`).** Rejected: a consumer can't be *conformant* to "use flexbox." The standard-worthy part is the semantic vocabulary + container-query wiring + the ResizeObserver fallback contract.

## Unparked

Un-parked 2026-06-16 as a prioritization call (build ahead of demand). Previously this section read
"deferred until a concrete consumer needs intrinsic container-scoped flow" — kept for trace.

## Progress (resolved 2026-06-16)
- Added the `flex-row` block to [`fui:src/_data/blocks.json`](../src/_data/blocks.json) — `status: concept`,
  `implementsIntent: breakpoint`, `intentDimensions: { scope: container }`; `designDecisions` capture the
  container-scoped reflow, native-first CSS `@container`/`flex-wrap` default, and the ResizeObserver
  fallback contract; `webStandards` cite container queries, `flex-wrap`, and `ResizeObserver`.
- Authored [`we:src/_includes/block-descriptions/flex-row.njk`](../src/_includes/block-descriptions/flex-row.njk)
  documenting the standard-worthy surface (semantic vocabulary + container-query wiring + ResizeObserver
  fallback contract — **not** the flex CSS), framing ResizeObserver as the impl substrate
  (impl-is-not-a-standard, parallel to CSS Anchor Positioning under Web Positioning).
- Regenerated we:AGENTS.md inventory (blocks 74→75); 11ty builds clean; `/blocks/flex-row/` renders; gate green.
