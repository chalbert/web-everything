---
kind: story
size: 3
parent: "1294"
status: resolved
blockedBy: ["1814"]
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: "we:conformance-vectors/webcompliance.vectors.ts"
tags: []
---

# webcompliance conformance binding + WE vector corpus

C3 of the webcompliance relocation cascade (#1294). Author a FUI synchronous facts→verdict binding (dispatch(setPolicy/setSignals) / observe('blocked'/'violations'), the #1789 SynchronousConformanceBinding) over the relocated gate, plus the WE vector corpus we:conformance-vectors/webcompliance.vectors.ts (signals+policy → golden gate verdict + waiver/expiry checks). Driven by the #1790 plateau runner. Blocked on the FUI engine (C2).

## Progress

- **Status:** resolved
- **Done:**
  - WE: `we:conformance-vectors/webcompliance.vectors.ts` — `webcomplianceSuite` (6 vectors: gate pass/block/warn/missing-measure + active-waiver-suppresses + expired-waiver-surfaces). Registered in `we:conformance-vectors/index.ts`.
  - FUI: `fui:webcompliance/webcomplianceConformance.ts` — `WebcomplianceConformanceBindingFactory` + clock-free `SynchronousConformanceBinding` (#1789) over `runGate`/`applyWaivers`; verbs `setPolicy`/`runGate`/`applyWaivers`, surfaces `blocked`/`passed`/`violationCount`/`waivedCount`/`expiredCount`. Exported from `fui:webcompliance/index.ts`.
  - Plateau: `plateau:src/conformance-engine/webcompliance.conformance.test.ts` → zero findings. Aliases `@webeverything/conformance-vectors/webcompliance` + `@frontierui/webcompliance` in `plateau:vite.config.mts` + `plateau:vitest.config.ts`; type-paths (incl. `@webeverything/contracts/webcompliance` + `@webeverything/contracts/report`, type-only) in `plateau:tsconfig.json`.
- **Verified:** plateau conformance-engine 25/25 (incl. the new webcompliance run) · plateau + FUI tsc clean for webcompliance · WE check:standards 0 errors.
- **Notes:** the real conformance run caught a vector bug — two waiver vectors omitted the `coverage` measure, making it a phantom missing-measure violation; added it to isolate the waiver behavior to the `aria-sort` block rule. (Exactly what the run is for.)
