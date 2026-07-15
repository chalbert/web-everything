---
bornAs: xfklh0m
kind: story
size: 8
status: resolved
dateOpened: "2026-07-15"
dateStarted: "2026-07-15"
dateResolved: "2026-07-15"
graduatedTo: none
tags: []
---

# Restructure plateau-app into a thin product shell (coarse workflow-domain products)

Ratified in #2476: plateau-app becomes a thin product shell — each product (Platform Manager, Design-System Studio, Explorer, Plateau Loop, Brand, Docs) gets its own route prefix + second-level menu under the existing FUI nav blocks, replacing today's flat 17-item Tools list. Coarse granularity (membership from the product-vs-tool criterion; mode-not-product escape hatch for same-object surfaces). Keep the Explorer surface named 'Explorer' (internal label, no brand). Extraction-ready so a product's code can later move per #2446 as a route-move, not a rewrite.

## Scope (sliced 2026-07-15)

The ruling has two halves with very different blast radius, so this story ships the **nav restructure**
only; the route-prefix rename is quarantined to a follow-up.

- **This story — the two-level product-shell sidebar.** Group the flat 26-item nav into a small top-level
  chooser of coarse products, each a `nav:section` disclosure panel owning its own second-level menu;
  `nav:menubar` makes them a sibling-exclusive accordion; `plateau-app:src/main.ts` opens the product
  owning the active route. **Route paths stay flat** (`/intent-configurator`, …) — no broken links.
  Contained to `plateau-app:index.html` + `plateau-app:src/main.ts` + `plateau-app:src/styles/layout.css`.
- **Follow-up (`xs1i22b`, JIT-numbered at land) — route-prefix migration.** Rename routes into
  per-product subtrees (`/studio/intent-configurator`, …) for the extraction-ready property (#2446).
  Higher blast radius (~22 files + the e2e spec + every internal cross-link), so it lands on its own.

Plateau Loop is a listed product but has **no surface/route yet**, so it is not in the nav until its
surface is built.

## Progress

- **Status:** done (pending PR merge)
- **Branch:** plateau-app `lane/2510-thin-product-shell-nav` → PR chalbert/plateau-app#46
- **Done:** two-level product-shell sidebar (Dashboard · Platform Manager · Design-System Studio ·
  Explorer · Brand · Docs · Settings), `nav:section`/`nav:menubar` accordion, `openActiveSection()`
  route→product sync in `plateau-app:src/main.ts`, disclosure CSS in `plateau-app:src/styles/layout.css`.
  Verified against a lane dev server (auto-open on route, accordion collapse, active-item sync, 0 console
  errors); 903 unit tests pass.
- **Next:** merge plateau-app PR #46; resolve this story; the route-prefix migration is `xs1i22b`.
- **Notes:** `nav:section` collapses via the `hidden` attribute (ViewEngine `display` mode), not inline
  `display:none` — needs `.nav-section-panel[hidden]{display:none}` since the author `display:flex`
  outranks the UA `[hidden]` rule.
