---
type: idea
status: open
dateOpened: "2026-06-06"
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
