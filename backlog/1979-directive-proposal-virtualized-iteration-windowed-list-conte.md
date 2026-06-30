---
kind: decision
parent: "1975"
status: open
blockedBy: ["1971"]
dateOpened: "2026-06-29"
dateStarted: "2026-06-30"
preparedDate: "2026-06-30"
relatedReport: reports/2026-06-29-directive-catalog-brainstorm.md
tags: [webdirectives, composition, directive, virtualization, iteration, validation-gate]
---

# Directive proposal — virtualized iteration (windowed list, content-visibility-backed)

**Prepared.** Two questions: a **validation gate** (admit windowed iteration at the
[#1963 bar](../docs/agent/block-standard.md#composition-rubric)?) plus a genuine **`## Fork 1`** on its *shape*
(extend the existing `ForEach` directive vs mint a separate `virtual` directive). Render only the visible window
of a large list, recycling DOM as the user scrolls — reimplemented everywhere (Angular CDK `*cdkVirtualFor`,
`@lit-labs/virtualizer`, TanStack Virtual, vue-virtual-scroller; catalog report
[§13](/research/directive-catalog-brainstorm/)). **Recommendation: GO, but NOT-YET / blocked on
[#1971](1971-phase-2-nested-directive-lifecycle-composition-declarative-h.md)** (keyed reconciliation + ownership
must land first). **Fork-1 default: a separate `virtual` directive** (flipped from "extend ForEach" by the
skeptic pass — see Fork 1).

## Grounding digest

`ForEach` exists as a comment-anchor directive and the spec parses a `key` for keyed reconciliation, but the
*diffing* itself is Phase-2 work tracked under [#1971](1971-phase-2-nested-directive-lifecycle-composition-declarative-h.md)
(catalog report §2: "key parsed; diffing Phase 2, #1971"; spec keyed-diff note
[we:src/_includes/project-webdirectives.njk:473](../src/_includes/project-webdirectives.njk#L473)). Windowing is
**position, not computation** — it stamps only the visible slice, so it stays 🟢 tree-shape-clean (the windowing
math is the native scroller's, not authored in markup). Its substrate is the **`content-visibility` CSS property
+ `IntersectionObserver`**, both shipped — a clean criterion-4 migration target. So admission at the bar is
sound; the live questions are *when* (after keyed reconciliation) and *what shape*.

## Axis framing

The decisive design tension is the **identity contract**. Keyed reconciliation (#1971) guarantees a **stable DOM
node per key** — reuse/reorder, never rebuild. Windowing's whole point is the **opposite**: recycle a *fixed
pool* of nodes across data items as they scroll out of and into view (node N renders row 5, then row 500). A
naive "`virtual` modifier on `ForEach`" would put **two contradictory ownership models on one directive** — the
skeptic's central hit. The field resolves this by making virtualization a **distinct directive** (`*cdkVirtualFor`
is separate from `*ngFor`; `virtualize()` is separate from `repeat()`), not a flag — which is what Fork 1's
default now reflects.

## Recommended path at a glance

| # | Question | Recommended | Main alternative (excluded) | Confidence |
|---|---|---|---|---|
| Gate | Admit windowed iteration at the #1963 bar? | **GO — but NOT-YET, blocked on #1971** | (reject — leave virtualization to userland) — it is reimplemented in every ecosystem; an uncovered case is a bar-criterion-3 violation | High |
| **Fork 1** | Spelling: extend `ForEach` vs a separate directive | **(b) a separate `virtual` directive** | (a) a `virtual` option on `ForEach` — *contradicts ForEach's keyed-identity contract* | Med-high (flipped by skeptic; matches field precedent) |

## Fork 1 — extend `ForEach` vs a separate `virtual` directive

*Fork-existence:* two **coherent** spellings — a `virtual` modifier on the existing iterator, or a distinct
windowing directive. They genuinely cannot coexist as the *same* construct: the iterator either owns
**stable-node-per-key** identity or **recycle-pool** identity, and those are mutually exclusive ownership models
for one directive (the standing-test either/or). Default flipped to (b) on the merits below.

- **(b) A separate `virtual` directive** *(default)*. Windowing is its own identity contract (a recycled node
  pool over a scrolled window), distinct from keyed reconciliation's stable-node-per-key. Keeping it separate
  means `ForEach`'s keyed contract stays clean and the `virtual` directive owns the recycle semantics + the
  `content-visibility` host wiring. Matches every shipping precedent (`*cdkVirtualFor` ⟂ `*ngFor`; `virtualize()`
  ⟂ `repeat()`).
- **(a) A `virtual` option on `ForEach`.** *Rejected (skeptic pass-1).* Ergonomically tidy (one iterator,
  one extra attribute), but a windowed list **recycles DOM across keys** while keyed reconciliation **pins a node
  per key** — putting both on one directive is a contradictory ownership model. (Note: keyed *windowing* is
  possible — lit/TanStack support it — so the branch is coherent in principle, which is why this is a fork and
  not a forced invariant; it loses on the identity-contract clarity + prior-art convergence, not on
  impossibility.)

```html
<!-- Fork 1 (b), default — a distinct directive; the host scroller carries content-visibility:auto -->
<!-- virtual items="@rows as row" item-size="40" overscan="6" -->
  <tr><td>${row.name}</td></tr>
<!-- /virtual -->

<!-- Fork 1 (a), rejected — a flag on the keyed iterator; the `virtual` recycle-pool contract
     and the keyed stable-node-per-key contract collide on one directive -->
<!-- for-each items="@rows as row" key="id" virtual item-size="40" -->
  <tr><td>${row.name}</td></tr>
<!-- /for-each -->
```

`Skeptic:` REFUTED-default → flipped (refute-only sub-agent, four axes). Pass-1 (merit/classification): "extend
`ForEach` breaks its keyed-identity contract — windowing recycles a node across keys, keyed reconciliation pins a
node per key; these are directly contradictory" — **accepted; the Fork-1 default was flipped from (a) extend to
(b) separate directive**, matching `*cdkVirtualFor`/`virtualize()` precedent. Pass-0: the gate is correctly a
go/no-go and Fork 1 a genuine either/or (both spellings coherent). Pass-2 (statute-overlap): no collision —
`virtual` and `ForEach` become sibling iterators with disjoint identity contracts. Pass-3: the NOT-YET on #1971
is correct — keyed reconciliation is the foundation windowing builds on.

## The gate

- **Digest + verdict:** GO at the bar, **NOT-YET** until #1971 lands (the `blockedBy` edge). Tree-shape-clean
  (windowing is position), real substrate (`content-visibility` + `IntersectionObserver`).
- **Prior-art delta:** the spec has plain `ForEach`; the field universally adds a *windowed* iterator. This card
  proposes it as a sibling directive (Fork 1 (b)).
- **Un-gate trigger:** #1971 (keyed reconciliation + nested-directive ownership) resolves — then the `virtual`
  directive can build on the stable-key foundation.

- **Framework analog:** Angular `*cdkVirtualFor`, `@lit-labs/virtualizer` `virtualize()`, TanStack Virtual,
  vue-virtual-scroller.
- **Substrate / migration target:** `content-visibility` + `IntersectionObserver`.
- **Form: Ⓒ comment** — a windowed iterator over live content, cloning the row template for the visible window
  (same comment-anchor form as `ForEach`).
