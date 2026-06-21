---
kind: epic
parent: "099"
status: open
ongoing: true
dateOpened: "2026-06-21"
tags: [program, discovery, coverage, latent-standards, gap, book-candidate, method]
---

# Latent-standard discovery program

A multi-axis lens catalogue — each lens only emits candidate cards. A standing program to surface **latent standards** — patterns that recur across web pages / apps but
aren't yet in the WE registry. One principle underneath every lens: *a latent standard is a pattern that
recurs along some **axis**; you find it by enumerating that axis from an authoritative source and
**diffing it against the intent / block registry**.* This program is the catalogue of those axes. It is
**cards all the way down — no tooling, no harness, no dashboard.** A lens is a *discovery pass* whose only
output is backlog cards; when a surfaced candidate's reality or placement is unsure, it is filed as a
`decision` card (a decision costs nothing if it turns out trivial). Ongoing: lenses are re-run as the
world changes, and new axes are added as children.

## The discipline (how every lens works)

1. Pick an axis; get its authoritative enumeration (a design-system catalog, the ARIA APG list, OpenUI
   proposals, a real app's behaviors, …).
2. Diff each entry against [we:src/_data/intents/](../src/_data/intents/) +
   [we:src/_data/blocks/](../src/_data/blocks/): **covered / partial / ❌**.
3. Each ❌ or partial → **file a card**. Candidate standard whose placement is unsure → `decision`
   (à la [#1384](/backlog/1384-spatial-manipulation-arrangeable-surfaces-resizable-splitter/)); never
   pre-mint an intent. Tag `book-candidate` so all lenses funnel to one triage.
4. Re-run on cadence; dismissed candidates carry a one-line reason (covered / not-a-standard).

## The axes (lenses)

| Axis | Authoritative source | Lens card |
|---|---|---|
| Component catalog | Design systems (Material, Ark, Radix…) | **/gap-sweep** skill (ran dry 2026-06-20) |
| Interaction verb | Direct-manipulation gesture taxonomy | [#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/) |
| Native platform API | Baseline / newly-shipped web APIs | [#1257](/backlog/1257-platform-standards-watch-keep-we-current-as-the-web-platform/) platform-standards-watch |
| ARIA role / pattern | WAI-ARIA **APG** | [#1400](/backlog/1400-discovery-lens-aria-authoring-practices-apg-pattern-diff-aga/) |
| Standards-in-flight | **OpenUI** proposals, WHATWG/W3C drafts | [#1401](/backlog/1401-discovery-lens-openui-proposals-diff-what-the-platform-wants/) |
| App infrastructure | Cross-cutting concerns checklist | [#1402](/backlog/1402-discovery-lens-app-infrastructure-cross-cutting-concerns-inv/) |
| Data lifecycle | TanStack Query / RTK surface | [#1403](/backlog/1403-discovery-lens-data-lifecycle-paradigms-load-cache-mutate-sy/) |
| Production teardown | Real apps (Linear, Figma, Notion, Stripe) | [#1404](/backlog/1404-discovery-lens-production-app-teardown-inventory-real-apps-d/) |
| Divergence | Where design systems disagree | [#1405](/backlog/1405-discovery-lens-design-system-divergence-pass-where-incumbent/) |
| Intra-standard (dimension vacancy) | Own intents' unfilled dimension combos | `check:axis-vacancy` (existing) |

## First harvest (from the verb lens, #1390)

Six candidate-standard `decision` cards already filed:
[#1384](/backlog/1384-spatial-manipulation-arrangeable-surfaces-resizable-splitter/) (resize/snap/dashboard),
[#1393](/backlog/1393-zoom-pan-a-surface-viewport-scale-translate-standard-placeme/) (zoom/pan),
[#1394](/backlog/1394-undo-redo-reversible-mutation-history-standard-placement/) (undo/redo),
[#1395](/backlog/1395-optimistic-mutation-apply-reconcile-rollback-standard-placem/) (optimistic mutation),
[#1396](/backlog/1396-pointer-gestures-swipe-long-press-pinch-pull-to-refresh-plac/) (gestures),
[#1397](/backlog/1397-in-place-inline-edit-edit-in-place-editable-cell-standard-pl/) (inline edit),
[#1398](/backlog/1398-progressive-loading-infinite-scroll-load-more-standard-place/) (progressive load).

## Done when (per round)

Ongoing — never finitely done. A round is complete when each child lens has been run against the current
registry and every ❌ is either a filed card or a dismissed-with-reason entry.
