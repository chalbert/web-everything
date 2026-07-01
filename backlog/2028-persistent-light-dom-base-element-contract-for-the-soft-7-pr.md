---
kind: decision
parent: "2015"
status: open
dateOpened: "2026-07-01"
tags: []
---

# Persistent light-DOM base-element contract for the soft-7 presentational leaves

#1974 (soft-7 light-DOM migration) pre-flight surfaced this. #1962 ratified the POLICY (behaviour-free leaves are light-DOM via display:contents, no self-erasure) but did NOT define the concrete base-element contract, and no reference implementation exists (grep: no persistent light-DOM base class in fui:blocks/**; all soft-7 still extend fui:blocks/transient/TransientElement.ts). Building the migration requires deciding the leaf shape first: (1) does the persistent host style ITSELF directly (host carries the .fui-badge classes + role, display:contents only where a box breaks flex/grid) OR does the host WRAP a natural native tag as a child (the item body says emit span/div/hN/progress/meter inside a styleable host)? (2) where do role/aria-label/naming/CEM land — host or native child? (3) the zero-wrapper to wrapper change alters every consumer DOM (transient shipped a bare native tag; a persistent host adds a node) — regression surface across demos + fui:src consumers. Once ratified + a reference base built (pilot on one leaf), the soft-7 migration in #1974 becomes mechanical. Do NOT pick a shape ad-hoc inside a batch to force #1974 batchable.
