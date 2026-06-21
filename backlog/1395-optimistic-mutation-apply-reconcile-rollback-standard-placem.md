---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
tags: [decision, book-candidate, optimistic, mutation, data-lifecycle, gap]
---

# Optimistic mutation — apply, reconcile, rollback standard: placement

Candidate latent standard surfaced by the verb-axis lens
([#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)) and the
data-lifecycle lens ([#1403](/backlog/1403-discovery-lens-data-lifecycle-paradigms-load-cache-mutate-sy/)):
apply a change to the UI immediately, reconcile against the source of truth, and roll back on failure —
the optimistic-update pattern every data library ships. WE owns loading (`resource-loader`), reliability /
retry (`reliability`), and background work (`background-task`), but **no apply-then-reconcile-then-rollback
model**. **Decision:** own intent vs a dimension of `reliability` vs a behavior composing
`resource-loader` + a rollback contract; shared rollback machinery with undo/redo
([#1394](/backlog/1394-undo-redo-reversible-mutation-history-standard-placement/)). Refs:
[we:src/_data/intents/reliability.json](../src/_data/intents/reliability.json),
[we:src/_data/blocks/resource-loader.json](../src/_data/blocks/resource-loader.json). **Needs `/prepare`.**
Unsure ⇒ decision; costs nothing.
