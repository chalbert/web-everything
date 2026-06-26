---
kind: story
size: 3
parent: "1294"
status: resolved
blockedBy: ["1799"]
dateOpened: "2026-06-26"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: "we:conformance-vectors/webpolicy.vectors.ts"
tags: []
---

# webpolicy conformance binding + WE vector corpus

Author the webpolicy conformance: a FUI synchronous facts→verdict binding (dispatch(setFacts)/observe('verdict'), the #1789 SynchronousConformanceBinding) over the relocated FUI engine, plus the WE vector corpus we:conformance-vectors/webpolicy.vectors.ts (facts→golden verdict + proof-chain checks). Uses the #1790 plateau runner. Blocked on the FUI engine (W1).

## Progress

- **Status:** resolved
- **Branch:** main
- **Done:**
  - WE: `we:conformance-vectors/webpolicy.vectors.ts` — `webpolicySuite` (7 vectors: FIRST/PRIORITY/COLLECT/default hit policies → golden verdict + runtime-venue proof-chain checks `proofRecordCount`/`proofVerified`/`proofVerdict`). Registered in `we:conformance-vectors/index.ts` (export + `conformanceSuites`).
  - FUI: `fui:webpolicy/webpolicyConformance.ts` — `WebpolicyConformanceBindingFactory` + `WebpolicyBinding implements SynchronousConformanceBinding` (clock-free, #1789) over the relocated PDP/PEP/ProofChain; verbs `setRuleSet`/`decide`/`enforce`, surfaces `verdict`/`allowed`/proof. Injected deterministic hash + fixed clock (dependency-free). Exported from `fui:webpolicy/index.ts`.
  - Plateau: `plateau:src/conformance-engine/webpolicy.conformance.test.ts` runs `ConformanceVectorOracle(webpolicySuite, WebpolicyConformanceBindingFactory)` → zero findings. Aliases `@webeverything/conformance-vectors/webpolicy` + `@frontierui/webpolicy` registered in `plateau:vite.config.mts` + `plateau:vitest.config.ts`; type-paths (incl. `@webeverything/contracts/webpolicy`, type-only) in `plateau:tsconfig.json`.
- **Verified:** plateau conformance-engine suite 23/23 (incl. the new webpolicy run) · FUI + plateau tsc clean for webpolicy · WE check:standards 0 errors.
- **Next:** done. W3 (#1801) repoints the visible docs page via the plateau iframe; W4 (#1802) deletes the WE runtime. Both now ready in DAG order.
- **Notes:** webpolicy is the first synchronous (clock-free) suite to land on the #1790 runner — the smoke test's demo-loan-policy proved the path; this is the first real standard through it.
