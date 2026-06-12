---
type: idea
workItem: story
size: 3
parent: "005"
status: resolved
dateOpened: "2026-06-10"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
tags: []
---

# Validation capability-manifest schema + semver scheme (ratify OP-18/19/20)

The foundation slice of the validation spec-versioning meta-layer: define the capability-manifest schema {specVersion, conformanceLevel, features[], concerns{}} and the semver scheme over the validation vocabulary, ratifying OP-18 (Core/mandatory features), OP-19 (manifest exposure — lean static export) and OP-20 (withGateValidation vs native checkValidity) as it lands. Every downstream slice (build-time check, runtime guard, report format, fixtures) consumes this artifact, so it gates them all.

## Ruling (2026-06-11)

The schema + semver scheme land as a standalone, dependency-free model at
[capability-manifest/provider.ts](../capability-manifest/provider.ts) (sibling to the validity-merge
#212 and validator-resolution #214 planes), re-exported from the `webvalidation` plug. The three open
points are ratified as follows:

**OP-18 — Core feature set: RATIFIED.** The Core (mandatory-for-any-L1+-conformance) set is the four
features `control-validity` (error level), `interaction` (dirty/touched), `display` (display
decision), and `native-source` (native Constraint Validation). Everything else — `async`,
`cross-field`, `conditional`, `field-array`, `wizard`, `error-summary`, `severity`, `schema`,
`server-reconciliation` — is **optional**, declared per-implementation; its absence is reportable, never
a silent no-op. Codified as `CORE_FEATURES` and enforced by `assertCapabilityManifest` (an L1+ claim
missing any Core id throws). L0 may omit them.

**OP-19 — manifest exposure: RATIFIED as the lean static export.** An implementation publishes its
manifest as a **static export** named `manifest` (`MANIFEST_EXPORT_NAME`) holding a conformant
`CapabilityManifest` — zero runtime, statically inspectable by the build-time check (#267). Richer
channels (an element / `ElementInternals` property; an injector provider via
`InjectorRoot.getProviderOf`) stay **additive** and can layer on later without breaking the static
export: the manifest *value* is the contract, the channel is not. This matches the OP-19
recommendation (start with the static export, evolve as the pattern matures).

**OP-20 — `withGateValidation` source: RATIFIED to consume Validation's aggregate.** The Workflow
block's `withGateValidation` gate consumes Validation's merged step-aggregate (the `MergedValidity`
surface from #212/#004 OP-1), **not** native `checkValidity()` directly — so a gate reflects the full
merged validity (native + schema + async + manual), not just the native constraint pass. Native
`checkValidity()` remains the **degenerate single-source** case (it surfaces as the `native` source
inside the aggregate), so existing native-only forms keep working unchanged — backward compatibility
holds. This is a consumer-side ruling (it shapes the #268 runtime guard / the Workflow-block
integration); no code lands in this slice beyond recording that the manifest's `concerns{}` is where an
implementation declares the strategy backing each pluggable plane the gate reads.

**Spec version + intent boundary.** `VALIDATION_SPEC_VERSION = "1.0.0"` is the canonical home for the
current spec version — a `const` in the model, **not** an `intents.json` field. The capability manifest
is a conformance/protocol artifact and is kept out of the UX-only Validation Intent (per the
intent-UX-only rule), deviating from the older brief's "record it in intents.json" suggestion which
predates that principle. The semver scheme over the vocabulary: additive feature id → **minor**;
deprecate-an-id (it stays usable) → **minor**; remove a deprecated id → **major**; clarification →
**patch**. Ids are append-only (deprecate-don't-rename); `FEATURE_SINCE` records the version each
feature first appeared in, and `featureAvailableIn` / `compareSpecVersions` gate availability.

## Progress

- **Status:** resolved
- **Branch:** docs/standard-authoring-workflow
- **Done:** Authored the `capability-manifest/` standalone model (`provider.ts` — `CapabilityManifest`
  schema, `ConformanceLevel`, the Core + optional feature vocabulary, `FEATURE_SINCE`,
  `VALIDATION_SPEC_VERSION`, `MANIFEST_EXPORT_NAME`, the semver helpers, and `isCapabilityManifest` /
  `assertCapabilityManifest` guards) + `index.ts` barrel + `__tests__/provider.test.ts`. Re-exported the
  vocabulary from `plugs/webvalidation/index.ts`. Ratified OP-18/19/20 above.
- **Next:** Downstream slices consume the model — #267 (build-time `check:validation-adherence`), #268
  (runtime dev-mode guard), #269 (adherence report format), #270 (partial-impl fixtures). All four are
  now unblocked.
- **Notes:** No `intents.json` / `protocols.json` change — the manifest is intentionally a code-model
  artifact, not a UX-intent field.
