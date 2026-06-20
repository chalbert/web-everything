---
kind: story
size: 3
parent: "085"
status: resolved
blockedBy: ["004", "266"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: validation-generation/provider.ts
tags: []
---

# Validation-generation foundation — intent enumeration + CustomValidationAdapterRegistry

Foundation slice (#085-A) of the validation-generation protocol: enumerate the validation intents (the neutral vocabulary of what can be constrained) and define the CustomValidationAdapterRegistry that per-language adapters register into. Gates every adapter slice and the Mode-2 service slice. Inherits #085's blockers narrowed to the validity model (#004) + the capability manifest (#266, not all of #005).

## Progress

**Resolved 2026-06-11.** Shipped the standalone `validation-generation/` model (dependency-free, the
`validity-merge` / `validator-resolution` / `capability-manifest` precedent):

- **`we:validation-generation/provider.ts`** — the neutral intent vocabulary `ValidationIntentId` (13 ids:
  `required`, `type`, `min-length`, `max-length`, `pattern`, `format`, `min`, `max`, `step`,
  `min-items`, `max-items`, `enum`, `custom`) + `VALIDATION_INTENTS` + `VALIDATION_INTENT_SINCE` +
  `VALIDATION_GENERATION_SPEC_VERSION`; the `CustomValidationAdapter` contract (a `key`/`format` and the
  `intents[]` it **declares + exposes** compliance with, plus `emit(declaration) → GeneratedValidation`);
  the `ValidationConstraint` / `ValidationDeclaration` input shapes and the `GeneratedValidation` artifact
  (carries `unsupported[]` — lossy-is-visible, never a silent drop); guards `isValidationIntentId` /
  `isValidationAdapter` / `assertValidationAdapter` + the `unsupportedIntents` helper.
- **`we:validation-generation/registry.ts`** — the `CustomValidationAdapterRegistry` standalone table
  (`localName` + `define(asDefault?)` / `get` / `has` / `keys` / `resolve` / `defaultKey`, mirroring the
  standalone `we:validity-merge/registry.ts`) with `adaptersFor(intent)` for the #085 "which adapters comply
  with this intent" query, `UnknownValidationAdapterError`, and `createValidationAdapterRegistry()`.
  Adapters are contract-checked at registration.
- Re-exported the whole vocabulary from **`we:plugs/webvalidation/index.ts`**; registered a vitest glob for
  `validation-generation/**/__tests__/**`.

**Design rulings.**

- **Code model, not a UX intent.** The generation vocabulary is deliberately *not* an `we:intents.json`
  entry — it follows the #266 precedent (the capability manifest is a code-model conformance artifact,
  kept out of the UX-only Validation Intent per the intent-UX-only rule). Distinct from the UX-facing
  Validation Intent (`we:src/_data/intents.json`, which owns context/level/execution/visibility).
- **No runtime injector plug (by design).** Generation runs at build / service time (Mode 1 emit, Mode 2
  service #309), not per-control-instance, so the registry is a standalone table re-exported from the
  plug — not a `CustomRegistry`-extending element like `customValidityMerge` (#215). Documented in the
  provider header.
- **Foundation ships no concrete adapter.** `createValidationAdapterRegistry()` is empty by design — the
  native-HTML (#305), Zod (#306), Pydantic (#307), JSON-Schema (#308) and Mode-2 service (#309) slices,
  all `blockedBy` this one, each `define()` their adapter.

**Gate.** 16 new tests (`we:validation-generation/__tests__/provider.test.ts` + `we:registry.test.ts`) green;
full `webvalidation` plug suite 62 green (re-export intact); new files `tsc --noEmit` clean (the only tsc
errors are pre-existing `src/cases/webinjectors/*` snippets); `check:standards` **0 errors**.

**Graduated to** `validation-generation/` — we:provider.ts + we:registry.ts.
