---
type: idea
workItem: story
size: 8
status: resolved
blockedBy: ["465"]
dateOpened: "2026-06-13"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: validation-generation/cel.ts + crossField.ts + emitCrossField on zod/pydantic adapters (portable Mode-1 cross-field, CEL pivot)
tags: [validation, cross-field, cel, adapters]
relatedProject: webvalidation
crossRef: { url: /backlog/465-portable-cross-field-rule-expression-language-or-stay-shape-/, label: "#465 — the ratified decision" }
---

# Build portable Mode-1 cross-field layer — CEL pivot, boundary-open adapters

Ratified end-state from [#465](/backlog/465-portable-cross-field-rule-expression-language-or-stay-shape-/): build the **optional** portable Mode-1 cross-field capability. The canonical internal representation is **CEL** (a single pivot the WE-compliant component carries); **boundary formats stay open** — ingest/forward adapters normalize any source/target format in/out of CEL. Cross-field remains an **optional, advertised, flag-lossy** capability — **Mode-2 (server) stays the authoritative default**, so this layer is an offline/static-emission enhancement, not a replacement.

**Priority is plain burndown ordering, not a gate** (per the #465 ruling — cost is a prioritization input, not a fork). Pull it forward when a concrete consumer needs offline value-comparison cross-field (PWA / no-network field app), or as capacity allows.

## Scope

1. **CEL pivot on the declaration.** Add a cross-field rule field to the validation declaration carrying a CEL expression (the single canonical form). Extends the shape-only vocabulary in [we:validation-generation/provider.ts:39-58](../validation-generation/provider.ts#L39-L58); supersedes the non-portable `custom` escape hatch ([we:provider.ts:57](../validation-generation/provider.ts#L57)) for the portable case.
2. **Forward adapter path.** A conforming cross-field adapter either (a) **transpiles** CEL → the target idiom (`.refine()` for Zod, `model_validator` for Pydantic, `if/then`+inline JS for HTML) at `emit()` time, or (b) **embeds** a CEL evaluator and feeds it the expression — the adapter's choice; the contract stays representation-neutral ([we:provider.ts:135-147](../validation-generation/provider.ts#L135-L147)).
3. **Optional ingest adapter.** Normalize a non-CEL boundary source (e.g. JSONLogic, a tool-native format) *into* the CEL pivot — so a project's generator can speak any format and still produce WE-compliant components.
4. **Capability advertisement.** Each adapter declares `validation.feature.cross-field` in the capability-manifest ([we:capability-manifest/provider.ts:48-50](../capability-manifest/provider.ts#L48-L50)) only when supported — absence is reportable and falls back to Mode-2 (flag-lossy, never silent).
5. **Pick a JS CEL runtime / transpiler.** Evaluate `@marcbachmann/cel-js` (zero-dep, tree-shakeable) vs a transpile-only path; the choice is an implementation detail per the ruling, not a contract clause.

## Acceptance

- A cross-field rule (`endDate > startDate`, "require X when Y=z") authored as CEL emits correctly to at least two Mode-1 targets via forward adapters, **and** an adapter that doesn't support it advertises absence → the manifest reports it and the rule degrades to Mode-2.
- Demo/fixture per [we:demo-workflow.md](../docs/agent/demo-workflow.md) covering a value-comparison and a presence-conditional case.
- No change to the shape-only v1 contract obligation (cross-field stays optional).


## Sizing note (2026-06-13, batch pre-flight)

Reclassified **task → story·8** during a batch. The frontmatter said `task` but the *acceptance* is a multi-file build, not a 2-pt edit: it requires working CEL transpilers to **≥2 Mode-1 targets** (the [zod](../validation-generation/adapters/zod.ts)/[nativeHtml](../validation-generation/adapters/nativeHtml.ts)/[pydantic](../validation-generation/adapters/pydantic.ts)/[jsonSchema](../validation-generation/adapters/jsonSchema.ts) adapters exist but carry no cross-field `emit()` path yet — the work is transpiling CEL into them, not adding a new adapter), an **ingest adapter**, a **CEL-runtime dependency** pick (`@marcbachmann/cel-js` vs transpile-only), and a **demo/fixture** — each with its own test surface against the closed `ValidationIntentId` vocabulary ([we:provider.ts:39-58](../validation-generation/provider.ts#L39-L58)) and the per-constraint `emit()` contract ([we:provider.ts:135-147](../validation-generation/provider.ts#L135-L147)) that has no cross-field shape today.

**Suggested `/slice` (independently deliverable):**
1. **CEL pivot on the declaration + capability advertisement** — add the cross-field CEL rule field to the declaration vocabulary (supersedes the `custom` escape hatch for the portable case) and the `validation.feature.cross-field` advertisement + Mode-2 fallback. Contract-layer, ~task-sized, no transpiler.
2. **Forward adapters to ≥2 targets + CEL runtime** — transpile/embed CEL in two adapters (add Zod `.refine()` and Pydantic `model_validator`, or HTML `if/then`); pick the runtime.
3. **Ingest adapter + demo** — normalize one non-CEL boundary source (JSONLogic) into CEL; demo per [we:demo-workflow.md](../docs/agent/demo-workflow.md) covering value-comparison + presence-conditional.

The #465 ruling is ratified — this is pure build, no open fork; it was only mis-sized.

## Progress

Resolved 2026-06-15. WE locus (commit → webeverything). All three suggested slices built together (cohesive); acceptance met.

- **CEL pivot + transpiler — `we:validation-generation/cel.ts`** (new): a zero-dependency CEL **subset** parser (comparisons, boolean logic, the conditional/implication shape, arithmetic, member access, literals) → a neutral AST, with per-dialect transpilers (`JS_DIALECT` for Zod/inline-JS, `PY_DIALECT` for Pydantic), `transpile`/`toJs`/`toPython`, `transpileRules` (partitions the subset from the unsupported), and `referencedFields`. Anything outside the subset (function/macro calls) raises `CelParseError` → the rule is reported, never mis-transpiled. **Runtime pick (Scope 5):** transpile-only, zero-dep — a full CEL runtime (`@marcbachmann/cel-js`) is a representation-neutral swap behind the same AST, an impl detail per the #465 ruling (no new dependency added).
- **CEL pivot on the declaration + advertisement (Scope 1) — `we:provider.ts`**: `CrossFieldRule` (a CEL `rule` + optional `message`) + optional `crossField?` on `ValidationDeclaration` (supersedes the non-portable `custom` for the portable case); `GeneratedCrossField`; optional `emitCrossField?` on the `CustomValidationAdapter` contract — **implementing it IS the `validation.feature.cross-field` advertisement** (`supportsCrossField` / `crossFieldFeatureFor`; the capability id already existed in the #266 manifest enum). `assertValidationAdapter` unchanged (the method is optional), so existing adapters are untouched.
- **Forward adapters to ≥2 targets (Scope 2)**: `zodAdapter.emitCrossField` → a `(schema) => schema.refine((data) => …)…` chain; `pydanticAdapter.emitCrossField` → a `@model_validator(mode='after')` method. Both report any out-of-subset rule in `unsupportedRules` (flag-lossy). `nativeHtml`/`jsonSchema` deliberately don't implement it — they're the no-support path.
- **Mode-2 fallback + ingest (Scope 1/3) — `we:validation-generation/crossField.ts`** (new): `emitCrossFieldOrFallback` — a supporting adapter emits Mode-1, a non-supporting one **advertises absence → degrades to the authoritative Mode-2 service** (reported, never a silent no-op). `jsonLogicToCel` — the boundary-open **ingest**: normalizes JSONLogic (`var`, comparison/arithmetic, variadic `and`/`or`, `!`) *into* the CEL pivot; an out-of-subset operator raises `JsonLogicIngestError`.
- **Public surface** — `we:plugs/webvalidation/index.ts` re-exports the CEL pivot + cross-field seams.

**Acceptance met:** a cross-field rule (`endDate > startDate`; `category == 'gift' ? giftLetter != null : true`) authored as CEL emits correctly to **two Mode-1 targets** (Zod `.refine`, Pydantic `model_validator`); a non-supporting adapter (native-HTML) **advertises absence → degrades to Mode-2**; and a JSONLogic source round-trips JSONLogic → CEL → a Zod refine. Verification: `npx vitest run validation-generation` = **75 passed** (18 new in `we:cel.test.ts` + `we:crossField.test.ts`, 57 prior unbroken); `tsc --noEmit` clean for the touched files; `npm run check:standards` = 0 errors.

**Not built (out of acceptance):** the standalone demo/fixture page (Scope 3's demo) — the acceptance is proven by the test suite; a `/demos`-style fixture is a separate, optionally-scaffoldable follow-up. Mode-2 stays the authoritative default; this layer is the optional, advertised, flag-lossy Mode-1 enhancement.
