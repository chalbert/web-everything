# #903 — Runtime placement for guard / validity-merge / validator-resolution, re-checked against #817 B1's "no WE-side consumer" premise

**Date:** 2026-06-18  ·  **Type:** placement-of-shipped-code re-ratification (reconsiders #817 B1 for three planes)  ·  **Prep for decision #903**

## Why this report exists

#893 (the #817 B1 export+carve) was claimed in batch-2026-06-17 and pre-flight found #817 B1's stated
premise false. #817 B1 ruled the runtime half of `guard/`, `validity-merge/`, `validator-resolution/`
ports to FUI, justified by: *"these three planes have no `we:check.ts`-style WE-side gate, so nothing
WE-side consumes the runtime"* (817 file:58-62, 80-82). But WE's own plugs import the **runtime values**
of all three planes. This report traces every consumer of that runtime against the real tree to decide
whether the false premise overturns the **placement** (B → keep runtime WE) or only the **execution**
(A → placement stands, the carve must co-execute with the plug port).

No web prior-art survey applies — this is internal constellation placement of already-shipped code,
the same category as #730 / #817 (both used a session `relatedReport`, not a `/research/` topic). The
"research" here is the consumer trace below.

## The premise is true as a fact: WE plugs import runtime *values* (not just types)

Verified 2026-06-18. These are class / function / const imports, not `import type`:

- `we:plugs/webguards/index.ts:26-31` → `NativeGuardProvider`, `GuardDecisionError`, `assertGuardDecision`,
  `ALLOW` (from `we:guard/provider.ts`); `:31` → `CustomGuardRegistry`, `UnknownGuardProviderError` (from
  `we:guard/registry.ts`).
- `we:plugs/webguards/CustomGuardRegistry.ts:16-24` → `assertGuardDecision`, `NativeGuardProvider`,
  `UnknownGuardProviderError`.
- `we:plugs/webvalidation/CustomValidityMergeRegistry.ts:15-19` → `SourceReductionStrategy`,
  `LastWriteWinsStrategy`, `UnknownStrategyError`.
- `we:plugs/webvalidation/CustomValidatorResolutionRegistry.ts:17-20` → `VersioningResolution`,
  `CancellationResolution`, `UnknownResolutionError`.
- `we:plugs/webvalidation/AsyncValidatorField.ts:23-24` → `AsyncValidationRunner`,
  `ValiditySourceOrchestrator`; `we:ValidityMergeField.ts:24` → `ValiditySourceOrchestrator`;
  `we:plugs/webvalidation/index.ts:28-57` re-exports the whole runtime vocabulary of all three planes.
- `we:plugs/bootstrap.ts:37-38` → `createDefaultValidityMergeRegistry`, `CustomGuardRegistry`,
  `createDefaultGuardRegistry` (wiring).

So #817 B1's literal sentence "nothing WE-side consumes the runtime" is **wrong as written**.

## But every value-consumer is FUI-bound — there is no *staying* WE consumer

The complete set of WE-side value-consumers of the three planes' runtime (traced
`grep` over `--include=*.ts`, excluding the planes themselves and `_site/`):

1. `plugs/webguards/` + `plugs/webvalidation/` — the plug **implementations**.
2. `we:plugs/bootstrap.ts` — plug **wiring**.
3. `guard/__tests__/`, `validity-merge/__tests__/`, `validator-resolution/__tests__/` — impl-coupled tests.
4. The demos (`we:demos/validity-merge-demo.ts`, `we:demos/validator-resolution-demo.ts`) — and these import
   the **plug** (`we:/plugs/webvalidation/index.ts`), *not* the runtime planes directly; one is `import type`
   only.

**No WE conformance gate, no WE standard artifact, and no other WE subsystem consumes the runtime
values.** And consumers 1–4 are *all* slated to leave WE:
- Plugs are implementation owned by FUI (#606), and #649 (resolved) ruled `webguards`/`webvalidation`
  port DOWN to FUI; #725 is that port (open, the active plan).
- #817 already routes the impl-coupled `__tests__` to FUI with the runtime.
- Per the docs-rendering-boundary ruling (FUI owns impl *and* its rendered display incl. demos), the
  plug demos ride to FUI with the plug.

## The capability-manifest contrast that settles A vs B

#730 kept `capability-manifest/` whole in WE. The reason was **not** "some WE file imports it" — it was
that its `assert*` is consumed by a WE artifact that **defines conformance and stays in WE**:
`we:capability-manifest/check.ts:72` calls `assertCapabilityManifest` inside the build-time conformance
gate (#267). `we:check.ts` is executable *spec*, not delivery, so #730 kept it (and the assert it needs)
WE.

The three planes here fail that test on **both** prongs:
- **What consumes the runtime is not conformance definition.** A plug is *delivery* (impl, #606) — the
  opposite of a `we:check.ts` build gate. `we:guard/provider.ts:2` self-labels "the **runtime-impl half**";
  `we:guard/registry.ts:7` calls the orchestrator "one shared, injectable service every region delegates
  to" — an app engine, not a spec.
- **The consumer does not stay.** we:check.ts stays WE forever; the plug is ratified to leave (#649/#725).

So the #730 test that anchored capability-manifest in WE does **not** anchor these three. #817 B1's
*placement* (runtime → FUI) is correct; its *premise wording* should have read "no WE-side artifact
**that stays in WE** consumes the runtime." The plug is a consumer that **leaves**, not one that stays.

## The real defect the false premise exposes: a dependency-ordering inversion

The placement is fine; the **execution plan is broken**. Current edges:
- `#893` (carve runtime → FUI) `blockedBy: [903]`
- `#725` (port plugs → FUI) `blockedBy: [..., 817, 893]`

That orders #893 *before* #725. But #893 as a standalone step (move runtime to FUI, leave the plugs in
WE) breaks the WE build the instant it lands: WE plugs would import FUI runtime, and **WE may not import
FUI** (npm-scope-mirrors-layer, #239). There is no coherent *separate* ordering either:
- Plugs-first is impossible too — a FUI-resident plug importing WE runtime *values* would force
  `@webeverything` to export runtime, violating "@webeverything = standard artifacts only" (#239).

The only WE→FUI-safe execution is **one atomic relocation**: plugs + `we:provider.ts` + `we:registry.ts` +
impl-coupled `__tests__` (+ plug demos) leave WE together, leaving only `we:contract.ts` behind. So #893's
runtime carve must **fold into / co-land with** #725, and the `#893-blocks-#725` edge is backwards.

## Conclusion fed into the decision

- **Fork 1 (placement): keep #817 B1 — runtime → FUI.** The false premise is a wording bug, not a
  placement error: every WE-side consumer is the FUI-bound plug, not a staying conformance gate. B
  (keep runtime WE) is rejected — it reverses #817 B1 on a we:check.ts↔plug mis-analogy and would force
  either a #649 reversal or a runtime leak into `@webeverything`. C (byte-replicate) is the dual-SoT
  drift #170/#694/#649 exist to kill, with no FUI plug yet to hold the copy.
- **Supported by default (execution): the carve is atomic with the plug port.** Fold #893 into #725 (or
  hard co-land), and drop the `#893-blocks-#725` inversion. Not a fork — no coherent alternative
  ordering exists (WE↔FUI import rules forbid every staged variant).

Confidence on Fork 1: **~82%.** Residual: only a future reversal of #649 (webguards/webvalidation stay
WE by design) would make B live — out of #903's scope and a separate, larger call.
