---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
tags: [decision, book-candidate, undo, redo, history, command, gap]
---

# Undo / redo — reversible mutation history standard: placement

Candidate latent standard surfaced by the verb-axis lens
([#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)): a reversible
mutation-history model — an undo/redo stack of applied changes, with grouping/coalescing, scope, and the
inverse-operation contract. WE owns invocation (`command` intent, Baseline Invoker Commands) and autosave
(`draft-persistence` block), but **neither models a reversible history** — that's the gap. **Decision:**
own intent vs an extension of `command` vs a behavior over `simple-store`; what the
reversible-operation contract is; relationship to optimistic mutation
([#1395](/backlog/1395-optimistic-mutation-apply-reconcile-rollback-standard-placem/)), which also needs
rollback. Refs: [we:src/_data/intents/command.json](../src/_data/intents/command.json),
[we:src/_data/blocks/draft-persistence.json](../src/_data/blocks/draft-persistence.json),
[we:src/_data/blocks/simple-store.json](../src/_data/blocks/simple-store.json). **Needs `/prepare`.**
Unsure ⇒ decision; costs nothing.
