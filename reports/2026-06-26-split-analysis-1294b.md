# Backlog split analysis — #1294 (re-run, foundation landed)

**Date:** 2026-06-26
**Focus:** `/slice 1294` after the conformance-surface foundation (#1783: #1789 + #1790) resolved and #1294 un-parked.
**Verdict:** **PARTIAL SPLIT.** Carve **webpolicy** (the ready flagship) into a 4-story relocation cascade; the other 8 WE-resident logic runtimes stay future per-subsystem slices (the non-engine ones gated on a deferred conformance-model decision).

## Investigation

`#1294` is a **roadmap epic** — 9 WE-resident logic-runtime subsystems still violate #1282, each its own multi-step relocation:

| Subsystem | WE files | Shape | Ready to relocate now? |
|---|---|---|---|
| **webpolicy** | `we:webpolicy/enforcement.ts` + `we:webpolicy/proof.ts` + `we:webpolicy/contract.ts` (+ 2 tests) | facts→verdict (DMN engine + proof chain) | ✅ **yes** — foundation supports facts→verdict; live demo + 23 tests |
| webcompliance | `we:webcompliance/audit.ts` … | audit/verdict-ish | likely (verify per-subsystem) |
| reliability, process, webcases, webtraits | 1–5 ts each | mixed (protocol runtime-impl halves) | per-subsystem investigation |
| intl, analytics, webtheme | 2–5 ts each | formatting / aggregation / token projection — **not** facts→verdict | ❌ gated — their conformance model is the call #1784 **deferred** |

The conformance foundation (`we:conformance-vectors/binding.ts` `SynchronousConformanceBinding` + the plateau runner driving it + the plateau-iframe surface) covers **facts→verdict** runtimes. Non-engine subsystems can't surface conformance until their model is decided — so they are not carve-able here.

## Could split — webpolicy (the ready flagship)

A clean 4-story cascade (each `size ≤ 3`, batchable in sequence):

| Slice | Scope | DAG |
|---|---|---|
| **W1** — Relocate the webpolicy engine → FUI | Move `we:webpolicy/enforcement.ts` (`PolicyDecisionPoint`, DMN hit policies — clock/signer/facts all injected, #1078) + `we:webpolicy/proof.ts` (`ProofChain`) → `fui:webpolicy/`; keep `we:webpolicy/contract.ts` as the WE contract | ready now |
| **W2** — webpolicy conformance binding + vector corpus | FUI synchronous facts→verdict binding (`dispatch(setFacts)`/`observe('verdict')`, per #1789) + WE vector corpus `we:conformance-vectors/webpolicy.vectors.ts` | blockedBy W1 |
| **W3** — Wire the visible docs conformance page | Repoint `we:demos/webpolicy-conformance-demo.ts` to render webpolicy conformance pass/fail via the plateau iframe (#1790) | blockedBy W2 |
| **W4** — Delete the WE webpolicy runtime | Delete `we:webpolicy/enforcement.ts` + `we:webpolicy/proof.ts` + their tests; keep `we:webpolicy/contract.ts` + the vectors | blockedBy W3 |

After W4, webpolicy is fully relocated (impl→FUI, contract+vectors stay WE), conformance demo intact via the plateau iframe — the #1282 end-state for one subsystem.

## Could not split (yet)

| Group | Failed condition | Unblocking action |
|---|---|---|
| webcompliance + other facts→verdict subsystems | *investigate before carving* — each needs a per-subsystem read to confirm facts→verdict shape + its relocation surface | run `/slice 1294` per subsystem after webpolicy proves the cascade |
| intl, analytics, webtheme (non-engine) | *real home / valid demoable state* — their conformance model is the **deferred** #1784 call (a vector that "observes a verdict" doesn't fit formatting/aggregation/token-projection) | **file** the deferred decision: "conformance model for non-facts→verdict relocated runtimes"; then `/slice` them |

## Proposed shape

`#1294` stays an epic (drop its residual `size`); add the **4 webpolicy stories** W1–W4 as children (the proven cascade). The other 8 subsystems remain documented epic scope — webpolicy first proves the pattern, then per-subsystem slices follow (non-engine ones behind the deferred decision, which should be filed).
