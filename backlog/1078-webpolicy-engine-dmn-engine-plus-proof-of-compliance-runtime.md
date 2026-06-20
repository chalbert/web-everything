---
type: decision
workItem: story
size: 5
parent: "1028"
status: preparing
blockedBy: ["1077"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
tags: []
---

# webpolicy engine — DMN engine plus proof-of-compliance runtime in FUI

Slice B of webpolicy impl epic #1028 (blockedBy slice A contract). Implement the DMN engine + proof-of-compliance runtime in FUI (evaluate DMN decision tables, emit a signed proof-of-compliance), conforming to the WE contract.

## Surfaced fork — runtime is BUILT (WE-resident); FUI-relocation is an unratified placement decision (batch-2026-06-19)

The DMN engine + proof-of-compliance runtime the card asks for **already exists and is conformant in WE**: `we:webpolicy/enforcement.ts` (`comparatorEvaluator`, `PolicyDecisionPoint` evaluating DMN decision tables with UNIQUE/FIRST/PRIORITY/COLLECT hit policies, `PolicyEnforcementPoint`, `HitPolicyViolation`) + `we:webpolicy/proof.ts` (`ProofChain` — signed merkle proof-of-compliance, `ProofRecord`, OSCAL assessment results). **23 tests pass** (`we:webpolicy/__tests__/`), and `we:demos/webpolicy-conformance-demo.ts` consumes it. Git shows the runtime pre-dated #1077, which only *extracted* the contract module out of it (`3c0b6a8`).

So the substance is delivered; the only open question is the **home**, and it's a genuine fork:
- **A — accept WE-resident** (resolve as-is): matches the ratified #1071/webprocess precedent (its runtime graduated to `we:process/provider.ts` and a WE demo consumes it). The WE demo + 23 tests already depend on the WE path; no churn.
- **B — relocate WE→FUI** (honor the contract header's `→ FUI` and match the 5 sibling provider runtimes built FUI-side in this same batch: webidentity/webnotifications/webrealtime/webresources + analytics): boundary-pure, but breaks/forces a re-wire of the WE demo + 23 tests and the WE→FUI import seam.

Released `open` for ratification — NOT resolved unilaterally (per "decisions are work items" + "wait for explicit ratification"). If A, resolve against `we:webpolicy/enforcement.ts`. If B, relocate + add the `@webeverything/contracts/policy` distribution entry + repoint the demo. Note: the same WE-vs-FUI runtime-home inconsistency now spans the protocol epics (webprocess/webpolicy → WE; the five I built this batch → FUI) and is worth settling once for all of them.
