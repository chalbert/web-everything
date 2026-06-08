---
type: idea
workItem: story
size: 5
parent: "097"
status: resolved
dateOpened: "2026-06-06"
dateStarted: "2026-06-08"
dateResolved: "2026-06-08"
tags: [monetization, business-model, upgrader, codemod, ai-agnostic, provider-registry, migration, standard-compliance, self-run-tool, webadapters]
relatedProject: webadapters
crossRef: { url: /backlog/089-monetization-product-ideas/, label: "Product ideas (#089)" }
---

# AI-based upgrader tools — bring existing code up, in place

A family of **self-run AI-based tools that take *existing* code and upgrade it**,
as a revenue product under the solo-founder tier-1 shape (runs on the customer's
dev/CI, no service to operate). Sibling of the mockup→code tool
([#086](/backlog/086-mockup-to-standard-code-tool/)) and the framework-migration
tooling (idea 3 in [#089](/backlog/089-monetization-product-ideas/)): mockup→code
*creates* from a design, migration moves *between* frameworks, and upgraders move
code *forward in place*.

## What it upgrades

- **Legacy / framework code → standard-compliant** — lift an existing component or
  app onto Web Everything entities (declarative components, intents, the right
  adapter form), not a one-off rewrite.
- **Across standard / dependency versions** — apply breaking-change codemods when a
  protocol, adapter, or provider contract evolves; "upgrade to the new version"
  without hand-editing every call site.
- **Conformance gap-closing** — take code the verification tool (#089 idea 1)
  flagged as non-conformant and propose the fix.

## Why it fits the solo-founder lens

- **Tier 1 self-run tool** — runs on the customer's machine/CI; no uptime or
  instant-support obligation on us.
- **AI is a swappable provider, BYO key** — same registry shape as #086
  (`customMockupAnalyzerRegistry`), MaaS's `CustomCompilerRegistry`, and the
  render-strategy registry. The customer supplies the model key, so we carry **no
  model-hosting cost**. The fast-moving model frontier is config, not architecture.
- **Verified output** — round-trip / `check:standards` the upgraded code before
  offering it; a generator is only trustworthy if its output is checked, not just
  produced (mirrors #086's quality gate).

## Open follow-ons

- Decide whether upgraders are a *mode* of the same engine as #086 (shared neutral
  structure + generator) or a distinct tool — likely shared core, different input
  adapter (existing code instead of a mockup).
- Version-upgrade codemods need the standard to publish machine-readable
  change/migration descriptors per release (ties to spec versioning, #005).
- Revenue: licensed self-run tool (per-seat / per-repo), BYO-AI.

## MVP scope — independently greenlit

This is **being worked** as one of the parallel product candidates under the
emergent MVP strategy ([#097](/backlog/097-roadmap-to-mvp/)) — it is **not** gated
on a "pick one product" decision (that framing was dropped). Ship a focused MVP
first: the shared engine (input adapter → neutral structure → verify-gated
generation) with **one source path** (e.g. one legacy/framework input), then grow
breadth from there. Lots of room to improve post-MVP.

## Progress

- **Status:** resolved — MVP shipped: shared engine (analyze → generate → verify-gate), reference analyzer (one source path), playground green (5/5), 16 unit tests, full suite + check:standards + build all green.
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - Engine `blocks/renderers/upgrader/upgraderEngine.ts` — `ComponentIR` neutral structure, `CustomAnalyzerRegistry` provider seam, `generateComponentSource` (→ declarative `<component>`), `verifyUpgrade` gate (parses + fidelity round-trip + intent conformance), `upgrade()` orchestrator (never throws; gates on verify).
  - Reference analyzer `blocks/renderers/upgrader/analyzers/legacyWebComponent.ts` — deterministic, no-key, lifts vanilla web components (one source path); rejects out-of-subset input rather than guessing.
  - Shared fixtures `blocks/renderers/upgrader/__fixtures__/upgrader-cases.ts` (demo + suite, no drift); unit suite `blocks/__tests__/unit/renderers/upgrader.test.ts` (16 tests).
  - Playground `demos/code-upgrader-demo.{html,ts,css}` + `src/_data/demos.json` entry — full pipeline per card, verify badge, live element, form toggle reusing MaaS `serve()`. Verified live via Playwright: `playgroundReady`, 5/5, elements registered, no console errors.
- **Leftovers captured:** [#188](/backlog/188-upgrader-byo-ai-model-analyzer/) BYO-AI model provider, [#189](/backlog/189-upgrader-intent-inference/) intent inference, [#190](/backlog/190-upgrader-additional-input-adapters/) more input adapters, [#191](/backlog/191-upgrader-version-migration-codemods/) version-migration codemods.
- **Notes — design decisions (POC):**
  - **One source path:** legacy vanilla Web Component (`class … extends HTMLElement` + `customElements.define`) → neutral IR. A deterministic *reference* analyzer (no model key) handles a structured subset; the registry is the swap-in point where a BYO-AI provider drops in for messier input.
  - **Neutral structure (IR):** `{ name, shadow, template, intents?, notes? }` — expressed in the standard's own `<component>` vocabulary, so generation is a lookup not a translation. This is the analyzer↔generator contract.
  - **Generator reuses the existing core:** IR → declarative `<component>` source, which feeds the existing MaaS `serve()` to emit any form (wc-class/jsx/…). No parallel generator (same anti-drift guarantee as #081).
  - **Verify gate (the moat):** generated source must (1) re-`parseDefinition` cleanly, (2) round-trip — extracted template equals the analyzed IR template (no drift), (3) any referenced intents resolve. Un-verified output is returned for inspection but **not offered** (`offered:false`).
  - **Provider seam mirrors `CustomCompilerRegistry`:** `CustomAnalyzerRegistry` — core imports no analyzer; `registerReferenceAnalyzers()` injects the reference provider (a real model provider is just another `register()`).
