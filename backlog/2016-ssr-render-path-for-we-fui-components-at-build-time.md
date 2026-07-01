---
kind: story
size: 5
parent: "777"
status: active
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
tags: [dogfood, fui, ssr, eleventy, keystone, di-mount]
---

# SSR render path for WE/FUI components at build time (Eleventy)

## Digest

**Keystone for the WE-docs dogfood epic (#777).** Today the *only* build-time path that renders a WE/FUI
component to real HTML is the data-table resolver (`we:.eleventy.js:273` → `we:scripts/lib/data-table-build-hook.cjs`).
Every other component — `we-card`, `we-badge`, `we-tag` — is emitted as a bare custom element and *upgraded in
the browser* (`we:src/_layouts/base.njk:441-496` registers transient CEs client-side). So the site is **not**
SSR'd from our components; it degrades to a hand-rolled HTML baseline with optional client enhancement. "Full SSR
with our components" is a **missing capability**, and it blocks A1–A4 (#2018–#2021).

Deliver a general build-time component→HTML render path, modeled on the existing data-table hook (subprocess to
the FUI CLI over the cross-repo boundary — **no code import**), exposed to templates as an Eleventy shortcode/filter.
Given a component spec (`we-card` with slots, `we-badge` status, `we-tag` list) it returns ready-to-paint HTML so
the page renders correctly with **JS disabled**, and the client CE upgrade becomes a pure enhancement.

## Scope

- Extend the FUI CLI (or add a sibling command to the data-table one) to render `we-card` / `we-badge` / `we-tag`
  to static HTML given a JSON spec. Reuse the same subprocess boundary as `we:scripts/lib/data-table-build-hook.cjs`.
- Add an Eleventy shortcode/filter (`we:.eleventy.js`) — e.g. `{% weCard ... %}` / `renderComponent(spec)` — that
  invokes it at build and splices the HTML into the page output.
- Keep the transient CE registration (`we:src/_layouts/base.njk`) as the progressive-enhancement upgrade layer;
  SSR output must be the baseline, CE upgrade must be idempotent over it.
- Reuse the existing JS-first token inlining (`we:src/_layouts/base.njk:9-16`) so SSR'd components are styled
  without FOUC.

## Acceptance

- One catalog page (pick `we:src/intents.njk`, already dogfooded via CE) renders its `we-card`/`we-badge`/`we-tag`
  tiles as **SSR HTML** — correct with JS off, verified by Playwright (0 console errors) and by view-source.
- The render path is a build-time subprocess to the FUI CLI; no FUI runtime import into the 11ty build.
- Documented as the reusable pattern A1–A4 build on.

## Blocked — buried source-contract fork (grounded 2026-07-01, batch-2026-07-01-2016-2017)

Grounding the FUI + WE sides revealed this item is **not no-decision**. The FUI render side is clean —
`fui:blocks/badge/Badge.ts:44` `createBadge`, `fui:blocks/tag/Tag.ts:96` `createTag`,
`fui:blocks/card/Card.ts:46` `createCard` are pure factories serialisable via `.outerHTML`, and
`fui:tools/data-table-build/cli.ts` + `fui:blocks/renderers/data-table/buildHarness.ts` are a direct template
for a sibling `component-render` build tool. **But the input contract forks.** Every catalog surface today uses
card/badge/tag as **inline-slot wrappers** (`we:src/intents.njk:56-69` — `<we-card><h3>…</h3>…</we-card>`,
`<we-badge>status</we-badge>`), **not** a `config="[[ ref ]]"` data binding like `we-data-table`. So build-time
SSR must choose:

- **(A) data-as-source** — rewrite templates to emit a JSON `config` spec the FUI tool renders; or
- **(B) markup-as-source** — build-time *upgrade* the existing light-DOM element to canonical `fui-*` markup
  (what the runtime `registerCardInDocument()` already does), extracting title/actions/body from inner HTML.

This is the **same markup-vs-data-source split as #1964**, now settled by the general **feed-mechanism rule
([#2007](2007-feed-mechanism-governance-a-block-owning-rendered-shape-must.md), ratified 2026-07-01 →
[we:docs/agent/block-standard.md#feed-mechanism](../docs/agent/block-standard.md#feed-mechanism))**: a block
that re-renders/restructures is fed inert `<template>`/`[[ ref ]]` data; a structure-preserving enhancer reads
live DOM off `data-*`. Card/badge/tag own their rendered shape, so under #2007 they are **render-from-data /
inert-markup** surfaces — the SSR tool emits their shape from data, it does not treat authored markup as source.
That contract is now decided, so this item is unblocked.

NB the earlier "Sub-decision to avoid a fork" note addressed the *output-format* fork (plain HTML vs shadow DOM);
the *input-source* one is what #2007 settled.

## Notes / boundary

- Once #2007 ratifies: if **unwrap** for static surfaces, this item shrinks to a build-time markup emit (maybe no
  subprocess at all); if **render-from-data**, it becomes the data-table-shaped subprocess tool as originally
  written. Re-scope on ratification.
- WE holds zero impl — the actual render logic lives in FUI; WE only gains the Eleventy glue + subprocess call.
