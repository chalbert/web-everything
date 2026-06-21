---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
tags: [decision, book-candidate, infinite-scroll, load-more, progressive-loading, gap]
---

# Progressive loading — infinite-scroll / load-more standard: placement

Candidate latent standard surfaced by the verb-axis lens
([#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)): incrementally
loading more of a collection as the user reaches the end — infinite scroll, load-more button,
scroll-triggered pagination — with sentinel/threshold, loading + end-of-list states, scroll-position
preservation, and an a11y-safe alternative to pure infinite scroll. The pieces exist —
`viewport-presence` (intersection trigger), `windowed-collection` (virtualization), `pagination`,
`resource-loader` — but **no standard ties them into the progressive-load pattern**.

**Decision:** is this
a new intent, a composition pattern documented over the existing four, or a dimension of `pagination`?
Likely the lightest of the harvest (may be "just composition"). Refs:
[we:src/_data/intents/viewport-presence.json](../src/_data/intents/viewport-presence.json),
[we:src/_data/intents/windowed-collection.json](../src/_data/intents/windowed-collection.json),
[we:src/_data/blocks/pagination.json](../src/_data/blocks/pagination.json). **Needs `/prepare`.** Unsure ⇒
decision; costs nothing.
