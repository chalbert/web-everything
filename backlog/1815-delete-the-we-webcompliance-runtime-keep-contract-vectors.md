---
kind: story
size: 2
parent: "1294"
status: resolved
blockedBy: ["1810"]
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: "fui:webcompliance/"
tags: []
---

# Delete the WE webcompliance runtime (keep contract + vectors)

C5 of the webcompliance relocation cascade (#1294). Delete we:webcompliance/gate.ts + we:webcompliance/waiver.ts + we:webcompliance/audit.ts + their __tests__ (runtime graduated to FUI in C2, docs page wired in C4). Keep we:webcompliance/contract.ts (the WE contract) + we:conformance-vectors/webcompliance.vectors.ts. Completes the webcompliance #1282 end-state: impl→FUI, contract+vectors→WE. Blocked on the docs page (C4) so nothing strands.

## Progress

- **Status:** resolved
- **Done:** deleted `we:webcompliance/gate.ts` + `we:webcompliance/waiver.ts` + `we:webcompliance/audit.ts` + their `__tests__` (gate/waiver/audit). `we:webcompliance/` now holds only `we:webcompliance/contract.ts` + the vcs-conventions leftover (#1819). Also moved the reference-baseline policy fixture + its runtime test to FUI (`fui:webcompliance/policies/platform-default.ts` + `fui:webcompliance/__tests__/platform-default.test.ts`) — the test exercises the now-FUI runtime, and WE cannot import FUI (backward edge), so the fixture relocates with the engine (its only consumer was that test).
- **Verified:** FUI webcompliance 23/23 (gate/waiver/audit/platform-default) · FUI tsc clean · WE webcompliance 13/13 (vcs-conventions only, the kept leftover) · WE check:standards 0 errors. No statute-doc update needed (webcompliance wasn't a named runtime example in `we:docs/agent/platform-decisions.md`, unlike webpolicy).
- **Next:** webcompliance reaches the #1282 end-state (impl→FUI, contract+vectors→WE, conformance via the plateau iframe). The `we:webcompliance/conventions/vcs.ts` residual stays WE, tracked by #1819.
