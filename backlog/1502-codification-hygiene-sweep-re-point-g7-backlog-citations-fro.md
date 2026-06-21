---
kind: story
size: 5
status: open
dateOpened: "2026-06-21"
tags: []
---

# Codification-hygiene sweep: re-point G7 backlog citations from #N to their platform-decisions statute anchor (cite the rule, not the case)

The G7 codification-hygiene lane carved out of the #1474 triage — the bulk (77 candidates at filing, drifts with activity). Each flagged backlog item cites a CODIFIED decision by bare #N instead of its named statute anchor; the audit (we:scripts/audit-backlog-health.mjs, report we:audits/backlog-health-audit.md G7 section) already pre-computes every re-point (#N => we:docs/agent/platform-decisions.md#<anchor>). Sweep each: in the body, cite the statute rule alongside/instead of the bare #N (cite the rule, not the case). MECHANICAL-ish but verify lineage per item first (the first audit pass over-reports). Re-run the audit to confirm G7 drops. Voluminous + touches many concurrent-session files, so a focused single-item sweep, not a batch-tail slot. Independent of the G4/G5 fork-existence lane (routes to decision turns) and the isExec/G2-G3 vocabulary decision (#1473).
