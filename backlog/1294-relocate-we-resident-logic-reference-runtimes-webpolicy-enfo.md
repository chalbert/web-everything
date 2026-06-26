---
kind: epic
size: 8
status: open
dateOpened: "2026-06-20"
blockedBy: ["1783"]
childlessReason: parked
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

**Now `blockedBy: 1783`** (filed 2026-06-26): both un-park legs reduce to the one missing foundation —
the #899-ratified FUI conformance reference backend + headless-logic surface path was never built. #1783
is that build; on its landing, re-run `/slice 1294` (gate (a) → "move into an existing home", gate (b) →
"repoint to an existing runner"). See `we:reports/2026-06-26-backlog-split-analysis.md`.

## Slices (to carve on un-park)

Per-subsystem: (a) stand up the FUI home; (b) repoint the WE-website conformance demo to surface FUI
(bundle/runner) or convert to a vector run FUI-side; (c) delete the WE runtime, retaining contract +
vectors. Webpolicy is the first slice; the remaining #1078 subsystems follow.
