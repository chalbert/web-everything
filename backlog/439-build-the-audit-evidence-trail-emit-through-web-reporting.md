---
type: idea
workItem: story
size: 3
parent: "351"
status: resolved
blockedBy: ["436", "437", "431"]
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
tags: []
---

# Build the audit / evidence trail — emit through Web Reporting

Build the audit/evidence trail: what was enforced, when, against which standard version, with what result — the defensible record (mirrors the loan app's proof-of-compliance at platform level). Emits through Web Reporting (#350): an audit result is just another report source, so this consumes #350's report model. Phase 4 of #351; needs the policy model (#436), the gates (#437), and the report model (#431).

## Progress

Delivered [we:webcompliance/audit.ts](../webcompliance/audit.ts) (2026-06-13) + [its test](../webcompliance/__tests__/audit.test.ts) (4 cases, all green; full webcompliance suite 18/18):

- **`AuditRecord`** — the defensible enforcement event: `policyId` + `policyVersion` (the "which standard version"), `at` (ISO timestamp, **passed in** — no clock read, deterministic like [we:gate.ts](../webcompliance/gate.ts)/[we:waiver.ts](../webcompliance/waiver.ts)), and the gate `result` (raw `GateResult` or post-waiver `WaiveredGateResult`).
- **`recordAudit(policy, result, at)`** — captures the event, lifting policy identity off the policy.
- **`auditToReport(record, opts?)`** — maps it onto the canonical `Report` model ([we:blocks/renderers/report/renderReport.ts](../blocks/renderers/report/renderReport.ts)): one `webcompliance` audit source (stamped policy/version/verdict), a `Verdict` score block (evaluated / violations / waived / expired / blocked counts), and sections for **violations** (gate severity → report severity: block/error→error, warn→warn), **waived** overrides (info, with who/why/until), **expired waivers** (warn — renew/remove), and **passes** (the full defensible record; `includePasses:false` for failures-only). So the audit is *just another report source* — #432 renderers and #434 `toSarif`/`toJUnit` consume it unchanged.

**Scope note:** this slice delivers the per-event record→report mapping (the unit of the trail). Persisting/aggregating a *sequence* of records (where audit logs live, append semantics) is unspecified and would be a follow-on with its own storage decision — out of this size-3.
