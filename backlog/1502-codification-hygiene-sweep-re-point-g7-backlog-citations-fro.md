---
kind: story
size: 13
status: open
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
tags: []
---

# Codification-hygiene sweep: re-point G7 backlog citations from #N to their platform-decisions statute anchor (cite the rule, not the case)

The G7 codification-hygiene lane carved out of the #1474 triage — the bulk (77 candidates at filing, drifts with activity). Each flagged backlog item cites a CODIFIED decision by bare #N instead of its named statute anchor; the audit (we:scripts/audit-backlog-health.mjs, report we:audits/backlog-health-audit.md G7 section) already pre-computes every re-point (#N => we:docs/agent/platform-decisions.md#<anchor>). Sweep each: in the body, cite the statute rule alongside/instead of the bare #N (cite the rule, not the case). MECHANICAL-ish but verify lineage per item first (the first audit pass over-reports). Re-run the audit to confirm G7 drops. Voluminous + touches many concurrent-session files, so a focused single-item sweep, not a batch-tail slot. Independent of the G4/G5 fork-existence lane (routes to decision turns) and the isExec/G2-G3 vocabulary decision (#1473).

## Pre-flight (batch-2026-06-21-1501-1356) — re-sized 5 → 13 (not a concurrent-batch slice)

Claimed + grounded: the live audit (`we:scripts/audit-backlog-health.mjs`) reports **G7 = 73** candidates, each citing one or more codified decisions by bare `#N`. Two properties make this **not a concurrent-batch slice** (matching the item's own "focused single-item sweep, not a batch-tail slot" framing): (a) the audit **over-reports** — each of the 73 needs per-item lineage verification before its re-point, so it cannot be blind-applied; (b) it edits **73 backlog files**, many of which other concurrent sessions may hold/edit (the candidate set "drifts with activity"), so a mass mid-batch sweep risks clobbering concurrent work. Re-sized 5 → 13 to drop it from the batchable pool; it wants a focused single-session sweep that owns the backlog quiescently (verify each lineage → re-point → re-run the audit to confirm G7 → 0). Carry-forward reason: **not-batchable** (voluminous concurrent-file sweep + over-reporting audit). Released to `open`.
