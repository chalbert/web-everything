---
kind: story
size: 3
parent: "099"
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
tags: []
---

# Component deprecation lifecycle — flag → new-version → legacy-lib, support-preserving adapters

Explicit deprecation lifecycle pattern: flag a component → ship new version → preserve legacy via adapters/legacy-lib, v2 components. Versioning identity is already covered (#088, #102, #191, #389/#390); only the deprecation lifecycle pattern is unwritten. Companion to #102 (changelog manifest) + #191 (codemods). From #111 triage.

## Progress (2026-06-13) — resolved

Wrote the pattern as a **Component Deprecation Lifecycle** section on the webmanifests project page ([we:src/_includes/project-webmanifests.njk](../src/_includes/project-webmanifests.njk) `#pattern-deprecation-lifecycle`), the home where the companion `changelog-manifest` protocol (#102) is already anchored — so the pattern sits beside the standards it composes rather than minting a new schema (bias-toward-separation). Surfaces at `/projects/webmanifests/`.

The four stages, each mapped to an existing standard:

1. **Flag** — a `changelog-manifest` entry with a `deprecated` marker: `deprecatedSince`, a replacement pointer, an announced removal milestone; a non-fatal use-site warning. *Flag, don't break* — the component analogue of the research-freshness stale-while-shown grace (#477).
2. **New version** — ship the replacement as a distinct content-addressed version (#088/#389), never an in-place mutation; the manifest links old → new.
3. **Legacy preservation** — across the grace window the old component keeps working via a **legacy bundle** (deprecated impl moved to a `legacy` module) **or** a **support-preserving adapter** (shim mapping old contract → new impl). Codemods (#191) are the automated migration path; the legacy route the manual/graceful one.
4. **Removal** — only after the announced milestone and once the migration is available; removal is itself a breaking `changelog-manifest` entry flowing through #101 auto-update classification.

Invariant: **a consumer is never broken by surprise** — *deprecate-don't-delete*, the component-level analogue of the standard's *deprecate-don't-rename* identity rule. Grounded in design-system prior art (Shopify Polaris & GitHub Primer component lifecycles, JSDoc `@deprecated`/`@deprecatedSince`, the web platform's deprecate-then-remove cadence). Page builds clean; gate green.
