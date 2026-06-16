---
type: idea
workItem: epic
status: open
blockedBy: ["765"]
dateOpened: "2026-06-16"
tags: [dogfood, fui, site-rework, di-mount, boundary, epic]
---

# Dogfood the WE-docs website on FUI components (rework the site chrome to render only the constellation's own components)

Today the WE-docs site (`:8080`) is hand-written Nunjucks + CSS — its header/nav (`src/_layouts/base.njk`, the [#645](/backlog/645-conform-the-dogfood-we-header-to-apg-disclosure-navigation/) reveal-nav), footer, layout shell, catalog tiles, tables, and badges are all bespoke, none rendered from FUI's real component impl (the docs-rendering boundary forbids it). The end-goal: rework WE-docs so its own chrome renders the constellation's own FUI components — the ultimate dogfooding, where the site **is** the conformance proof. Gated on the [#765](/backlog/765-relax-the-we-fui-isolation-boundary-for-an-in-document-di-mo/) boundary relaxation (in-document Shadow-DOM DI mount of FUI in WE-docs, recommended *relax*); without it WE-docs cannot host FUI component impl in its own document. Sliced umbrella: inventory+map current UI (ready now), then theme/intents bundle, chrome migration, page-UI migration, per-page ratchet — gated behind #765.

## Why this is its own epic

- **It's a stated end-goal, not yet captured.** The existing dogfood work covers *content* and *recipes*, not the site's own chrome: [#604](/backlog/604-migrate-the-we-site-to-render-real-frontier-ui-blocks-replac/) (resolved) embeds FUI-hosted **demos** via iframe next to block-page code samples; [#645](/backlog/645-conform-the-dogfood-we-header-to-apg-disclosure-navigation/) (resolved) conformed the WE header to the APG **recipe** WE specced — but it is still hand-written `base.njk` + `style.css` + `reveal-nav.js`, *not* FUI's component impl. No item rebuilds WE-docs's own UI **out of** the constellation's components. This epic is that gap.
- **The site as conformance proof — the forcing-function loop.** Kin to the exercise-app conformance loop (apps as a forcing function for the standard): when WE-docs renders the real FUI components for its own chrome, every rendered a11y/visual regression **is** a component-conformance failure surfaced on the project's own front door. The rendered-site a11y gate ([#763](/backlog/763-gate-ui-best-practices-on-website-changes-rendered-site-a11y/) → [#770](/backlog/770-rendered-site-a11y-gate-axe-lane-route-allowlist-we-docs/)) becomes the automated proof that the dogfooding stays WCAG-clean.

## The gate — #765 must ratify *relax*

WE-docs chrome (header, nav, footer, layout) **is the page frame itself** — it cannot be iframes, so the [#701](/backlog/701-iframe-based-component-viewer-embed-fui-hosted-standard-demo/) `fuiDemo` iframe mechanism (fine for embedded demos) does **not** serve site chrome. Rendering FUI's real component impl in WE-docs's own document requires the **in-document Shadow-DOM DI mount** that [#765](/backlog/765-relax-the-we-fui-isolation-boundary-for-an-in-document-di-mo/) decides (mode C, runtime FUI-published SDK, WE↔FUI-only, opt-in). The constellation's standing docs-rendering boundary states WE **never** renders FUI block code in its own document — so this epic is **incoherent unless #765 ratifies A (relax)**. #765 is prepared and recommends relax; the user's stated end-goal (2026-06-16) is that direction. **This epic's migration slices stay blocked until #765 resolves.**

Pinned to the tree: current chrome is `src/_layouts/base.njk` (header/nav at `:28-75`), `src/css/style.css`, `src/assets/js/reveal-nav.js`; the catalog/page templates are the `src/*.njk` permalink pages + `src/_includes/**`. The in-document mount rides FUI's embed SDK (the #732/#728 mechanism), never the #700-ruled-out source import.

## Dependencies & related work

- **[#765](/backlog/765-relax-the-we-fui-isolation-boundary-for-an-in-document-di-mo/)** (decision, *active*) — the boundary relaxation. **Hard gate** for every migration slice.
- **[#728](/backlog/728-component-embedding-capability-embed-a-live-component-exampl/)** (epic) — the embed *mechanism*; the mode-C DI-mount build (filed at #765 ratification) is the SDK surface this epic consumes for chrome.
- **[#658](/backlog/658-promote-frontierui-blocks-canonical-migrate-the-9-we-only-fa/)** — promote `@frontierui/blocks` canonical; the components WE-docs would mount must exist and ship from FUI.
- **[#747](/backlog/747-design-system-equals-theme-plus-intents-bundle-manifest-catalog/)** — design-system = theme + intents bundle; WE-docs needs a theme/intents bundle so the dogfooded components carry WE-docs branding.
- **[#763](/backlog/763-gate-ui-best-practices-on-website-changes-rendered-site-a11y/)** → [#770](/backlog/770-rendered-site-a11y-gate-axe-lane-route-allowlist-we-docs/) — the rendered-site a11y gate that proves the rework stays conformant.

## Slicing note

Sliced umbrella (size-less; children carry the points). **Only the inventory/mapping slice is ready now** (pure audit, no boundary dependency); every migration slice is **gated on #765 ratifying relax** and is left uncarved to avoid manufacturing falsely-Tier-A work (the #728 slicing discipline).

- **Children (ready):**
  - **#778 — Inventory WE-docs's hand-written UI and map each surface to its FUI component.** Audit `base.njk` / `style.css` / the `src/*.njk` page templates; enumerate every chrome + page-UI surface (header, nav, footer, layout shell, catalog tiles, tables, badges, buttons, code-sample frame, etc.); for each, name the FUI block/component that replaces it and flag the ones FUI must still build (feeds #658). Produces the migration map. **No #765 dependency** — research only.
- **Not carved yet (gated on #765 relax) — carve once #765 ratifies A and the mode-C DI-mount build exists:**
  - *WE-docs theme/intents bundle* — adopt a FUI theme + intents bundle (#747) so mounted components carry WE-docs branding (blocked on #765 + #747).
  - *Migrate the site chrome* — header/nav (replace the #645 hand-written reveal-nav with the FUI nav block), footer, page-shell/layout, mounted in-document via the mode-C SDK (blocked on #765 + the #728 mode-C build).
  - *Migrate page-level UI* — catalog tiles/cards, tables, badges, code-sample surfaces across `src/*.njk` (blocked on #765 + chrome slice).
  - *Per-page rollout ratchet* — convert page set incrementally behind the #770 a11y gate; mirror the pattern to FUI's own site where it isn't already dogfooded (blocked on the migration slices).

## Open questions (do not block authoring; resolve as the epic proceeds)

- **Scope of "only" our own components.** Total (every pixel from FUI, including layout primitives) vs. pragmatic (chrome + reusable UI from FUI; site-specific one-offs and pure content layout stay native). Recommend pragmatic to start; the inventory slice (#778) surfaces where the line falls.
- **FUI's own site mirror.** FUI's site (`:3001`) presumably already renders FUI components ([#705](/backlog/705-fui-site-s-own-block-surface-7-of-21-its-relationship-to-the/)/[#723](/backlog/723-ensure-all-frontier-ui-content-is-exposed-publicly-on-the-fu/)); confirm in the inventory so this epic's effort is scoped to the WE-docs gap, not duplicated.
