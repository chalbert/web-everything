---
kind: story
size: 3
parent: "1294"
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: "we:webcompliance/contract.ts"
tags: []
---

# Extract the webcompliance contract (policy/gate/waiver/audit types)

C1 of the webcompliance relocation cascade (#1294). The compliance policy model + gate/waiver/audit result types (CompliancePolicy, PolicyRule, Severity, GateResult, GateViolation, Waiver, AuditRecord) live inline in the runtime files — extract them into we:webcompliance/contract.ts and the @webeverything/contracts/webcompliance export (mirrors webpolicy #1077). Runtime files import type from it + re-export. Resolves the audit→blocks/renderers/report Report-type seam. The type-only FUI→WE foundation the relocation depends on.

## Progress

- **Status:** resolved
- **Done:** created `we:webcompliance/contract.ts` (all #436/#437/#438/#439 types — Severity, PolicyRule, CompliancePolicy, Measure, GateViolation, GateResult, RunGateOptions, Waiver, WaivedViolation, WaiveredGateResult, AnyGateResult, AuditRecord, AuditToReportOptions). Repointed `we:webcompliance/gate.ts` + `we:webcompliance/waiver.ts` to `import type` from it + `export type * from './contract'` (so the tests' `from '../gate'`/`from '../waiver'` type imports still resolve); `we:webcompliance/audit.ts` imports its gate/waiver/audit types from the contract (the Report-model import stays a runtime concern — the audit contract types don't reference Report, so C1 is clean). Added `we:contracts/webcompliance.ts` re-export + `./webcompliance` to `we:contracts/package.json`.
- **Verified:** tsc clean for webcompliance · 36 webcompliance tests pass (non-breaking) · check:standards 0 errors.
- **Notes:** the audit→Report seam I expected to handle here turned out to be runtime-only (no contract type references Report), so it defers cleanly to C2 (the runtime relocation).
