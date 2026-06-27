---
kind: story
size: 3
parent: "1294"
status: open
dateOpened: "2026-06-27"
tags: []
---

# Extract the webcompliance contract (policy/gate/waiver/audit types)

C1 of the webcompliance relocation cascade (#1294). The compliance policy model + gate/waiver/audit result types (CompliancePolicy, PolicyRule, Severity, GateResult, GateViolation, Waiver, AuditRecord) live inline in the runtime files — extract them into we:webcompliance/contract.ts and the @webeverything/contracts/webcompliance export (mirrors webpolicy #1077). Runtime files import type from it + re-export. Resolves the audit→blocks/renderers/report Report-type seam. The type-only FUI→WE foundation the relocation depends on.
