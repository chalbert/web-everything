# Backlog split analysis — #1294 (re-run: carve the next subsystem after webpolicy)

**Date:** 2026-06-27
**Focus:** `/slice 1294` now that the **webpolicy** cascade (W1–W4: #1799–#1802) is fully resolved — webpolicy reached the #1282 end-state (impl→FUI, contract+vectors→WE, conformance visible via the plateau iframe). #1294 is a roadmap epic over ~10 WE-resident logic reference runtimes; webpolicy proved the cascade, so this run carves the **next** ready subsystem.
**Verdict:** **PARTIAL SPLIT.** Carve **webcompliance** (the next ready facts→verdict engine) into a 5-story cascade. The remaining subsystems stay could-not-split: the non-facts→verdict engines (process, webtraits) need a per-subsystem conformance-shape read; the non-engine planes (reliability, intl, analytics, webtheme) are gated on a **deferred decision that was never filed** — this run files it; webcases is mixed conformance-tooling behind the #1566 carve-out.

## Investigation (against the real tree)

The remaining WE-resident runtime subsystems, classified by the conformance shape the proven cascade requires (a **synchronous facts→verdict** binding, #1789/#1790):

| Subsystem | WE runtime files | Shape | Ready to carve now? |
|---|---|---|---|
| **webcompliance** | `we:webcompliance/gate.ts` + `we:webcompliance/waiver.ts` + `we:webcompliance/audit.ts` (5 tests) | **facts→verdict** — `runGate(policy, signals) → GateResult{blocked}`; `applyWaivers` (now injected); `auditToReport` (at injected). All deps injected, dependency-free. | ✅ **yes** — clean facts→verdict engine, mirrors webpolicy. |
| process | `we:process/driver.ts` (+ contract/provider/registry) | engine, but **workflow step-graph** (runnable-frontier + autonomy ceiling), not facts→verdict | ❌ conformance-shape unverified |
| webtraits | `we:webtraits/intentProfileResolver.ts` | engine, but **build-time resolver** (intent profile → trait set), not facts→verdict | ❌ conformance-shape unverified |
| reliability | `we:reliability/provider.ts` + `we:reliability/registry.ts` (+ contract) | **provider-seam plane** (CustomXRegistry strategy), not facts→verdict | ❌ non-engine, gated |
| intl | `we:intl/provider.ts` + `we:intl/registry.ts` (+ contract) | provider-seam **formatting**, not facts→verdict | ❌ non-engine, gated |
| analytics | `we:analytics/provider.ts` (+ contract) | provider-seam **aggregation**, not facts→verdict | ❌ non-engine, gated |
| webtheme | `we:webtheme/compile.ts` + `we:webtheme/tokens.ts` + `we:webtheme/schemes.ts` (…) | **token projection** (DTCG→CSS, #404), not facts→verdict | ❌ non-engine, gated |
| webcases | `we:webcases/driftCheck.ts` + `we:webcases/requirementValidator.ts` + `we:webcases/caseToVector.ts` (…) | **mixed** — some is conformance *tooling* that checks WE's own artifacts (may stay WE per #1566), some is delivery runtime | ❌ needs per-file placement read |

webpolicy's relocation already proved every piece of foundation the cascade needs: the synchronous binding (#1789), the plateau runner (#1790), the **generic `EMBED_SUITES` registry + plateau-origin conformance iframe** (#1801) — adding another facts→verdict engine is now a one-line registry entry plus its binding + vectors.

## Could split — webcompliance (the next ready flagship)

webcompliance is a clean facts→verdict engine: `runGate` evaluates measured conformance signals against a resolved `CompliancePolicy` and returns a `GateResult` (blocked/passed + violations); `applyWaivers` folds expiring overrides; `auditToReport` maps the record to the Report model. All clocks/inputs are injected (pure, dependency-free) — the move is clean. **Unlike webpolicy, its types are NOT yet extracted** (the policy model + result types live inline in the runtime files — there is no `we:webcompliance/contract.ts`), so the cascade opens with a contract-extraction slice (mirroring webpolicy's #1077, [[project_contract_ts_is_separate_slice]]). It has **no existing conformance demo** (none to strand), so the docs slice *creates* one via the #1801 iframe.

A 5-story cascade (each `size ≤ 3`, batchable in sequence — a linear DAG, each slice leaves WE compiling and the FUI engine + WE runtime coexisting until the final delete):

| Slice | Scope | size | DAG |
|---|---|---|---|
| **C1** — Extract the webcompliance contract | Pull the policy model + gate/waiver/audit result types (`CompliancePolicy`, `PolicyRule`, `Severity`, `GateResult`, `GateViolation`, `Waiver`, `AuditRecord`, …) into `we:webcompliance/contract.ts` + the `@webeverything/contracts/webcompliance` export; runtime files `import type` from it + re-export. Resolve the `we:webcompliance/audit.ts` → `we:blocks/renderers/report` Report-type seam (reference the Report types from their home). | 3 | ready now |
| **C2** — Relocate the webcompliance runtime → FUI | Move `runGate`/`resolvePolicy`/`applyWaivers`/`auditToReport` → `fui:webcompliance/`, importing the contract via `@webeverything/contracts/webcompliance`; register the alias in FUI vitest/vite/tsconfig (mirrors #1799). Keep `we:webcompliance/contract.ts`. | 3 | blockedBy C1 |
| **C3** — webcompliance conformance binding + vector corpus | FUI synchronous binding (`dispatch(setPolicy/setSignals)` / `observe('blocked'/'violations')`, per #1789) over the relocated gate + WE vector corpus `we:conformance-vectors/webcompliance.vectors.ts` (signals+policy → golden gate verdict + waiver/expiry checks). | 3 | blockedBy C2 |
| **C4** — Wire the visible docs conformance page via the plateau iframe | Register webcompliance in `plateau:src/conformance-engine/embedSuites.ts` (one-line entry, #1801 infra) + create the `we:demos/webcompliance-conformance-demo.html` + `we:demos/webcompliance-conformance-demo.ts` that embeds the plateau iframe (`?suite=webcompliance`). | 2 | blockedBy C3 |
| **C5** — Delete the WE webcompliance runtime | Delete `we:webcompliance/gate.ts` + `we:webcompliance/waiver.ts` + `we:webcompliance/audit.ts` + their tests; keep `we:webcompliance/contract.ts` + the vectors. Completes the #1282 end-state for webcompliance. | 2 | blockedBy C4 |

## Could not split (yet)

| Group | Failed condition | Unblocking action |
|---|---|---|
| **process, webtraits** (engines, non-facts→verdict) | rubric (5)/(4) — the proven cascade's conformance is a facts→verdict vector binding; a workflow step-graph driver / a build-time intent→trait resolver don't obviously fit it, so the conformance shape (and thus a valid demoable end-state) is unverified | per-subsystem **conformance-shape investigation**: does a vector that "observes a verdict" fit a stateful workflow / a resolver output, or does each need a new binding variant? Then `/slice 1294` per subsystem. |
| **reliability, intl, analytics, webtheme** (non-engine planes) | rubric (5) — a vector that "observes a verdict" does not fit formatting / aggregation / token-projection / provider-strategy; their conformance model is undecided | **resolve the deferred decision** (filed by this run, see below): *Conformance model for non-facts→verdict relocated runtimes*. Then `/slice` them. |
| **webcases** (mixed conformance tooling) | rubric (5)/(3) — some files are conformance *tooling* that checks WE's own declarative artifacts (stays WE per #1566 carve-out), some are delivery runtime; the cut is per-file, not whole-subsystem | per-file **placement read** (which `we:webcases/*.ts` are WE-side checks vs FUI-bound runtime), then carve only the runtime half. |

## Deferred decision to file (de-bury the blocker)

The non-engine group is gated on a conformance-model decision that the prior 1294b report flagged but **was never filed** (#1784 is *resolved* and covers only the facts→verdict KIT). Per the split rule ([[feedback_decisions_are_workitems_not_plan_mode]]), file it as its own `type:decision` card (parked, deferred — it doesn't block webcompliance):

- **"Conformance model for non-facts→verdict relocated runtimes"** — how does a relocated formatting/aggregation/token-projection/provider-strategy runtime prove conformance, given the #899 vector model observes a *verdict*? Parked until a non-engine subsystem is the next relocation priority; blocks the reliability/intl/analytics/webtheme slices.

## Proposed shape

`#1294` stays a roadmap epic; add the **5 webcompliance stories** C1–C5 as children (the next proven-pattern cascade), and file the deferred non-engine conformance-model **decision card**. The remaining engines (process, webtraits) and webcases await their per-subsystem investigation; the non-engine planes await the filed decision. webpolicy proved the cascade; webcompliance extends it; the long tail unlocks per its own gate.
