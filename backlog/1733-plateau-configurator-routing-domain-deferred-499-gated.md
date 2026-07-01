---
kind: story
size: 3
status: resolved
priority: low
locus: plateau-app
blockedBy: ["1732"]
dateOpened: "2026-06-24"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: none
tags: [webrouting, routing, configurator, plateau, deferred]
---

# plateau Configurator routing domain (deferred, #499-gated)

Deferred, #499-gated: a plateau Configurator routing domain — one plateau:src/technical-configurator/seed-routing.ts plus a provider entry — that walks a developer through routing outcomes and emits webrouting config over the #1687 schema. Build only if it adds outcome-framing value beyond exposing the schema's enums (the intents-UX-only converse-guard); a per-setting test decides which settings earn a guided outcome. Mirrors the live plateau:src/technical-configurator/seed-render-strategy.ts and plateau:src/technical-configurator/seed-file-upload.ts precedent. Parked until routing config proves it needs outcome-framing in a real app flow.

## Progress

**Status:** Done. All blockers (#1732 vectors, #499 domain precedent, #1687 schema home) resolved — item unblocked.

**Converse-guard verdict (the per-setting test).** Ran the per-setting test against the #1687 route-config schema (`we:blocks/router/route-config.ts`). Verdict recorded in the seed's doc comment:
- **Earns a guided outcome → built into the domain:** `history` (browser/hash/memory) and `prerender`. These cross-cut — URL addressability × static-host deployability × prerendered first-paint — into a config *bundle* whose outcome→config mapping is non-obvious (a static host can't serve `browser`-history deep links without a server rewrite; `memory` has no address bar). `prerendered-browser` shares `history:'browser'` with plain browser history but differs on the SEO axis, so the domain is genuinely multi-dimensional, **not** a single-enum rename — clearing the intents-UX-only converse-guard.
- **Does NOT earn → left as bare schema enum/field:** `base`, `notFound` (deploy-path data entry), `redirects` (rule authoring), `caseSensitive`/`trailingSlash` (flat canonicalization prefs), `localePrefix` (a real i18n-SEO tradeoff but an orthogonal concern, not the delivery cluster), per-route `lazy` (already covered by trait-lazy-load / chunk-split) and `scroll` (minor scroll-restoration enum).

**Built:**
- `plateau:src/technical-configurator/seed-routing.ts` — `routingDeliveryDomain` (id `routing-delivery`): 3 axes (`addressable`, `static-host`, `first-paint`) × 4 strategies (`browser-history`, `hash-history`, `prerendered-browser`, `memory-history`), each mapping to a #1687 config bundle. Mirrors the seed-render-strategy shape.
- `plateau:src/technical-configurator/provider.ts` — registered in the `DOMAINS` list.

**Verification:** tsc clean in the configurator area (remaining tsc errors are pre-existing cross-repo `../frontierui/*` noise); full plateau-app suite green (602 tests); ad-hoc structural check confirmed the domain is registered, listed, and every strategy declares a valid value for every axis with no stray capability keys. Browser render of the running configurator could **not** be visually confirmed this session — the user's dev server (:4000) was mid-refactor and crashing on boot from an unrelated cross-repo ESM/CJS mismatch (`we:src/_data/credibilityWeighting.js`), which blocks all page mounting; not caused by this change.
