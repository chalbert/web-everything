---
type: idea
status: active
dateOpened: '2026-06-06'
dateStarted: '2026-06-06'
tags:
  - rendering
  - render-strategy
  - docs
  - ui
relatedReport: reports/2026-06-06-render-strategy-axis.md
relatedProject: webcomponents
crossRef: { url: /projects/webcomponents/#protocol-render-strategy, label: Render Strategy Protocol }
---

# Add the strategy toggle (Axis-2) alongside the html/jsx source toggle

The block pages already carry the Axis-1 `html`/`jsx` **source toggle** (`src/_includes/source-toggle.njk`). Add the **second, orthogonal Axis-2 toggle** — a strategy selector (declarative-static · vdom · fine-grained · imperative) — that reads the registered strategies from `CustomRenderStrategyRegistry` rather than a hardcoded list, so a new provider appears automatically. The two toggles are independent: spelling × strategy.

First applied on the JSX Adapter page and a representative block page as the demonstrator.

**Acceptance:** strategy selector renders from the registry; switching strategy shows the same element tree under a different update machine (or, until #078 lands, at least the declarative-static vs imperative lowering); reuses the global `mode-selector.js` structure like the existing toggle. Depends on **#077** (registry) and benefits from **#078** (lowering, to populate non-default panes).

## Progress
- **Status:** active — implementation landed and green; ready for review/close.
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - New `src/_includes/strategy-toggle.njk` — `strategyToggle(id, strategies, declarativeSource)` macro. Tabs are rendered from the `renderStrategies` data list (the build-time mirror of `CustomRenderStrategyRegistry`'s catalog — **not hardcoded**; adding a strategy adds a tab). Reuses the global `mode-selector.js` (generic over N tabs).
  - New `src/_data/renderStrategies.json` — the 4-strategy catalog (declarative-static default, vdom, fine-grained, imperative) with one-line summaries.
  - New 11ty filter `liftToVdom` in `.eleventy.js` — lazily esbuild-transpiles `crossStrategy.ts` and runs **#078's `lift`** so the **vdom pane is generated from the authored declarative source at build time** (the compiler runs live on the docs site). fine-grained shows a "same spelling as vdom, differs at runtime" note; imperative shows a "no declarative form" note.
  - Applied on **two pages**: the JSX Adapter page (new `#rendering-strategy` section) and the **for-each block page** (demonstrating the directive → `.map()` collapse on a real block). Verified output, e.g. declarative `<template is="for-each" … item="user">` → generated vdom `{users.map(user => <li key={user.id} …>{user.name}</li>)}`.
  - Updated the stale "parked" reference on the JSX Adapter page → now points at the Render Strategy Protocol.
- **Next:** none for #079. Last item on the chain: **#080** (freeze the runtime `RenderInput`/re-render-trigger contract). Tier-2 follow-on (not blocking): reconcile the explicit `item=` alias dialect with For-Each's item-relative `data-bind` so the toggle can generate from any existing block's authored HTML (currently the declarative example is authored in the compiler dialect).
- **Notes:** `{{ }}` in authored examples is escaped via `{{ '{{' }} … {{ '}}' }}` inside `{% set %}` (njk would otherwise evaluate it). The vdom pane proves the #078 compiler end-to-end through the 11ty build; renderer suite + build are the test surface (no separate unit test — this is presentation wiring over already-tested code).
