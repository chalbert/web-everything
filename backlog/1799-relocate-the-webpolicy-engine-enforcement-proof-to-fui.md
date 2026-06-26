---
kind: story
size: 3
parent: "1294"
status: resolved
locus: frontierui
dateOpened: "2026-06-26"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: "fui:webpolicy/"
relatedReport: reports/2026-06-26-split-analysis-1294b.md
tags: [webpolicy, relocation, constellation-placement]
---

# Relocate the webpolicy engine (enforcement + proof) to FUI

Move the webpolicy DMN runtime out of WE per #1282: we:webpolicy/enforcement.ts (PolicyDecisionPoint + DMN hit policies, clock/signer/facts injected) + we:webpolicy/proof.ts (ProofChain) relocate to fui:webpolicy/. Keep we:webpolicy/contract.ts as the WE contract. The engine is generic (all deps injected, #1078) so the move is clean; consumers repoint to the FUI engine. First slice of the webpolicy relocation cascade (#1294).

## Progress

- **Status:** active
- **Branch:** main
- **Done:**
  - WE: `we:contracts/webpolicy.ts` type-only re-export of the WE `we:webpolicy/contract.ts`; added `./webpolicy` to `we:contracts/package.json` exports (published FUI→WE arrow, #872).
  - FUI: `fui:webpolicy/enforcement.ts` + `fui:webpolicy/proof.ts` (production impl), `fui:webpolicy/index.ts` barrel, `fui:webpolicy/__tests__/enforcement.test.ts` + `fui:webpolicy/__tests__/proof.test.ts` (23 tests, green). `fui:webpolicy/enforcement.ts` imports the contract via `@webeverything/contracts/webpolicy` (not a local contract).
  - FUI alias `@webeverything/contracts/webpolicy` → WE `we:webpolicy/contract.ts` registered in `fui:vitest.config.ts` (+ the `webpolicy/` test-include glob), `fui:vite.config.mts`, `fui:tsconfig.json`.
- **Next:** all done — FUI vitest (23/23) + WE check:standards green. (W2 picks up the conformance binding; the WE runtime/tests/demo stay until W4.)
- **Notes:** Per the W1/W4 split (report 2026-06-26-split-analysis-1294b): W1 *creates* the FUI engine + repoints the published contract; the WE runtime + tests + `we:demos/webpolicy-conformance-demo.ts` are left in place (demo repoints in W3, WE runtime deleted in W4) so each slice ships independently.
