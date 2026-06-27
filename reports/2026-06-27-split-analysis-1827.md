# Backlog split analysis — #1827 (SSR injector-context hydration)

**Date:** 2026-06-27 · **Focus:** single item #1827 · **Verdict: COULD NOT SPLIT (defer)**

## Subject

[#1827 — SSR injector-context hydration: seed the webexpressions injector chain from server-rendered state](../backlog/1827-ssr-injector-context-hydration-seed-the-webexpressions-injec.md)
— `kind: story`, `size: 13`, `status: open`, `priority: low`, `locus: frontierui`, `relatedProject: webexpressions`.

Qualifies as a split candidate on the size gate alone (`size 13 > 8`). It does **not** clear the split-safety rubric.

## Could split

None.

## Could not split — which condition fails

| # | Condition | Pass? | Why |
|---|---|---|---|
| 1 | Size is *volume*, not an unresolved decision/scope-placeholder | **FAIL** | The 13 is not decomposable volume. The card was bumped to 13 precisely *because* it is a **general** runtime hydration mechanism "over the whole injector chain (every block's `[[ ref ]]` form)" with **no consumer** defining its surface. The size encodes *scope-pending-a-consumer*, not work that can be carved. |
| 2 | ≥2 nameable slices, each with a real home | **FAIL** | The mechanism is monolithic ("seed the injector-context DI seam from client-only state"). Absent a concrete consumer there is no surface against which to name independent slices — any carve would be inventing a shape the card explicitly refuses to fix until a consumer lands. |
| 3 | Each slice lands `size ≤ 3 / task` | n/a | Unknowable without a consumer-defined surface. |
| 4 | Clean DAG with real independence / incremental delivery | n/a | No internal edges to draw; the only real dependency is *external* and unmet (the un-park trigger). |
| 5 | Every slice leaves a valid demoable state | **FAIL** | The item is **consumer-parked**: no real non-deterministic consumer exists, so no slice could reach a demoable runtime state. The whole docs `<table>` family (#1787 / #1600 / #1609–#1613) is wholly *deterministic* and ships *without* this mechanism (#1818, resolved). |

### Two hard blockers behind the rubric failures

1. **Wrong repo to slice in.** `#1827` is `locus: frontierui` — a standard *implementation*, not a contract (foundational zero-impl rule). It is **not buildable in `webeverything` now**; WE keeps only the contract, which is *already codified* by resolved #1818 in `we:docs/agent/platform-decisions.md#block-data-ingestion`. There is no WE-side residual to slice. Slicing it here would scaffold WE cards for work that lives in FUI.

2. **No consumer ⇒ no surface ⇒ nothing to slice against.** No backlog item is `blockedBy: 1827`. Per *Prep: Verify Mechanism Has A Consumer* (`0 callers → build-vs-defer; needs the SPECIFIC orphan`) and the card's own "verify a real non-deterministic consumer before building" gate, the binding surface that would define the slices does not yet exist.

## Action that would unblock a future split

The card's **un-park trigger**: a concrete **non-deterministic consumer** lands — an app/dynamic `we-` block whose declarative `[[ @ctx ]]` binds to a **client-only** context, needing the injector chain seeded at upgrade. When that consumer exists:

1. The work moves to **FUI** (its real home), against that consumer.
2. The consumer defines the binding surface, converting the "general mechanism, unknown scope" 13 into nameable, sized slices.
3. *Then* a split (in FUI, against the consumer) becomes well-posed.

Until then `#1827` correctly stays `priority: low`, `size: 13`, FUI-homed, parked — and out of the agent-ready batch pool. **No backlog mutation.**
