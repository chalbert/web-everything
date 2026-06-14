---
type: issue
workItem: story
size: 3
status: parked
dateOpened: "2026-06-13"
tags: [webblocks, breakpoint, container-queries, layout, resize-observer, deferred, book-candidate]
relatedReport: reports/2026-06-13-responsive-container-query-layout.md
---

# FlexRow intrinsic auto-flow block (webblocks) — realizes breakpoint scope:container

Deferred webblocks block: an intrinsic auto-flow container that flows/wraps its children by available space, realizing the breakpoint intent at scope:container (ratified in #467). Native-first default is CSS @container / flex-wrap; ResizeObserver is named as the implementation substrate (impl-is-not-a-standard, like CSS Anchor Positioning under webpositioning), not its own protocol. The standard-worthy surface is the semantic vocabulary + container-query wiring + the ResizeObserver fallback contract — not the flex CSS. Build deferred until a consumer needs it.

## Origin

Carved from decision [#467](467-responsive-container-query-layout-placement-new-project-vs-i.md) (Fork 3, default A). The two rejected alternatives, for the record:

- **B — a dimension of the `layout` intent.** Rejected: `layout` is app-shell altitude (drawer / rail / pane / dock); FlexRow is content-flow altitude. Folding them overloads `layout` and violates bias-toward-separation.
- **C — nothing (it's just CSS `flex-wrap`).** Rejected: a consumer can't be *conformant* to "use flexbox." The standard-worthy part is the semantic vocabulary + container-query wiring + the ResizeObserver fallback contract.

## Deferred until

A concrete consumer needs intrinsic container-scoped flow. Not built now — this item exists so the concern has a tracked home rather than being lost.
