---
type: decision
workItem: story
size: 3
parent: "170"
status: open
dateOpened: "2026-06-16"
tags: []
---

# Constellation placement of capability-manifest + validation-generation under the webguards/webvalidation FUI port

The #725 port's true dependency closure includes capability-manifest (907 LOC, a #266 capability spec) and validation-generation (1466 LOC, contract+adapters) — both absent from FUI and unaddressed by #649; decide which layer owns each before #725 copies them.

## Why this surfaced (mid-#725, batch-2026-06-15)

#649 ruled `webguards`/`webvalidation` are plug **implementations** and port DOWN to FUI (#606), and the
#635 audit sized that port as *"~1900 LOC, 18 files, 3 new FUI top-level dirs (`guard/`,
`validity-merge/`, `validator-resolution/`)"*. Tracing the actual import closure while working #725, that
is roughly **half** the real graph. The two domains also hard-depend on **two large subsystems FUI lacks
and the audit never named**:

- **`capability-manifest/`** — 6 files, **907 LOC**. `plugs/webvalidation/index.ts` imports it at
  [:82](../plugs/webvalidation/index.ts#L82) (`../../capability-manifest/provider.js`) and re-exports
  `guardCapability`/`guardCapabilities` at [:169](../plugs/webvalidation/index.ts#L169)
  (`../../capability-manifest/guard.js`). This is the **#266 capability-declaration spec** (the
  `{specVersion, conformanceLevel, features}` manifest contract + adherence model #267–#270), not a plug
  runtime.
- **`validation-generation/`** — 11 files, **1466 LOC** (`provider.ts`, `registry.ts`, `service.ts`,
  `cel.ts`, `crossField.ts`, `fieldError.ts` + `adapters/{zod,pydantic,jsonSchema,nativeHtml,index}.ts`).
  `plugs/webvalidation/*.ts` imports `service`/`cel`/`crossField`/`registry`/`fieldError`/`adapters` from
  it (`../../validation-generation/*`). A mix of a **neutral contract** (provider/registry) and
  **forward/generation adapters** (zod/pydantic/jsonSchema/nativeHtml).

So the closure is ~**3,400 LOC across 5 absent subsystems**, not 1,900 / 3 dirs — and crucially it spans
the **standard ↔ implementation boundary**, which a mechanical copy-into-FUI would silently violate. Per
the npm-scope-mirrors-layer rule (`@webeverything` = standard artifacts only; `@frontierui` = impl) and
the impl-is-not-a-standard rule, a *spec* must not be duplicated into the impl repo. That is the call
#725 cannot make for itself.

## Fork A — where does `capability-manifest/` live?

- **A1 (default) — stays a WE standard; FUI's `webvalidation` imports it from `@webeverything`.** It is a
  capability *contract* (#266), the textbook "standard → WE" artifact (#091 managed-offering constellation
  layering). FUI already consumes WE standards (the inverse-import
  ban is *`@webeverything` never imports FUI*, not the reverse), so the ported `webvalidation` resolves it
  from the published package, not a copied tree. No standard leaks into the impl repo.
- A2 — copy `capability-manifest/` into FUI too. Simplest mechanically (port closes in one repo), but puts
  a standard artifact in `@frontierui` — a layer violation, and forks the spec into two trees (the very
  drift #649/#170 exist to kill). Rejected unless A1 proves unbuildable.

## Fork B — where does `validation-generation/` live?

- **B1 (default) — split by the #463 pattern: neutral contract → WE, generation adapters → FUI.**
  `provider.ts`/`registry.ts` (the contract + the resolution SoT) are standard artifacts and stay WE;
  the `adapters/{zod,pydantic,jsonSchema,nativeHtml}` are forward/generation impl
  (the polyglot-reach forward-adapters rule, #463) and port to FUI with the plug. `service`/`cel`/`crossField`/
  `fieldError` are classified per file (runtime impl → FUI; pure contract → WE) when B is ratified.
- B2 — treat the whole subsystem as impl and port it wholesale to FUI. Cleaner dependency graph for the
  plug, but pulls the neutral contract (the polyglot-reach SoT) into the impl repo, foreclosing the
  generation-adapter story #463 ratified. Defensible only if the contract half turns out to be vestigial.

## What ratifying this unblocks

#725 re-shapes to: copy only the **impl** dirs (`guard/`, `validity-merge/`, `validator-resolution/`, the
FUI half of `validation-generation/`) + the two plug domains into FUI, wire bootstrap, and have them import
the WE-resident contract/spec from `@webeverything`. #725 is `blockedBy` this decision. The recommendation
above is the prepared shape (A1 + B1); a maintainer ratifies or amends before #725 resumes.
