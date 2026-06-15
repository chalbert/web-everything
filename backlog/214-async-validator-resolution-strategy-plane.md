---
type: issue
workItem: story
size: 5
status: resolved
dateOpened: '2026-06-08'
dateStarted: '2026-06-09'
dateResolved: '2026-06-09'
graduatedTo: "plug:customvalidatorresolutionregistry"
tags:
  - validation
  - registry
  - async
  - validity-model
  - native-first
  - interop
relatedReport: reports/2026-05-30-form-validation-standard-assessment.md
relatedProject: webvalidation
parent: "004"
---

# Async validator resolution as a swappable strategy plane (`CustomValidatorResolution`)

The named **sibling** of #212. #212's source-reduction treats `async` as one source
that reports `pending{version}` then resolves — but *how* an in-flight async check is
resolved when input keeps changing (cancel the stale request? version it and drop late
answers? debounce?) is its **own** swappable concern. The
[form-validation assessment report](../reports/2026-05-30-form-validation-standard-assessment.md)
specs this as `CustomValidatorResolution` (cancellation vs versioning resolvers); it
has no plug + provider interface yet.

**Build:**
- Mirror #212's pattern: a `CustomValidatorResolutionRegistry` + `CustomValidatorResolution`
  contract plug pair (data entries + plug-descriptions), and a standalone TS model under
  e.g. `validator-resolution/` (sibling to `validity-merge/`).
- Provider interface: `startValidation(fieldId, input) → handle`,
  `shouldApplyResult(handle, result) → boolean`, `onInputChange(fieldId, newInput)`.
- Two registered strategies: **versioning** (native-first default — stamp a generation
  token, drop answers older than the current input; pairs with #212's auto-stamped
  `version`) and **cancellation** (abort the in-flight request via `AbortController`).
- Custom strategies first-class via registration; the only constraint is they feed the
  same `pending{version}` → `valid|invalid` source result #212 consumes.

Sibling to #212; both are the DI-replaceable validation concerns under #004. See #004
OP-1/OP-11 for the surface-vs-computation split.

## Progress

- **Status:** resolved (2026-06-09)
- **Branch:** docs/standard-authoring-workflow
- **Done:** Shipped the `CustomValidatorResolutionRegistry` + `CustomValidatorResolution`
  plug pair (`src/_data/plugs.json` + two plug-descriptions) and the standalone TS
  strategy plane in `validator-resolution/` (mirroring `validity-merge/`): surface types
  (`ValidationHandle`/`AsyncResult`/`ResolvedSource`) with `isResolvedSource`/
  `assertResolvedSource` guards enforcing the cross-plane contract (results must feed the
  same `pending{version}` → `valid|invalid` `SourceResult` #212 consumes — type-imported
  from `validity-merge/provider`); `VersioningResolution` (native-first default — per-field
  generation token, drop superseded answers) and `CancellationResolution` (`AbortController`
  teardown); the registry + the `AsyncValidationRunner` (opens a generation, emits `pending`,
  applies the terminal answer only when `shouldApplyResult`); default wiring in `index.ts`.
  21 vitest specs (wired `validator-resolution/**` into vitest include). `check:standards`
  0 errors (re-ran `gen:inventory`); both plug pages render 200.
- **Next:** runtime plug + async-field element integration → #224; live stale-answer-race
  demo → #225.
- **Notes:** Provider interface follows the item spec verbatim — `startValidation(fieldId,
  input) → handle`, `shouldApplyResult(handle, result)`, `onInputChange(fieldId, newInput)`.
  The handle's `version` IS #212's `pending{version}` token, so the two planes share one
  stable id. Registry named `CustomValidatorResolutionRegistry` (the `Custom*Registry` form
  the check:standards linter expects); contract base `CustomValidatorResolution` per the
  item. Mirrors #212's `validity-merge/` structure exactly (provider/registry/index +
  `__tests__`).

**Graduated to** `plug:customvalidatorresolutionregistry` — CustomValidatorResolution(Registry) plug pair (standalone TS model in validator-resolution/).
