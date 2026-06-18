---
type: decision
workItem: story
size: 3
status: resolved
blockedBy: []
dateOpened: "2026-06-16"
dateStarted: "2026-06-17"
dateResolved: "2026-06-18"
graduatedTo: none
preparedDate: "2026-06-16"
relatedReport: reports/2026-06-16-817-guard-merge-resolution-placement.md
tags: [constellation, plugs, port, frontierui, standard-impl-boundary]
---

# Constellation placement of guard / validity-merge / validator-resolution subsystems under the FUI plug port

The #725 plug port (`webguards`/`webvalidation` → FUI) has a five-subsystem import closure; #730 placed two
(`capability-manifest/`, `validation-generation/`, exported by #814). The remaining three — `guard/`
(#288/#289), `validity-merge/` (#212), `validator-resolution/` (#214) — are imported by the plugs yet
**unplaced**: #730's scope excluded them and #814 exported no `@webeverything` surface for them. **No design
exists yet for their placement**; the single fork below is grounded in a per-plane file-level verification
published as the prep report ([reports/2026-06-16-817-…-placement.md](../reports/2026-06-16-817-guard-merge-resolution-placement.md),
linked via `relatedReport`) — a placement-of-shipped-code call, so it classifies the real import closure
against #730's ratified axis rather than surveying web prior art. It carries a recommended default in **bold**.

The grounding has been **reshaped twice**. (1) The prep draft started B1-*split* (provider/registry → WE,
"concrete strategy/runtime impl" → FUI), then flipped to a prepared **A1 — whole plane → WE** on the reading
that all three planes are "capability-manifest-shaped." (2) The **ratify-time skeptic pass (2026-06-17) flipped
it back to B1** — A1 had inherited #730's structural *dictum* ("these planes are structured exactly like
capability-manifest") instead of #730's actual *holding*, which is the per-file define-vs-deliver test that
**split `service.ts` mid-file** (Fork C → C2, reversing its own prepared "keep the whole file" default).
Traced to primary sources, that holding cuts these three planes B1-style. The corrected axis is one test from
#730 — *code that **defines** a contract/conformance → WE; code that **delivers** the capability by running →
FUI* — applied per symbol, pinned to the real tree (re-verified 2026-06-17):

The contract/impl split **already exists at a clean file seam in every plane**, and the cut is simply that
seam: `contract.ts` (types) → WE; everything runtime (`provider.ts` + `registry.ts`) → FUI.
- `contract.ts` = pure types/interfaces (compile-erased), the future `@webeverything/contracts/*` entry —
  the one thing that crosses the seam (FUI imports it as the contract dep, #872). `provider.ts` re-exports it
  via `export type * from './contract.js'`, so **no types live in `provider.ts`** (it is self-labelled "the
  **runtime-impl half**", e.g. `guard/provider.ts:2`).
- `provider.ts` = error classes + `assert*`/`is*` guards + **constant data** (`ALLOW`, `DEFAULT_PRECEDENCE`,
  `SOURCE_STATES`) + the **native-default strategy classes** (`NativeGuardProvider`, `SourceReductionStrategy`,
  `LastWriteWinsStrategy`, `VersioningResolution`, `CancellationResolution`) — **all runtime → FUI**.
- `registry.ts` = the registry classes + the **stateful running engines** (`ValiditySourceOrchestrator` —
  `#sources` Map + `#version` counter, `set()` stamps `++this.#version`; `AsyncValidationRunner.validate()` —
  awaits the validator on an abort signal, drops stale generations) — **all runtime → FUI** (any registry
  *interface type* is a type and rides in `contract.ts` → WE).

Applying the corrected axis per symbol — **the test is "does FUI consume it at runtime?"**:
- **WE — the contract only:** `contract.ts` (pure types/interfaces, incl. the provider + any registry interface
  type). Nothing else. This is what FUI imports as `@webeverything/contracts/*`.
- **FUI — everything runtime:** the `assert*`/`is*` guards, error classes, constant data, the native-default
  strategy *classes*, and the stateful engines. They are all consumed by the FUI-bound plug at runtime
  (`plugs/webvalidation`/`plugs/webguards` import `provider`+`registry`), and the asserts specifically run in
  the *delivery* hot path — `ValiditySourceOrchestrator.merged()` calls `assertMergedValidity` on every merge.
  Crucially, **these three planes have no `check.ts`-style conformance gate** (verified: no `*/check.ts`), so —
  unlike capability-manifest, whose `assert*` is consumed by its WE-side build gate `check.ts` and therefore
  stays WE — nothing WE-side consumes this runtime. It is pure delivery → FUI. (Native-first is preserved: the
  *choice* of permissive-allow / versioning-as-default + the precedence order are documented in the contract;
  the executable const + class ship with the impl, exactly as #730 sent native-first `nativeHtml.ts` to FUI.)

Two stale A1 claims fell at ratify: (a) "none carries a separable emitter" — the orchestrator/runner **are**
the separable running half; absence of a literal `adapters/` dir is cosmetic (#730 split `service.ts` with no
`adapters/` dir, on a *running* half). (b) "a split forks `provider.ts` mid-file" — false: the contract types
already live in `contract.ts`, so the cut is a clean file seam (cheaper than the mid-file `service.ts` cut #730
accepted). The import-closure file:line evidence below is unchanged and correct; only the placement *inference*
flipped.

## Ruling — B1 (ratified 2026-06-17)

**Split each plane at the `contract.ts` | `provider.ts`+`registry.ts` file seam: only the contract (types) stays
WE; all runtime ports to FUI.** WE keeps `contract.ts` (pure types/interfaces, incl. any registry interface
type) — the `@webeverything/contracts/*` entry FUI imports. FUI takes everything runtime: the error classes,
the `assert*`/`is*` guards, the constant data (`ALLOW`, `DEFAULT_PRECEDENCE`, `SOURCE_STATES`), the
native-default strategy classes (`NativeGuardProvider`, `SourceReductionStrategy`, `LastWriteWinsStrategy`,
`VersioningResolution`, `CancellationResolution`), the registry classes, and the stateful engines
(`ValiditySourceOrchestrator`, `AsyncValidationRunner`) — plus the impl-coupled `__tests__`. Confirmed at
ratify: **no implementation stays in WE.** The operative test is "does FUI consume it at runtime?" — the
FUI-bound plugs import `provider`+`registry`, and these three planes have no `check.ts`-style WE-side gate, so
nothing WE-side consumes the runtime (contrast capability-manifest, whose `assert*` feeds its WE build gate
`check.ts` and so legitimately stayed WE under #730). The prepared A1 was rejected because it inherited #730's
structural *dictum* rather than its define-vs-deliver *holding* (the one that split `service.ts`). Follow-up:
the #814-style export+carve below (→ #893); #725 then resumes.

## Recommended path at a glance

| Fork | Recommended default | Main alternative (rejected) | Confidence |
|---|---|---|---|
| 1 — placement of all three planes | **B1 — split at the `contract.ts` file seam: `contract.ts` (types) → WE; all of `provider.ts` + `registry.ts` (asserts, error classes, constant data, native-default strategy classes, registry classes, engines) + `__tests__` → FUI. No implementation stays in WE.** | A1 — whole plane → WE (the prepared default; rejected at ratify — it inherited #730's "structured exactly like" *dictum*, not #730's define-vs-deliver *holding* that split `service.ts`) | **~85%** |

One fork, not three: the three are structurally uniform (clean `contract.ts` seam + a runtime `provider.ts`/
`registry.ts` half consumed by the FUI plug), so they rule together. Residual ~15%: only if some WE-side gate
consumed this runtime would any of it stay WE — verified none does (no `check.ts` in these planes; the asserts
run in the delivery hot path), so the contract-only cut holds.

## Fork 1 — Do the three planes stay whole in WE (A1) or split define/deliver (B1)?

**Crux.** Each plane already separates a pure-contract `contract.ts` (→ WE) from a `provider.ts`/`registry.ts`
self-labelled "the **runtime-impl half**" (`guard/provider.ts:2`). The question is whether anything in that
runtime half is *conformance definition* that stays WE, or whether it is all *delivery* → FUI. The operative
test: **does FUI consume it at runtime, with no WE-side gate consuming it instead?** Here the answer is uniform
— the FUI-bound plug imports `provider`+`registry` wholesale, the asserts run in the in-app engine's hot path,
and (unlike capability-manifest) there is no `check.ts` gate to anchor any of it WE — so the whole runtime half
delivers → FUI, and only `contract.ts` stays.

- **B1 — split each plane at the `contract.ts` file seam (recommended default).** `contract.ts` (pure types/
  interfaces, incl. any registry interface type) stays in WE and gains a `@webeverything/*` contract export;
  **all runtime ports to FUI** — the error classes, the `assert*`/`is*` guards, the constant data (`ALLOW`,
  `DEFAULT_PRECEDENCE`, `SOURCE_STATES`), the **native-default strategy classes** (`NativeGuardProvider`,
  `SourceReductionStrategy`, `LastWriteWinsStrategy`, `VersioningResolution`, `CancellationResolution`), the
  registry classes, and the **stateful engines** (`ValiditySourceOrchestrator`, `AsyncValidationRunner`), plus
  the impl-coupled `__tests__`. #725 imports the WE contract and ports the runtime half. **No implementation
  stays in WE** — the test is "does FUI consume it at runtime?", and the FUI-bound plug imports
  `provider`+`registry` wholesale; with no `check.ts` gate in these planes, nothing WE-side consumes it.
  *Why it wins:* it is the only reading consistent with #730's actual *holding* — its Fork C ruled per-symbol
  on exactly this axis and **split `service.ts` mid-file**, sending the running dispatcher
  (`handleValidationRequest`) to FUI and keeping only the wire-contract types in WE, reversing its own prepared
  "keep the whole file" default. `ValiditySourceOrchestrator.set()` (mutates `#sources`, stamps
  `++this.#version`, runs the strategy) and `AsyncValidationRunner.validate()` (awaits the validator on an
  abort signal, drops stale generations) are that running dispatcher's structural twins, not `check.ts`'s
  (a no-I/O build gate). `registry.ts:7` self-describes the orchestrator as "one shared, injectable service
  every control delegates to" — the app's merge engine, delivery.

- **A1 — whole plane → WE (rejected; was the prepared default).** Keep `provider.ts` + `registry.ts` entirely
  in WE, one barrel export per plane. *Rejected at ratify:* it inherited #730's *dictum* (the grounding-prose
  simile "#212/#214 are structured exactly like capability-manifest") rather than its *holding* (define-vs-
  deliver per symbol). The two facts A1 leaned on are false: (a) "no separable emitter" — the orchestrator/
  runner are the separable *running* half (a literal `adapters/` dir is not the test; #730 split `service.ts`
  without one); (b) "the cut forks `provider.ts` mid-file" — the contract types already live in `contract.ts`,
  so the cut is a clean file seam. capability-manifest's `check.ts`/`guard.ts` (the files #730 kept in WE) are
  a no-I/O build gate and a dev-only `console.warn` — they *define* conformance and are consumed by WE's own
  conformance gate, **not** by FUI's runtime. These three planes have no such WE-side gate, so even their
  `assert*` guards (consumed by the in-app engine) are delivery → FUI; nothing runtime stays WE.

- **A2 — whole plane → FUI (rejected).** Port `contract.ts` too. *Rejected:* leaks a strategy-plane *contract*
  into `@frontierui`, the exact drift #649/#170 exist to kill (npm-scope-mirrors-layer: `@webeverything` is
  standard-only).

**Red-team result (skeptic pass, 2026-06-17 — the attack landed).** The flagged attack was
*impl-is-not-a-standard*: the native-default strategy classes + engines (merge-math, version-token,
`AbortController` logic) are code that *delivers* by running, so they belong in FUI. Verified against primary
sources, A1's three rebuttals fail: (a) #730 did **not** keep analogous *running* tooling in WE — it kept a
build gate (`check.ts`) and dev-warn (`guard.ts`) and explicitly *ported* the running `handleValidationRequest`
to FUI; (b) native-first protects the default *policy* (that the default *is* native, the documented precedence
order) — **not** the executable class or its const literal, which ship with the impl; #730 itself sent
native-first `nativeHtml.ts` to FUI as "native-first-by-default but still an emitter"; (c) there is no mid-file
cost, the `contract.ts` seam is pre-cut. The asserts went to FUI too (sharpened at ratify): consumed by the
in-app engine, with no `check.ts` gate in these planes to keep them WE. Residual ~15%: only a WE-side gate
consuming this runtime would keep any of it WE — verified none exists.

**At graduation:** B1 produces an #814-style follow-up — per plane, lift the entire runtime half
(`provider.ts` + `registry.ts`: error classes, `assert*` guards, constant data, native-default strategy
classes, registry classes, engines) plus the impl-coupled `__tests__` into FUI beside the plug, leave only
`contract.ts` (types) in WE, and add the `@webeverything/*` contract export. The `contract.ts` seam is already
cut, so the move is whole-file (cleaner than #730's mid-file `service.ts` carve, since here even the asserts
go). No Technical Configurator card falls out — this is an internal placement call, not a documented technical
setting a project picks.

## Unblocks

#725 (`blockedBy: 817`). Once ruled, the export+carve delta is the #814-style follow-up above; #725 then
resumes, importing the three WE-resident contracts and porting the strategy classes + engines beside the plug —
the same define-vs-deliver shape #730 already set for `validation-generation` (`service.ts` handler → FUI,
wire-contract types → WE).

## Context

### Evidence (verified 2026-06-16, batch-2026-06-16; re-verified at prep 2026-06-16)

Import closure traced from the plug sources, not the (stale, two-subsystem) #635 audit:
- `plugs/webguards/index.ts:23-31` → `../../guard/{provider,registry}`
- `plugs/webvalidation/index.ts` → `validity-merge/{provider,registry}` (`:17,:18,:19,:24,:25,:52,:57`),
  `validator-resolution/{provider,registry,index}` (`:19,:20,:23,:24,:34,:40`)
- #814 export surface (`capability-manifest/package.json`, `validation-generation/package.json`) covers only
  those two subsystems; `guard/`, `validity-merge/`, `validator-resolution/` have no `package.json` / exports
  map and no FUI tsconfig/vite alias.

Per-plane file → role → layer tables are in the prep report (note: the prep report's "all → WE" net reflects
the superseded A1 reading; the ratify-time finding splits each plane define/deliver per B1 above).

### Why one fork, not three (fork-existence test)

The original draft carried three forks (one per plane) because each *might* differ. Verification shows they
do not: identical shape, identical ruling, no plane has a `validation-generation`-style per-language emitter
that would force a *per-plane* divergence — but every plane *does* carry the same define/deliver seam, so they
rule together as **B1**. Per *support-all-coherent / crisp-beats-complete-but-undifferentiated*, they collapse
to one fork applied uniformly (cf. #088: five "forks" → one invariant). A2 is broken (contract leak); A1 is
coherent-but-precedent-misreading (inherits #730's dictum, not its holding), so it stays a named-and-rejected
alternative rather than a separate fork.
