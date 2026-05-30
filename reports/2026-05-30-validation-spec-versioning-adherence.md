# Side-Project Brief — Spec Versioning & Adherence Reporting

**Date**: 2026-05-30
**Status**: Brief for a future agent / workstream. Self-contained; depends on the Feature & Capability
model in the validation interop design.
**Parent**: `reports/2026-05-30-form-validation-standard-assessment.md` (§4 capability model).

---

## Why

The validation standard is an **interop contract** with two orthogonal axes:
- **Conformance tiers** (depth): L0 Intent-aware → L1 State & event → L2 Shape & concern.
- **Features** (breadth): optional, trait-like capability bundles (`async`, `cross-field`, `conditional`,
  `field-array`, `wizard`, `error-summary`, `severity`, `schema`, `server-reconciliation`).

**Partial compliance is first-class** — an app that needs no async validation installs an implementation
that omits it. That is only safe if (a) implementations *declare* what they support, and (b)
out-of-capability usage is **detectable and reported**, never a silent no-op. This brief defines that
meta-layer. It does **not** build the validation engine.

## Goal

Let any validation implementation declare *which spec version + conformance tier + features* it provides,
and make non-conformant / out-of-capability usage detectable and reportable.

## Deliverables

1. **Spec version scheme** — semver over the vocabulary: additive atoms/features → minor; deprecation
   then removal → major. Encode the *deprecate-don't-rename* rule (stable ids are append-only). Record the
   current spec version (e.g. `validation.specVersion` in `intents.json`).
2. **Capability manifest schema** — formalize `{ specVersion, conformanceLevel, features[], concerns{} }`
   and define how an implementation publishes it. Options to evaluate: a static export; a property on the
   element / `ElementInternals`; an injector provider resolved via `InjectorRoot.getProviderOf(...)`.
   (Resolves plan open point OP-19.)
3. **Adherence detection** —
   - (a) **Build-time** `check:validation-adherence` (sibling to `check:standards`) that diffs a declared
     manifest against the atoms/features actually *used* in markup/config.
   - (b) **Runtime dev-mode guard** that warns/throws on out-of-capability usage: an atom from an absent
     feature, an event not emitted for the claimed tier, an unsupported intent value.
4. **Adherence report format** — human + machine readable: tier achieved, features present/absent, gaps,
   spec-version compatibility.
5. **Test fixtures** — a deliberately *partial* implementation proving gaps are reported clearly.

## Inputs (from the validation design)

- **Feature ids** `validation.feature.*` and the proposed **Core** set (control validity (error) +
  interaction + display + native source).
- **Canonical hand-off shapes** (`ValueSnapshot`, `SourceResult`, `MergedValidity`, `InteractionState`,
  `DisplayDecision`).
- **Stable-id scheme** (`validation.` dot-paths, append-only).
- **Conformance tiers** (L0/L1/L2) and the observable surfaces each requires.

## Open points it must resolve

- **OP-18** — the Core (mandatory-for-any-conformance) feature set.
- **OP-19** — where/how the capability manifest is published.

## Next Steps

### Implementation Roadmap

1. **Design capability manifest schema** (blocking). Answer OP-19:
   - **Option A:** Static export from implementation (e.g., `MyValidator.manifest = { specVersion, level, features, concerns }`)
   - **Option B:** Property on element or `ElementInternals` (read by form/framework)
   - **Option C:** Provider resolved via injector (`InjectorRoot.getProviderOf(..., 'validation:manifest')`)
   
   **Recommendation:** Start with Option A (simplest). Evolve to C as pattern matures.

2. **Define Core feature set** (OP-18). Confirm:
   - **Minimum required:** control validity (error level only) + interaction state (dirty/touched) + display decision + native Constraint Validation source
   - **Everything else optional:** async, cross-field, schema, server-reconciliation, etc.

3. **Build `check:validation-adherence` tool:**
   - Scan markup and config for validation atoms used (states, events, features)
   - Load declared manifest from implementations
   - Diff: used atoms vs declared features
   - Report: gaps (using feature X but not declared), obsolete declarations (declared but unused)
   - Error on undeclared usage; warning on unused declarations

4. **Runtime dev-mode guard:**
   - Detect out-of-capability usage at validation time
   - On `validate-start` for async without `async` feature: warn/throw
   - On `value-input` incrementing version: check if Loader has version support
   - Hook into existing validation event system; no overhead in production

5. **Test fixtures:**
   - L0-only impl: no events, just intent rendering (validates that tool catches missing states/events)
   - L1-partial impl: events present but no async (validates that tool catches missing async feature)
   - L1-full impl with error summary but not cross-field (validates selective feature detection)

### Success Criteria

- ✅ Capability manifest schema documented and examples in three formats (A/B/C)
- ✅ Core feature set explicitly defined and justified
- ✅ `npm run check:validation-adherence` catches undeclared feature usage in test fixtures
- ✅ Runtime guard throws helpful diagnostic: "Validation async used but not declared in manifest; add `validation.feature.async` to fixes"
- ✅ Spec version (e.g., `validation.specVersion = "1.0.0"`) recorded in intents.json

### Effort Estimate

- Schema + Core definition: 4–6 hours (design, documentation, examples)
- `check:validation-adherence` tool: 6–8 hours (scanning, diffing, reporting)
- Runtime guard: 2–3 hours (hook into validation events)
- Test fixtures: 3–4 hours (deliberate partial impls, coverage verification)

**Total:** ~15–20 hours. Can be split across sessions.

## Open Points

- **OP-18:** Which features are Core (mandatory)? Current proposal: control validity (error), interaction, display, native source. Awaits confirmation.
- **OP-19:** Manifest publication method (static export vs element property vs injector)? Recommended: start with static export.
- **OP-20:** Should `withGateValidation` (Workflow block) consume Validation's step aggregate instead of native `checkValidity()`? Backward compatibility needed.
- **OP-21:** Input `status` boundary — redefine as rendering Validation's DisplayDecision? **[SETTLED: Yes, completed in glossary]**

## Out of scope

The validation engine itself; the UX vocabulary. This is strictly the *declare + verify capabilities*
meta-layer, and it should generalize beyond validation (the same manifest/detection pattern applies to any
WE standard with optional features).
