---
kind: epic
status: open
dateOpened: "2026-06-20"
relatedProject: webvalidation
relatedReport: reports/2026-06-24-split-analysis-1294.md
tags: [constellation-placement, reference-runtime, webpolicy, relocation, frontierui, conformance]
---

# Relocate WE-resident logic reference runtimes (webpolicy enforcement/proof + the ~10 #1078 subsystems) to FUI

Downstream of the **zero-implementation rule** (`we:docs/agent/platform-decisions.md#constellation-placement`,
ratified by #1282): the WE project must hold **no delivery runtime**, but ~10 pre-existing logic
reference runtimes still live in WE in violation — `we:webpolicy/enforcement.ts` + `we:webpolicy/proof.ts`
(consumed by `we:demos/webpolicy-conformance-demo.ts` via a build-time local import) and the subsystems
#1078 covered. Relocate each to FUI, leaving WE the **contract + conformance vectors** only. Mirrors the
`we:#1245` block relocation, for non-rendered logic.

## Why parked (gate not met — verified 2026-06-20)

A skeptic pass confirmed the move cannot start without stranding conformance proof:
- **No FUI home.** `fui:webpolicy/` does not exist; no `@frontierui/webpolicy` package or plan.
- **No headless surface-FUI path.** The `fuiDemo` iframe convention serves **rendered** FUI components
  with branding chrome — there is no mechanism for the WE-website demo to load FUI *headless logic* (a
  DMN engine) at runtime without a forbidden build-time `import '@frontierui/...'`.
- **#899 vector-runner is designed, not built** — so WE cannot yet keep only vectors and have FUI run
  them. Deleting the runtime today would replace WE's executable conformance proof with nothing (breaks
  the DoD conformance-demo mandate).

**Un-park when:** (a) FUI hosts each runtime, AND (b) the website can surface FUI for headless logic
(a mode-C runtime bundle path **or** the #899 runner is built). Then slice per subsystem (webpolicy
first — it has the live demo + 23 tests).

**Un-parked 2026-06-26 — foundation #1783 resolved.** The conformance-surface foundation landed:
`we:conformance-vectors/binding.ts` now ships the clock-free `SynchronousConformanceBinding` (#1789), the
plateau runner drives it (`plateau:src/conformance-engine/conformanceVectors.ts`, #1790), and the surface
mechanism is settled — a **plateau-hosted conformance iframe** (#1788 ratified (b): the runner stays a
shared plateau tool). So per-subsystem the relocation is now sliceable: (a) relocate the runtime → FUI;
(b) write its **binding** (the one-screen `dispatch`/`observe` adapter) + its **vector corpus**; (c) wire
the visible docs page to the plateau iframe; (d) delete the WE runtime, keeping contract + vectors. Webpolicy
first (it has the live demo + 23 tests). **Re-run `/slice 1294`.** See `we:reports/2026-06-26-backlog-split-analysis.md`.

## Slices (to carve on un-park)

Per-subsystem: (a) stand up the FUI home; (b) repoint the WE-website conformance demo to surface FUI
(bundle/runner) or convert to a vector run FUI-side; (c) delete the WE runtime, retaining contract +
vectors. Webpolicy is the first slice; the remaining #1078 subsystems follow.

## Carve status (per `we:reports/2026-06-27-split-analysis-1294-webcompliance.md`)

- **webpolicy — DONE.** The proving cascade: W1–W4 (#1799 engine→FUI · #1800 binding+vectors · #1801
  plateau-iframe docs page · #1802 delete WE runtime). Reached the #1282 end-state.
- **webcompliance — CARVED.** Next ready facts→verdict engine, 5-story cascade C1–C5: #1808 (extract
  contract) → #1814 (relocate runtime) → #1809 (binding+vectors) → #1810 (docs page) → #1815 (delete
  runtime).
- **process, webtraits** (engines, non-facts→verdict) and **webcases** (mixed tooling, #1566) — could
  not split: need a per-subsystem conformance-shape / placement read first.
- **reliability, intl, analytics, webtheme** (non-engine planes) — gated on the conformance-model
  decision **#1816** (filed `priority: low`: the #899 verdict-vector model doesn't fit formatting /
  aggregation / token-projection / provider-strategy).
