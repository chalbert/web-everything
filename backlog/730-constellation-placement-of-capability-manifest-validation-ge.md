---
type: decision
workItem: story
size: 3
parent: "170"
status: open
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
preparedDate: "2026-06-16"
relatedReport: reports/2026-06-16-730-capability-manifest-validation-generation-placement.md
tags: []
---

# Constellation placement of capability-manifest + validation-generation under the webguards/webvalidation FUI port

The #725 port's true dependency closure includes `capability-manifest/` (907 LOC, the #266 capability
spec) and `validation-generation/` (1466 LOC, contract + adapters) — both absent from FUI and unaddressed
by #649. Decide which constellation layer (`@webeverything` standard vs `@frontierui` impl) owns each
**before** #725 copies the plug, because a mechanical copy-into-FUI would silently duplicate a *standard*
into the impl repo (the npm-scope-mirrors-layer + impl-is-not-a-standard violation).

## Prepared — grounding

**No greenfield design here:** both subsystems already ship in `webeverything/`. This is a
**placement-of-shipped-code** ratification, so it skips the web survey and instead classifies the **real
import closure** (traced 2026-06-16, see `relatedReport`) against already-ratified rulings. **3 forks**,
each carrying a **bold** recommended default; Fork C was carved out of the survey (the Mode-2 `service.ts`
turned out to be the one genuinely contested file, not a mechanical row in Fork B). Grounding rulings —
all resolved: **#463** (polyglot reach: neutral-contract SoT → WE, generation adapters → FUI), **#649**
(plugs are impl, port DOWN to FUI per #606), **#091** (managed-offering constellation layering), **#266**
(capability-manifest is a code-model spec), **#504/#465** (CEL pivot = canonical representation; runtime =
swappable impl detail), **#464** (field-error = data contract).

## The axis

The concern decomposes into one axis applied per file: **does this file *define a contract* (→ WE
standard) or *implement/generate against it* (→ FUI)?** The closure spans the standard↔impl boundary, so
the answer differs by file, not by subsystem:

- `plugs/webvalidation/index.ts` is the single re-export hub; its cross-subsystem imports are the closure
  ([:82](../plugs/webvalidation/index.ts#L82) capability-manifest, [:107](../plugs/webvalidation/index.ts#L107)–[:163](../plugs/webvalidation/index.ts#L163) validation-generation).
- `capability-manifest/` is self-described as "a standalone, dependency-free model of the contract"
  ([provider.ts:1](../capability-manifest/provider.ts#L1)), structured like the `validity-merge` (#212) /
  `validator-resolution` (#214) planes — a cohesive spec, conformance tooling included.
- `validation-generation/` explicitly cleaves: "A code model, not a UX intent"
  ([provider.ts:14](../validation-generation/provider.ts#L14)) — the contract — versus the per-language
  emitters in `adapters/*` (#305–#308).
- `cel.ts` is the #465 "single canonical representation"; its runtime is "an implementation detail, not a
  contract clause" ([cel.ts:1](../validation-generation/cel.ts#L1)).
- `service.ts` mirrors the MaaS `serve()` precedent (#081) — a pure handler + wire contract
  ([service.ts:1](../validation-generation/service.ts#L1)) — the one file whose layer is judgment, not mechanics.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| A — `capability-manifest/` home | **A1: whole plane stays WE; FUI imports it from `@webeverything`** | A2: copy into FUI too | high |
| B — `validation-generation/` split | **B1: contract files (`provider`, `registry`, `fieldError`, `cel`) → WE; impl (`crossField`, `adapters/*`) → FUI** | B2: whole subsystem → FUI | high (med on `cel`/`crossField`) |
| C — Mode-2 `service.ts` home | **C1: whole file → WE (pure reference handler + wire contract); deployed host is a future plateau-app concern** | C2: port handler to FUI | med |

## Fork A — where does `capability-manifest/` live?

**Crux:** it is the #266 capability-*declaration* spec — a `{specVersion, conformanceLevel, features}`
contract + adherence model — not a plug runtime ([index.ts:1](../capability-manifest/index.ts#L1),
[provider.ts:1](../capability-manifest/provider.ts#L1)). All 6 files are spec: model (`provider`),
build-time gate (`check` #267), dev-only runtime warner (`guard` #268), report format (`report` #269),
conformance fixtures (`fixtures` #270).

- **A1 (default) — the whole plane stays a WE standard; FUI's ported `webvalidation` imports it from
  `@webeverything`.** Textbook "standard → WE" (#091). The inverse-import ban is *`@webeverything` never
  imports FUI* — the reverse (FUI consumes WE standards) is the intended direction, so the ported plug
  resolves the published package, not a copied tree. No standard leaks into the impl repo.
- A2 — copy `capability-manifest/` into FUI too. *Rejected:* puts a standard artifact in `@frontierui`
  (layer violation) and forks the spec into two trees — the exact drift #649/#170 exist to kill.

*Sub-decision (`guard.ts`):* the only "runtime" file. Keep it in WE with the plane — splitting it would
fork the #266 spec and break the validity-merge / validator-resolution precedent (those planes also carry
runtime pieces and live whole). The separate+decouple bias does not bite: these were never separate, they
are one spec.

## Fork B — where does each `validation-generation/` file live?

**Crux:** the subsystem is a mix of a neutral contract and forward/generation adapters — exactly the #463
cleave. Classify per file (LOC + role in `relatedReport`):

- **B1 (default) — split by the #463 pattern.** Contract → WE: `provider.ts` (neutral intent vocabulary +
  `CustomValidationAdapter` contract, the #304 SoT), `registry.ts` (adapter-resolution SoT), `fieldError.ts`
  (#464 RFC 9457 data contract), `cel.ts` (the #504/#465 portable pivot — the canonical representation).
  Impl → FUI (ports with the plug): `crossField.ts` (the Mode-1 forward+ingest **adapter layer** —
  `emitCrossFieldOrFallback` orchestrates `adapter.emitCrossField`, `jsonLogicToCel` normalizes into CEL),
  and `adapters/{zod,pydantic,jsonSchema,nativeHtml,index}.ts` (per-language emitters; `nativeHtml` is
  native-first-by-default but still an emitter). Every FUI file imports the WE contract → clean FUI→WE edges.
- B2 — treat the whole subsystem as impl and port it wholesale to FUI. *Rejected:* pulls the neutral
  contract (the polyglot-reach SoT) into the impl repo, foreclosing the generation-adapter story #463
  ratified. Defensible only if the contract half were vestigial — it is the bulk.

*Confidence notes:* `provider`/`registry`/`fieldError`/`adapters` are high-confidence. `cel.ts` → WE is
med-high (the reference `JS_DIALECT`/`PY_DIALECT` transpilers ride with the pivot; a future richer
transpiler could later extract to FUI — premature now). `crossField.ts` → FUI is med (alternative: keep it
beside `cel.ts` in WE as the "portable cross-field" pair built together under #504; default FUI per the
separate+decouple bias since it splits cleanly on the cel AST API).

## Fork C — where does the Mode-2 `service.ts` live?

**Crux (carved from the survey):** `service.ts` is the #309 Mode-2 generation *service* — a thin, pure,
dependency-free dispatcher over the registry, mirroring the MaaS `serve()` precedent (#081):
"defines the request/response contract and the handler; a Node or worker host wires the bytes"
([service.ts:1](../validation-generation/service.ts#L1)). It splits conceptually: the wire contract
(`ValidationServiceRequest`/`Response`/`ServedArtifact`) is unambiguously WE (the polyglot SoT #463
depends on); the **handler** (`handleValidationRequest`/`serveValidation`) is the contested part.

- **C1 (default) — whole file stays WE.** The handler is pure and host-free (no fs/net/transport), so it
  is the spec's *reference* dispatcher — the same shape as `check.ts` shipping the reference adherence
  gate. Per #091, a *deployed* validation-service is a future plateau-app concern; the standard + its
  reference handler are WE. Keeps the wire contract and its reference implementation together.
- C2 — port the handler to FUI (impl host), leaving only the contract types in WE. Cleaner "WE = types
  only" line, but forecloses the reference-in-standard symmetry (check.ts / MaaS serve), splits a 161-line
  file, and the deployed host that would justify it does not exist yet. *Rejected as default; the genuine
  judgment call — flag for the decider.*

## What ratifying this unblocks

#725 re-shapes to: copy only the **impl** dirs (`guard/`, `validity-merge/`, `validator-resolution/`, the
FUI half of `validation-generation/` = `crossField.ts` + `adapters/*`) + the two plug domains into FUI,
wire bootstrap, and have them import the WE-resident contract/spec from `@webeverything`. #725 is
`blockedBy` this decision. The defaults above (A1 + B1 + C1) are the prepared shape; a maintainer ratifies
or amends, then #725 resumes.
