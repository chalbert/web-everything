---
kind: story
size: 3
parent: "1294"
status: open
blockedBy: ["1808"]
dateOpened: "2026-06-27"
tags: []
---

# Relocate the webcompliance runtime (gate/waiver/audit) to FUI

C2 of the webcompliance relocation cascade (#1294). Move the runtime — runGate + resolvePolicy from we:webcompliance/gate.ts, applyWaivers from we:webcompliance/waiver.ts, auditToReport from we:webcompliance/audit.ts — out of WE per #1282 to fui:webcompliance/, importing the policy model via @webeverything/contracts/webcompliance; register the alias in FUI vitest/vite/tsconfig (mirrors #1799). Keep we:webcompliance/contract.ts as the WE contract. All deps injected so the move is clean; the audit→Report type seam resolves from the renderer's home.
