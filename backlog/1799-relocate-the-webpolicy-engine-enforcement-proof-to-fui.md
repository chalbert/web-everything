---
kind: story
size: 3
parent: "1294"
status: open
locus: frontierui
dateOpened: "2026-06-26"
relatedReport: reports/2026-06-26-split-analysis-1294b.md
tags: [webpolicy, relocation, constellation-placement]
---

# Relocate the webpolicy engine (enforcement + proof) to FUI

Move the webpolicy DMN runtime out of WE per #1282: we:webpolicy/enforcement.ts (PolicyDecisionPoint + DMN hit policies, clock/signer/facts injected) + we:webpolicy/proof.ts (ProofChain) relocate to fui:webpolicy/. Keep we:webpolicy/contract.ts as the WE contract. The engine is generic (all deps injected, #1078) so the move is clean; consumers repoint to the FUI engine. First slice of the webpolicy relocation cascade (#1294).
