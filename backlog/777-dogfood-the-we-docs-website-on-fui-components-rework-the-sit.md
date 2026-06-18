---
type: idea
workItem: epic
status: open
dateOpened: "2026-06-16"
tags: [dogfood, fui, site-rework, di-mount, boundary, epic]
---

# Dogfood the WE-docs website on FUI components (rework the site chrome to render only the constellation's own components)

Today the WE-docs site (`:8080`) is hand-written Nunjucks + CSS — header/nav (`we:src/_layouts/base.njk`, the [#645](/backlog/645-conform-the-dogfood-we-header-to-apg-disclosure-navigation/) reveal-nav), footer, layout shell, catalog tiles, tables, badges — none rendered from FUI's real component impl. The end-goal: rework WE-docs so its own chrome renders the constellation's own FUI components — the ultimate dogfooding, where the site **is** the conformance proof. The [#765](/backlog/765-relax-the-we-fui-isolation-boundary-for-an-in-document-di-mo/) boundary relaxation (in-document Shadow-DOM DI mount) that gated this is now resolved. Sliced umbrella: inventory (#778, done), theme/intents bundle (#864), chrome migration (#865), page-UI (#866), per-page ratchet (#867). Re-opened 2026-06-17 after a premature resolve (gate had since cleared: #765/#786/#747).

## Why this is its own epic

- **It's a stated end-goal, not yet captured.** The existing dogfood work covers *content* and *recipes*, not the site's own chrome: [#604](/backlog/604-migrate-the-we-site-to-render-real-frontier-ui-blocks-replac/) (resolved) embeds FUI-hosted **demos** via iframe next to block-page code samples; [#645](/backlog/645-conform-the-dogfood-we-header-to-apg-disclosure-navigation/) (resolved) conformed the WE header to the APG **recipe** WE specced — but it is still hand-written `we:base.njk` + `we:style.css` + `we:reveal-nav.js`, *not* FUI's component impl. No item rebuilds WE-docs's own UI **out of** the constellation's components. This epic is that gap.
- **The site as conformance proof — the forcing-function loop.** Kin to the exercise-app conformance loop (apps as a forcing function for the standard): when WE-docs renders the real FUI components for its own chrome, every rendered a11y/visual regression **is** a component-conformance failure surfaced on the project's own front door. The rendered-site a11y gate ([#763](/backlog/763-gate-ui-best-practices-on-website-changes-rendered-site-a11y/) → [#770](/backlog/770-rendered-site-a11y-gate-axe-lane-route-allowlist-we-docs/)) becomes the automated proof that the dogfooding stays WCAG-clean.

## The gate — #765 must ratify *relax*

WE-docs chrome (header, nav, footer, layout) **is the page frame itself** — it cannot be iframes, so the [#701](/backlog/701-iframe-based-component-viewer-embed-fui-hosted-standard-demo/) `fuiDemo` iframe mechanism (fine for embedded demos) does **not** serve site chrome. Rendering FUI's real component impl in WE-docs's own document requires the **in-document Shadow-DOM DI mount** that [#765](/backlog/765-relax-the-we-fui-isolation-boundary-for-an-in-document-di-mo/) decides (mode C, runtime FUI-published SDK, WE↔FUI-only, opt-in). The constellation's standing docs-rendering boundary states WE **never** renders FUI block code in its own document — so this epic is **incoherent unless #765 ratifies A (relax)**. #765 is prepared and recommends relax; the user's stated end-goal (2026-06-16) is that direction. **This epic's migration slices stay blocked until #765 resolves.**

Pinned to the tree: current chrome is `we:src/_layouts/base.njk` (header/nav at `:28-75`), `we:src/css/style.css`, `we:src/assets/js/reveal-nav.js`; the catalog/page templates are the `src/*.njk` permalink pages + `src/_includes/**`. The in-document mount rides FUI's embed SDK (the #732/#728 mechanism), never the #700-ruled-out source import.

## Dependencies & related work

- **[#765](/backlog/765-relax-the-we-fui-isolation-boundary-for-an-in-document-di-mo/)** (decision, *active*) — the boundary relaxation. **Hard gate** for every migration slice.
- **[#728](/backlog/728-component-embedding-capability-embed-a-live-component-exampl/)** (epic) — the embed *mechanism*; the mode-C DI-mount build (filed at #765 ratification) is the SDK surface this epic consumes for chrome.
- **[#658](/backlog/658-promote-frontierui-blocks-canonical-migrate-the-9-we-only-fa/)** — promote `@frontierui/blocks` canonical; the components WE-docs would mount must exist and ship from FUI.
- **[#747](/backlog/747-design-system-equals-theme-plus-intents-bundle-manifest-catalog/)** — design-system = theme + intents bundle; WE-docs needs a theme/intents bundle so the dogfooded components carry WE-docs branding.
- **[#763](/backlog/763-gate-ui-best-practices-on-website-changes-rendered-site-a11y/)** → [#770](/backlog/770-rendered-site-a11y-gate-axe-lane-route-allowlist-we-docs/) — the rendered-site a11y gate that proves the rework stays conformant.

## Slicing note

Sliced umbrella (size-less; children carry the points). **Re-opened 2026-06-17:** this epic was resolved 2026-06-16 with **only the inventory slice (#778) done** and its four migration slices never carved — but its gate has since cleared (#765 *relax* resolved; the mode-C DI-mount build #786 resolved; the theme/intents decision #747 resolved). The migration work is now genuinely ready, so the epic is re-opened and the slices carved.

- **Children (done):**
  - **#778 — Inventory WE-docs's hand-written UI and map each surface to its FUI component.** ✅ resolved — produced the migration map (research only, no #765 dependency).
- **Children (carved 2026-06-17, now unblocked):**
  - **#864 — WE-docs theme/intents bundle** — adopt a FUI theme + intents bundle (#747, resolved) so mounted components carry WE-docs branding. Ready (gate cleared).
  - **#865 — Migrate the site chrome** — header/nav (replace the #645 hand-written reveal-nav with the FUI nav block), footer, page-shell/layout, mounted in-document via the mode-C SDK (#786, resolved). Ready (gate cleared).
  - **#866 — Migrate page-level UI** — catalog tiles/cards, tables, badges, code-sample surfaces across `src/*.njk`. Blocked on the chrome slice #865.
  - **#867 — Per-page rollout ratchet** — convert page set incrementally behind the #770 a11y gate; mirror the pattern to FUI's own site where not already dogfooded. Blocked on the migration slices.

## Open questions (do not block authoring; resolve as the epic proceeds)

- **Scope of "only" our own components.** Total (every pixel from FUI, including layout primitives) vs. pragmatic (chrome + reusable UI from FUI; site-specific one-offs and pure content layout stay native). Recommend pragmatic to start; the inventory slice (#778) surfaces where the line falls.
- **FUI's own site mirror.** FUI's site (`:3001`) presumably already renders FUI components ([#705](/backlog/705-fui-site-s-own-block-surface-7-of-21-its-relationship-to-the/)/[#723](/backlog/723-ensure-all-frontier-ui-content-is-exposed-publicly-on-the-fu/)); confirm in the inventory so this epic's effort is scoped to the WE-docs gap, not duplicated.
