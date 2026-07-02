---
kind: story
size: 3
parent: "2021"
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: []
---

# Generic SSR card/badge primitive for templates (weCard/weBadge macros + per-page splice transform)

Template-facing SSR primitive the #2016 grid shortcodes never built: weCard/weBadge placeholder macros plus a per-page build transform (the spliceDataTables precedent, we:.eleventy.js:275-278) that batches ALL of a page's card/badge specs through renderComponents (we:scripts/lib/component-render-build-hook.cjs:82-97) in ONE FUI-CLI subprocess call — a naive per-card shortcode would spawn ~800 subprocesses per build. Unit tests beside we:scripts/lib/__tests__/component-render-build-hook.test.mjs. Proof-of-life in-slice: convert we:src/semantics.njk (1 section-card) to the primitive. SSR output byte-identical to the client we-card upgrade; JS-off correct; Playwright before/after.

## Resolution

Shipped the generic primitive as macros + a per-page splice transform, modeled on the `spliceDataTables`
precedent:

- **we:src/_includes/we-component.njk** — `weBadge(label, tone)` and `weCard(title, bodyHtml, actionsHtml,
  className)` macros. Each emits an INERT `<we-card|we-badge data-we-spec='{…}'>` placeholder carrying the
  declarative spec as a single-quoted JSON attribute (render-from-data per #2007 — the macro feeds inert
  DATA, it does NOT author the card's internal markup). The body between the tags is the JS-off /
  pre-transform fallback painted by the `we-card{}` / `we-badge{}` baseline in we:src/css/style.css. Only the
  literal `'` is entity-escaped (`&#39;`) since the value is single-quoted; a bare `&` is legal so no
  double-escape occurs. Macro-result args (e.g. a nested `weBadge` fed as `actionsHtml`) are coerced to text
  via `~ ""`.
- **we:scripts/lib/component-render-build-hook.cjs** — added `findComponentPlaceholders` (a QUOTE-AWARE
  scanner — the spec JSON legally carries literal `<`/`>` in nested-markup string values, so a naive
  `[^>]*` open-tag matcher would mis-parse) and `spliceComponents`, the `weComponentSSR` transform body: it
  scans one page for every placeholder, batches ALL of the page's specs through the existing
  `renderComponents` in ONE subprocess call, and splices each returned SSR fragment in place. One subprocess
  per PAGE, never per card. A page with no `data-we-spec` pays a single substring check; a malformed spec or
  a per-entry failure is isolated (placeholder left intact for the client CE path, never aborts the build).
- **we:.eleventy.js** — wired the `weComponentSSR` transform right after `weDataTableSSR`.
- **we:src/semantics.njk** — proof-of-life: the glossary's single `.section-card fui-card` is now authored
  via `weCard`, its `p-0 overflow-hidden` chrome moved onto the card via `className`. The client
  `<we-card>` CE upgrade (we:src/_layouts/base.njk) is a pure enhancement over the JS-off-correct SSR
  baseline.
- **Unit tests** (27 total, +9 for this slice) beside we:scripts/lib/__tests__/component-render-build-hook.test.mjs:
  the quote-aware scanner (single/bare-config specs, malformed-spec skip, no-attr ignore, the
  literal-`>`-in-spec regression), and `spliceComponents` (one-subprocess-per-page economy, no-placeholder
  no-op, per-entry failure isolation).

SSR byte-identity holds by construction: `renderComponents` shells the SAME FUI card/badge factories the
client `<we-card>`/`<we-badge>` CE upgrades from, so the spliced fragment is what the element would upgrade
to — nothing to re-upgrade, idempotent. A full `build:docs` in a real constellation checkout requires FUI's
`build:tools` to have emitted the pinned CLI first (ratified ordering #1946/#2016); the injected-runner unit
tests are the in-slice proof (the lane clone has no sibling FUI artifact).
