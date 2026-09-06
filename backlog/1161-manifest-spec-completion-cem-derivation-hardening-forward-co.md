---
kind: story
size: 3
parent: "1038"
status: open
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
tags: []
relatedProject: webmanifests
---

# Manifest Spec completion — CEM-derivation hardening + forward-compat for richer fields

WE-layer Manifest Spec (webmanifests) completeness: harden the CEM->manifest derivation (we:blocks/renderers/module-service/generation/generate.ts + we:blocks/renderers/module-service/definitionRegistry.ts) and add forward-compat tolerance so richer declared fields are carried, not dropped. Child of the #1038 webdocs spec-surface epic. Demo: derivation unit/golden tests green.

## Resolved (batch-2026-06-19) — forward-compat manifest derivation in `deliverModule`

**Grounding correction.** The epic/body cited `we:blocks/renderers/module-service/generation/generate.ts` (the serve-path generation-adapter engine, #507) and `we:blocks/renderers/module-service/definitionRegistry.ts` (the id→`<component>` resolver) — neither derives a manifest. The real CEM→manifest derivation is **`we:blocks/renderers/module-service/productionDelivery.ts`** `deliverModule()`, which derives a publish-ready package manifest (`PackageManifest`) from a served component. Re-homed the work there (a stale-ref remediation, not a design call — same module-service subsystem).

**Hardening shipped.** `PackageManifest` was a fixed 6-field shape, so any richer declared field was silently dropped. Added forward-compat tolerance:
- `ProductionDeliveryOptions.manifest?: Record<string, unknown>` — richer declared fields ride through into the emitted package manifest. The canonical link is `customElements` (the CEM pointer to a custom-elements manifest, so a consumer discovers the element's declared surface); any future field (`description`/`keywords`/…) is tolerated, not enumerated.
- The six DERIVED fields (`name`/`version`/`type`/`main`/`exports`/`sideEffects`) stay authoritative — a declared override is dropped and **reported in `diagnostics`** (never silent, matching the file's lossy/diagnostic discipline). Spread is richer-first, core-last.
- `PackageManifest` gains an open index signature so a new field propagates with no schema change here.

Tests: `we:blocks/__tests__/unit/renderers/productionDelivery.test.ts` (+2 — carry richer CEM-pointer/description/keywords; drop+report a colliding derived-field override). The existing exact-shape `toEqual` test still passes (no-manifest case is byte-identical). `npx tsc --noEmit` clean for the changed file; `check:standards` green.

## Reopened 2026-09-06 — the promised coverage does not exist today

Delivered, then deleted, and never relocated. Verified during the 2026-09-06 resolved-card sweep:

- WE commit `629230ce` implemented exactly what the closeout claims — `ProductionDeliveryOptions.manifest`,
  an open index signature on `PackageManifest`, and `DERIVED_MANIFEST_FIELDS` with drop-and-report
  diagnostics — plus `we:blocks/__tests__/unit/renderers/productionDelivery.test.ts`.
- Both were deleted a week later by **#1730** (`f0ee0584`) per #1282 / #1771, and neither was relocated to FUI.
- A repo-wide grep for `productionDelivery`, `deliverModule` and `PackageManifest` across all three
  checkouts returns **zero**.

So the acceptance clause "derivation unit/golden tests green" has no artifact. The same dangling reference
also breaks **#312**, which cites it. Reopened so the port-or-retire call is made explicitly — see #x0swhio.
