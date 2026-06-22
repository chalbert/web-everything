---
kind: story
size: 8
status: resolved
locus: plateau-app
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "plateau:src/control-plane/dogfooding-progress.ts"
tags: [dogfood, plateau-app, admin, dashboard]
---

# plateau-app admin: dogfooding-progression dashboard across WE, FUI, plateau-app

Build an admin-view dashboard in plateau-app that shows, at a glance, how far the
first-party dogfooding effort has progressed across the three constellation layers
([first-party-dogfood](../docs/agent/platform-decisions.md#first-party-dogfood)).
Today that progress is scattered across backlog epics ([#777](/backlog/777-dogfood-the-we-docs-website-on-fui-components-rework-the-sit/) WE-docs chrome,
[#1254](/backlog/1254-rebuild-plateau-app-s-ui-on-fui-components-custom-theme-int/) plateau-app UI,
[#1210](/backlog/1210-dogfood-render-the-we-pitch-deck-on-we-standards-fui-compone/) deck) with no aggregate surface;
you have to read each epic's child slices to know where things stand. This card renders that.

## Why plateau-app admin (not the WE-docs site)

A progress dashboard is **product tooling, not a standard** — it has zero place in
`@webeverything` (WE holds zero implementation). It's an operator/admin view over the
program's own state, so it belongs in plateau-app's admin surface alongside the other
control-plane views, and is itself a dogfooding target (it should render from FUI
components + a theme, per [#1254](/backlog/1254-rebuild-plateau-app-s-ui-on-fui-components-custom-theme-int/) — not be hand-rolled around).

## What it shows

Per layer (WE-docs · plateau-app · deck — extensible), derived from each dogfooding
epic's child-slice edges:

- **Adoption %** — resolved child slices ÷ total carved slices for that epic.
- **Surface checklist** — each migration surface (the target-list rows in #1254 etc.)
  with state: not-started · in-progress (active) · gated-on-FUI-gap · done.
- **Open FUI gaps** — the FUI component gaps still blocking gated surfaces, with their #.
- **Last-moved** — most recent dateResolved among the children, so a stalled layer is visible.

## Data source (the real design fork to settle when claimed)

The numbers all live in `backlog/*.md` frontmatter (`parent:`/`blockedBy:` edges,
`status`, `dateResolved`). Options for feeding the plateau-app page:

- **A — committed JSON snapshot.** A small WE-side generator script reads the backlog and
  emits a `we:dogfooding-progress.json`; plateau-app's admin page renders it. Stale between
  regens, but no live cross-repo coupling. **(default — matches how catalogs already
  auto-render from registry JSON; cheapest, no new runtime dependency.)**
- **B — live read.** plateau-app reads the backlog directory at request time. Freshest, but
  couples the product to WE's repo layout / requires the files be present at runtime.

**Resolved → a live-derive variant (the "keep it up to date" requirement settled it).** A
committed snapshot (A) goes stale the moment any backlog item moves; option B's spirit (always
fresh) is what was asked for, done cleanly through plateau-app's existing `/api/*` dev seam: the
WE-side `we:scripts/gen-dogfooding-progress.mjs` is the single derivation source (it reuses WE's
canonical backlog loader `we:src/_data/backlog.js`, so it can never drift from `/backlog/`), and
plateau-app's vite dev middleware exec's it with `--json` **on every request**. No committed
snapshot, no regen hook, no duplicated derivation — the dashboard is current with the backlog by
construction.

## Done when

- ✓ plateau-app admin route (`/control-plane`) renders the dashboard — one section per dogfooding
  layer (WE-docs · plateau-app · Deck), status via the FUI `we-badge` block (#1508's, not hand-rolled).
- ✓ Adoption % and surface states are derived live from backlog edges, not hand-maintained.
- ✓ A rendered browser check passes (Playwright: 3 layers, correct %s, tone-coloured badges, no errors).

## Edges

- `relatedProject` plateau-app (admin/control-plane surface).
- Reads the state of [#777](/backlog/777-dogfood-the-we-docs-website-on-fui-components-rework-the-sit/), [#1254](/backlog/1254-rebuild-plateau-app-s-ui-on-fui-components-custom-theme-int/), [#1210](/backlog/1210-dogfood-render-the-we-pitch-deck-on-we-standards-fui-compone/) — does not block them.
- Itself a dogfooding surface under [#1254](/backlog/1254-rebuild-plateau-app-s-ui-on-fui-components-custom-theme-int/)'s mandate.

## Progress

- **Status:** done — built and verified on the running `:4000` dev server.
- **WE (this repo):** `we:scripts/gen-dogfooding-progress.mjs` — live derivation over `we:src/_data/backlog.js`; `--json` for machines, pretty summary by default. Layer↔epic map lives here (add a layer → dashboard grows a section).
- **plateau-app:** `plateau:src/control-plane/dogfooding-progress.ts` (FUI-badge view) + CSS in `plateau:src/control-plane/control-plane.css`; wired in `plateau:src/main.ts` + `plateau:index.html`; live endpoint `/api/dogfooding-progress` in `plateau:vite.config.mts` (exec's the WE script per request).
- **Verified:** WE-docs 70% · plateau-app 86% · Deck 100% — the plateau-app number moved 57%→86% live across the session as #1507/#1508 resolved, proving freshness.
- **Note:** two-repo change → two commits (WE script here; plateau pieces in plateau-app), never pushed.
