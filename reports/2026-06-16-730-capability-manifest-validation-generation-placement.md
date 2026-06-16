# #730 — Constellation placement of `capability-manifest/` + `validation-generation/` (prep artifact)

**Date:** 2026-06-16 · **Decision:** [#730](../backlog/730-constellation-placement-of-capability-manifest-validation-ge.md) · **Blocks:** #725 (FUI port of `webguards`/`webvalidation`) · **Parent:** #170

This is a **placement-of-shipped-code** decision: both subsystems already exist in `webeverything/`;
the call is which constellation layer (`@webeverything` standard vs `@frontierui` impl) owns each file
before #725 copies the plug. No greenfield design → no web/prior-art survey; the grounding is the real
import closure (traced below) classified against already-ratified rulings: **#463** (polyglot reach —
neutral-contract SoT → WE, generation adapters → FUI), **#649** (plugs are impl, port DOWN to FUI),
**#091** (managed-offering constellation layering), **#266** (capability-manifest is a code-model spec,
not an `intents.json` entry), **#504/#465** (the CEL pivot is the canonical representation; the runtime
is a swappable impl detail), **#464** (the field-error shape is a data contract).

## The real import closure (traced 2026-06-16)

`plugs/webvalidation/index.ts` is the single re-export hub. Its cross-subsystem imports:

| index.ts line | imports | from |
|---|---|---|
| [:82](../plugs/webvalidation/index.ts#L82) | capability vocabulary | `capability-manifest/provider.js` |
| [:169](../plugs/webvalidation/index.ts#L169) | `guardCapability`/`guardCapabilities` | `capability-manifest/guard.js` |
| [:107](../plugs/webvalidation/index.ts#L107) | intent vocabulary + adapter contract | `validation-generation/provider.js` |
| [:122](../plugs/webvalidation/index.ts#L122) | CEL pivot | `validation-generation/cel.js` |
| [:128](../plugs/webvalidation/index.ts#L128) | cross-field layer | `validation-generation/crossField.js` |
| [:133](../plugs/webvalidation/index.ts#L133) | adapter registry | `validation-generation/registry.js` |
| [:146](../plugs/webvalidation/index.ts#L146) | field-error shape | `validation-generation/fieldError.js` |
| [:154](../plugs/webvalidation/index.ts#L154) | shipped adapters | `validation-generation/adapters/index.js` |
| [:163](../plugs/webvalidation/index.ts#L163) | Mode-2 service | `validation-generation/service.js` |

`webguards` imports only `guard/` + `guard/registry` (already in the #649/#635 audited closure — not at
issue here). Verified totals match the item: **capability-manifest = 907 LOC / 6 files**,
**validation-generation = 1466 LOC / 11 files** (956 core + 510 adapters).

## Per-file classification (the per-fork pass, applied)

**Q1 (which layer?)** is decisive for every file; the standing bias (separate + decouple) only bites on
`validation-generation`, where the contract and the emitters genuinely cleave.

### `capability-manifest/` — one cohesive **spec plane** → all WE

Self-described as "a standalone, dependency-free model of the contract" ([provider.ts:1-26](../capability-manifest/provider.ts#L1)),
structured exactly like the `validity-merge` (#212) / `validator-resolution` (#214) planes. The
conformance tooling is part of the spec, not the plug runtime:

| file | LOC | role | layer |
|---|---|---|---|
| `provider.ts` | 240 | #266 manifest model + feature vocabulary + semver | **WE** |
| `guard.ts` | 103 | #268 dev-only runtime capability warner (stripped in prod) | **WE** |
| `check.ts` | 130 | #267 build-time adherence gate | **WE** |
| `report.ts` | 173 | #269 adherence report format | **WE** |
| `fixtures.ts` | 242 | #270 conformance fixtures + shared `outOfCapability` diff | **WE** |
| `index.ts` | 19 | barrel | **WE** |

Splitting `guard.ts` (the only "runtime" file) off to FUI would fork the #266 plane and break the
validity-merge / validator-resolution precedent — the burden-of-proof-on-combining bias does **not**
apply because these were never separate; they are one spec.

**Caveat (type-only, non-blocking):** `report.ts` type-imports `../blocks/renderers/report/renderReport.js`
([report.ts:23](../capability-manifest/report.ts#L23)) for the `adherenceToReport` mapper (#712). It is
`import type` → erased at runtime, so it is **not** a runtime inverse-import. If/when blocks migrate to
FUI (#658), this stays a compile-time-only edge; flag, don't gate.

### `validation-generation/` — contract / emitter cleave (the #463 split)

| file | LOC | role | layer | confidence |
|---|---|---|---|---|
| `provider.ts` | 249 | #304 neutral intent vocabulary + `CustomValidationAdapter` contract (SoT) | **WE** | high |
| `registry.ts` | 91 | adapter-resolution SoT ("one home … cannot drift") | **WE** | high |
| `fieldError.ts` | 104 | #464 RFC 9457 field-error **data contract** | **WE** | high |
| `cel.ts` | 241 | #504/#465 portable CEL pivot — the canonical representation | **WE** | med-high |
| `service.ts` | 161 | #309 Mode-2 wire contract + pure reference handler | **WE** | **med — Fork C** |
| `crossField.ts` | 110 | Mode-1 forward (`emitCrossFieldOrFallback`) + ingest (`jsonLogicToCel`) adapter layer | **FUI** | med |
| `adapters/{zod,pydantic,jsonSchema,nativeHtml,index}.ts` | 510 | per-language forward/generation emitters (#305–#308) | **FUI** | high |

- **provider/registry/fieldError → WE:** textbook neutral-contract SoT (#463). provider.ts explicitly
  contrasts itself with impl ("A code model, not a UX intent", [provider.ts:14](../validation-generation/provider.ts#L14)).
- **cel.ts → WE:** #465 ruled CEL is "the single canonical representation a WE-compliant component
  carries"; a full CEL runtime is "a representation-neutral swap … an implementation detail, not a
  contract clause" ([cel.ts:1-13](../validation-generation/cel.ts#L1)). The pivot AST + parser is the
  contract; the tiny `JS_DIALECT`/`PY_DIALECT` reference transpilers ride with it (splitting a 241-line
  file mid-function costs more than it buys). A future richer transpiler could extract to FUI — premature now.
- **crossField.ts → FUI:** the Mode-1 forward+ingest **adapter layer** (orchestrates `adapter.emitCrossField`;
  normalizes JSONLogic into CEL). #463 routes forward/ingest adapters to FUI. It imports the WE pivot
  (cel.ts) + contract (provider.ts) → a clean FUI→WE edge. Alternative: keep with cel.ts in WE as the
  "portable cross-field" pair built together under #504 (cohesion). Default FUI per separate+decouple bias.
- **adapters/* → FUI:** unambiguous generation impl. `nativeHtml` is native-first-by-default but still an
  emitter, not a contract.

### Fork C carve — `service.ts` (Mode-2 service)

The one genuine cross-cutting tension. service.ts is the Mode-2 generation **service** (#309): a thin,
pure, dependency-free dispatcher over the registry, explicitly mirroring the MaaS `serve()` precedent
(#081) — "defines the request/response contract and the handler; a Node or worker host wires the bytes"
([service.ts:1-22](../validation-generation/service.ts#L1)). It splits conceptually:

- The **wire contract** (`ValidationServiceRequest`/`Response`/`ServedArtifact`) is the polyglot SoT
  the #463 generation-service story depends on → WE, no question.
- The **handler** (`handleValidationRequest`/`serveValidation`) is a pure reference dispatcher. Per #091
  managed-offering layering, a *deployed* validation-service is a plateau-app concern; the *standard +
  reference* is WE; *primitives* are FUI. Since the handler is pure and host-free (no fs/net/transport),
  the reference belongs with the contract in WE — the deployed host (which does not exist yet) is the
  future plateau-app/FUI piece. **Default: service.ts whole → WE.** Alternative: port the handler to FUI
  as the impl host (foreclosing the reference-in-standard symmetry with check.ts/MaaS). Medium confidence
  — this is the call the decider should actually weigh.

## Net placement

- **→ WE (standard):** all of `capability-manifest/` (6 files); `validation-generation/{provider,
  registry, fieldError, cel, service}.ts` (5 files).
- **→ FUI (impl, ports with the plug):** `validation-generation/crossField.ts` + `adapters/*` (6 files).
- **#725 re-shapes to:** copy only the FUI-bound impl into FUI, wire bootstrap, and import the
  WE-resident contract/spec from `@webeverything`. No standard artifact is duplicated into `@frontierui`.
