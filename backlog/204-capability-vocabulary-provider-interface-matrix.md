---
type: idea
workItem: story
size: 8
parent: "203"
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-08"
dateResolved: "2026-06-08"
graduatedTo: src/_data/capabilities.json
tags: [capability-provider, capability-vocabulary, web-features, baseline, matrix, native-first, resolution, foundation]
relatedReport: reports/2026-06-02-native-platform-substrate.md
crossRef: { url: /backlog/203-capability-provider-resolution-architecture/, label: "Foundation story of epic #203 (D3′ + D4′ default)" }
---

# Capability vocabulary + provider interface + static build-matrix

The keystone of the [#203](/backlog/203-capability-provider-resolution-architecture/) capability
provider. Per the **D3′** and **D4′** rulings, this story lands the vocabulary, the provider
interface, and the default (build-venue) provider implementation. Resolver (#205), adapter table
(#206), strictness/cascade (#207), and runtime/edge impls (#208) all build on what this defines.

## Scope

- **Capability vocabulary (D3′)** — a **separate lower capability layer**, *not* the intent
  vocabulary. Capability IDs map ~1:1 to platform features and **borrow Baseline / `web-features`
  IDs** (e.g. `popover`, `anchor-positioning`, `customizable-select`, `showpicker`, `user-pseudos`,
  `dialog-closedby`, `field-sizing`, `cross-root-aria`). The vocabulary must be **URL-serializable,
  stable, compact** — the edge venue carries IDs in the component URL (`/c/droplist@1?caps=…`). Ship
  it as a registered JSON registry (the canonical list of capability IDs + human label + the
  `web-features`/Baseline key it tracks).
- **Intent → required-capabilities mapping** — intents declare which capability IDs they require
  (authored mapping). An intent like `rich-option-content` expands to its backing capability IDs. Keep
  the mapping data-driven (registry), not hard-coded in the resolver.
- **Provider interface (D4′)** — `tier(impl, capabilityId) → 'native-ok' | 'polyfill-ok' |
  'capability-hard'` (the 3-state from the substrate report's polyfillability tiers). Single interface
  with swappable impls; this story ships the **static build-matrix** impl as the default (paired with
  the default `build` venue). Runtime + edge impls are #208.
- **Static build-matrix** — the substrate report's support table
  ([reports/2026-06-02-native-platform-substrate.md](../reports/2026-06-02-native-platform-substrate.md))
  as data: per (impl × capabilityId) the 3-state tier. This JSON *is* the default provider impl and
  subsumes the old "where does the target matrix live" question.
- **DoD** — `check:standards` green; the droplist family's required intents resolve their capability
  IDs through the matrix; a demo/fixture showing a capability ID tiered native-ok on one impl and
  polyfill-ok/capability-hard on another (e.g. `customizable-select` capability-hard on the FACE impl,
  native-ok on a `base-select` impl).

## Decided foundation (from #203 — do not relitigate)

3-state tier per capability; native-first = eligible → lightest → native-tiebreak; venue is a
configurable dimension defaulting to `build`; binding = explicit-via-base-extension.

## Progress

- **Status:** resolved (2026-06-08)
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - **Capability vocabulary (D3′)** — `src/_data/capabilities.json`: 14 capabilities, ids borrow Baseline / `web-features` keys (`popover`, `anchor-positioning`, `customizable-select`, `showpicker`, `user-pseudos`, `dialog-closedby`, `field-sizing`, `cross-root-aria`, …), each with label, `webFeaturesKey`, baseline year, polyfill class, summary.
  - **Static build-matrix (D4′)** — `src/_data/capabilityMatrix.json`: the substrate report's support table as data, the default (build-venue) provider impl. Two impls (`face`, `base-select`) × all 14 capabilities → 3-state tier, a complete grid.
  - **Intent → required-capabilities mapping** — `requiresCapabilities: [...]` added to 8 intents (anchor, modal, input, validation, focus-delegation, focus-containment, action, selection).
  - **Provider interface + default impl** — `capabilities/provider.ts` (`CapabilityProvider.tier(impl, capId) → Tier`, `StaticMatrixProvider`, `resolveIntent`, `intentMapFromIntents`) + `capabilities/index.ts` (`createDefaultProvider()` wiring the shipped JSON). 10 vitest tests incl. the DoD differential.
  - **Validator** — `check:standards` section 6c-bis: vocabulary required fields + enums, complete-grid matrix check (tier() is total), every matrix/intent cap-id reference resolves.
  - **Catalog + demo** — `/capabilities/` page renders the matrix (the DoD demo) + intent→caps list; nav link added; authoring note + taxonomy row in `docs/agent/design-first.md`; Vite proxy allowlist updated.
- **Next:** resolver (#205), adapter table (#206), strictness/cascade (#207), runtime/edge impls (#208) build on this. Follow-ups filed: #210 (proxy allowlist drift-guard), #211 (per-capability detail pages).
- **Notes:** Gates green — 1635 vitest pass, `check:standards` 0 errors (14 capabilities), eleventy build clean, `/capabilities/` 200 on :8080. `customizable-select` + `cross-root-aria` are the differential cells (capability-hard on `face`, native-ok on `base-select`). The `capabilities/` module sits outside the coverage gate (like `src/`) but inside the vitest run via an added include glob.

**Graduated to** `src/_data/capabilities.json` — also minted capabilityMatrix.json + the capabilities/ provider module.
