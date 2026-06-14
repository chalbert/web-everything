---
type: idea
workItem: story
size: 8
status: open
blockedBy: ["465"]
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
tags: [validation, cross-field, cel, adapters]
relatedProject: webvalidation
crossRef: { url: /backlog/465-portable-cross-field-rule-expression-language-or-stay-shape-/, label: "#465 — the ratified decision" }
---

# Build portable Mode-1 cross-field layer — CEL pivot, boundary-open adapters

Ratified end-state from [#465](/backlog/465-portable-cross-field-rule-expression-language-or-stay-shape-/): build the **optional** portable Mode-1 cross-field capability. The canonical internal representation is **CEL** (a single pivot the WE-compliant component carries); **boundary formats stay open** — ingest/forward adapters normalize any source/target format in/out of CEL. Cross-field remains an **optional, advertised, flag-lossy** capability — **Mode-2 (server) stays the authoritative default**, so this layer is an offline/static-emission enhancement, not a replacement.

**Priority is plain burndown ordering, not a gate** (per the #465 ruling — cost is a prioritization input, not a fork). Pull it forward when a concrete consumer needs offline value-comparison cross-field (PWA / no-network field app), or as capacity allows.

## Scope

1. **CEL pivot on the declaration.** Add a cross-field rule field to the validation declaration carrying a CEL expression (the single canonical form). Extends the shape-only vocabulary in [validation-generation/provider.ts:39-58](../validation-generation/provider.ts#L39-L58); supersedes the non-portable `custom` escape hatch ([provider.ts:57](../validation-generation/provider.ts#L57)) for the portable case.
2. **Forward adapter path.** A conforming cross-field adapter either (a) **transpiles** CEL → the target idiom (`.refine()` for Zod, `model_validator` for Pydantic, `if/then`+inline JS for HTML) at `emit()` time, or (b) **embeds** a CEL evaluator and feeds it the expression — the adapter's choice; the contract stays representation-neutral ([provider.ts:135-147](../validation-generation/provider.ts#L135-L147)).
3. **Optional ingest adapter.** Normalize a non-CEL boundary source (e.g. JSONLogic, a tool-native format) *into* the CEL pivot — so a project's generator can speak any format and still produce WE-compliant components.
4. **Capability advertisement.** Each adapter declares `validation.feature.cross-field` in the capability-manifest ([capability-manifest/provider.ts:48-50](../capability-manifest/provider.ts#L48-L50)) only when supported — absence is reportable and falls back to Mode-2 (flag-lossy, never silent).
5. **Pick a JS CEL runtime / transpiler.** Evaluate `@marcbachmann/cel-js` (zero-dep, tree-shakeable) vs a transpile-only path; the choice is an implementation detail per the ruling, not a contract clause.

## Acceptance

- A cross-field rule (`endDate > startDate`, "require X when Y=z") authored as CEL emits correctly to at least two Mode-1 targets via forward adapters, **and** an adapter that doesn't support it advertises absence → the manifest reports it and the rule degrades to Mode-2.
- Demo/fixture per [demo-workflow.md](../docs/agent/demo-workflow.md) covering a value-comparison and a presence-conditional case.
- No change to the shape-only v1 contract obligation (cross-field stays optional).


## Sizing note (2026-06-13, batch pre-flight)

Reclassified **task → story·8** during a batch. The frontmatter said `task` but the *acceptance* is a multi-file build, not a 2-pt edit: it requires working CEL transpilers to **≥2 Mode-1 targets** (the [zod](../validation-generation/adapters/zod.ts)/[nativeHtml](../validation-generation/adapters/nativeHtml.ts)/[pydantic](../validation-generation/adapters/pydantic.ts)/[jsonSchema](../validation-generation/adapters/jsonSchema.ts) adapters exist but carry no cross-field `emit()` path yet — the work is transpiling CEL into them, not adding a new adapter), an **ingest adapter**, a **CEL-runtime dependency** pick (`@marcbachmann/cel-js` vs transpile-only), and a **demo/fixture** — each with its own test surface against the closed `ValidationIntentId` vocabulary ([provider.ts:39-58](../validation-generation/provider.ts#L39-L58)) and the per-constraint `emit()` contract ([provider.ts:135-147](../validation-generation/provider.ts#L135-L147)) that has no cross-field shape today.

**Suggested `/slice` (independently deliverable):**
1. **CEL pivot on the declaration + capability advertisement** — add the cross-field CEL rule field to the declaration vocabulary (supersedes the `custom` escape hatch for the portable case) and the `validation.feature.cross-field` advertisement + Mode-2 fallback. Contract-layer, ~task-sized, no transpiler.
2. **Forward adapters to ≥2 targets + CEL runtime** — transpile/embed CEL in two adapters (add Zod `.refine()` and Pydantic `model_validator`, or HTML `if/then`); pick the runtime.
3. **Ingest adapter + demo** — normalize one non-CEL boundary source (JSONLogic) into CEL; demo per [demo-workflow.md](../docs/agent/demo-workflow.md) covering value-comparison + presence-conditional.

The #465 ruling is ratified — this is pure build, no open fork; it was only mis-sized.
