---
kind: epic
size: 5
status: open
dateOpened: "2026-06-20"
tags: []
---

# FUI convergence — umbrella coordinating the scattered WE↔Frontier UI alignment epics

Coordinating umbrella for the WE↔Frontier UI convergence effort, today scattered across seven sibling epics with nothing tracking the whole. Goal: WE and FUI converge to one plugs runtime plus canonical blocks with zero drift, so 'how close are we to convergence?' becomes answerable. Finite convergence (has a Definition of Done) with a standing drift-guard tail (keep the deduped runtime in sync forever) that is its own front-A program candidate. Coordinates the facet epics by reference rather than re-parenting them (deferred until the #487 schema migration settles).

## Why this exists

The convergence effort surfaced in the 2026-06-20 program review: ~440 items reference FUI, spread across seven *sibling* epics with **no meta-epic**, so the constellation cannot answer "how close are we to one runtime + canonical blocks?" This umbrella is the coordination home — not new work, a lens over existing work. Per the ratified [Program Test](/backlog/1249-define-program-strictly-the-four-part-bar-for-a-perpetual-on/), convergence itself is a **finite epic** (it has a Definition of Done), *not* a program — only its drift-guard tail is standing.

## Facet map (coordinated, not re-parented)

- [#746](/backlog/746-block-explorer-the-interactive-fui-block-workbench-live-the/) — Block Explorer (the FUI block workbench) · **open**
- [#170](/backlog/170-the-plugs-runtime-is-duplicated-and-drifting-between-web-ev/) — plugs runtime duplicated/drifting WE↔FUI · **open** (reconcile children [#649](/backlog/649-reconcile-plugs-we-fui-drift-dual-mode-test-backfill-ahead-o/) ✓, [#1250](/backlog/1250-re-reconcile-fui-plugs-up-to-we-contract-anchored-add-a-real/) open)
- [#904](/backlog/904-fui-block-impl-backfill-drift-enforcement-umbrella-for-the-/) — block-impl backfill + drift enforcement · **resolved**
- [#658](/backlog/658-promote-frontierui-blocks-canonical-migrate-the-9-we-only-f/) — promote @frontierui/blocks canonical · **resolved**
- [#777](/backlog/777-dogfood-the-we-docs-website-on-fui-components-rework-the-sit/) — dogfood WE-docs on FUI · **open** (own umbrella; child [#934](/backlog/934-we-docs-chrome-composes-real-we-traits-instead-of-hand-roll/) ✓)
- [#728](/backlog/728-component-embedding-capability-embed-a-live-component-examp/) — component embedding capability · **open**

## Definition of Done

WE imports no vendored block/runtime that FUI owns; the plugs runtime is single-sourced (#170 closed) with a drift gate that stays green; WE-docs renders from FUI components (#777 closed). The **standing drift-guard** (the gate that keeps the single-sourced runtime from re-drifting) outlives this epic — carve it as its own `ongoing` front-A item before resolving, don't fold it in here.

## Open structural decision (deferred)

Whether to **re-parent** the open facet epics under this umbrella (true parent edges) or keep the by-reference map above. Deferred until the [#487](/backlog/487-migrate-backlog-schema-to-single-kind-axis-per-466-ruling/) `kind`-axis migration settles, since epic-under-epic parenting interacts with the burndown/sizing rules.
