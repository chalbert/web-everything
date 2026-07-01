---
kind: story
size: 5
parent: "777"
status: open
dateOpened: "2026-07-01"
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

## Notes / boundary

- **Sub-decision to avoid a fork:** render as **plain projected HTML** (the data-table hook's approach — no shadow
  DOM), not declarative shadow DOM, to stay consistent with the shipped SSR mechanism. If DSD is later wanted that
  is a separate decision; this item reuses the ratified plain-projection path to remain no-decision.
- WE holds zero impl — the actual render logic lives in FUI; WE only gains the Eleventy glue + subprocess call.
