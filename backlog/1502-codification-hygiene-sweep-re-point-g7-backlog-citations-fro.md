---
kind: story
size: 13
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
tags: []
---

# Codification-hygiene sweep: re-point G7 backlog citations from #N to their platform-decisions statute anchor (cite the rule, not the case)

The G7 codification-hygiene lane carved out of the #1474 triage — the bulk (77 candidates at filing, drifts with activity). Each flagged backlog item cites a CODIFIED decision by bare #N instead of its named statute anchor; the audit (we:scripts/audit-backlog-health.mjs, report we:audits/backlog-health-audit.md G7 section) already pre-computes every re-point (#N => we:docs/agent/platform-decisions.md#<anchor>). Sweep each: in the body, cite the statute rule alongside/instead of the bare #N (cite the rule, not the case). MECHANICAL-ish but verify lineage per item first (the first audit pass over-reports). Re-run the audit to confirm G7 drops. Voluminous + touches many concurrent-session files, so a focused single-item sweep, not a batch-tail slot. Independent of the G4/G5 fork-existence lane (routes to decision turns) and the isExec/G2-G3 vocabulary decision (#1473).

## Outcome (2026-06-22) — G7 72 → 4 (irreducible tolerated false positives)

Swept every flagged item (per-item lineage-verified, parallel disjoint-file chunks). Convention established (no prior body-cite precedent existed): at the first/most-prominent body cite of each codified decision, add a markdown link to the statute anchor **alongside** the `#N` (lineage preserved) — `... per #91` → `... per the [monetization](docs/agent/platform-decisions.md#monetization) rule (#91)`. Link target matches the `codifiedIn` path string (the substring the audit checks); deduped by anchor (one link per distinct anchor; multiple `#N` → same anchor cited once). Verified rendered on the live 11ty server (statute href present in served HTML).

**~67 items re-pointed.** Residual **G7 = 4**, all tolerated false positives the candidate-pool audit cannot distinguish (verified, do NOT re-point):
- **#1153** `#2` = "Fix #2" ordinal · **#1207** `#2` = "acceptance #2" ordinal · **#142** `#6/#9/#10/#12` = the card's own enumerated feature-list ordinals · **#1451** `[#011]` = deliverable-lineage cite ("CustomStorageStrategy *from* #011"), where citing the case (the webpersistence project) is correct, not the project-protocol-bar rule.

Note: the audit truncates each flag to its first 4 refs (`refs.slice(0,4)`), so #89/#99 surfaced a 5th/6th codified cite after the first batch — both re-pointed. FP-heuristic improvement to suppress the recurring ordinal/lineage noise carved as a follow-up.

## Pre-flight (batch-2026-06-21-1501-1356) — re-sized 5 → 13 (not a concurrent-batch slice)

Claimed + grounded: the live audit (`we:scripts/audit-backlog-health.mjs`) reports **G7 = 73** candidates, each citing one or more codified decisions by bare `#N`. Two properties make this **not a concurrent-batch slice** (matching the item's own "focused single-item sweep, not a batch-tail slot" framing): (a) the audit **over-reports** — each of the 73 needs per-item lineage verification before its re-point, so it cannot be blind-applied; (b) it edits **73 backlog files**, many of which other concurrent sessions may hold/edit (the candidate set "drifts with activity"), so a mass mid-batch sweep risks clobbering concurrent work. Re-sized 5 → 13 to drop it from the batchable pool; it wants a focused single-session sweep that owns the backlog quiescently (verify each lineage → re-point → re-run the audit to confirm G7 → 0). Carry-forward reason: **not-batchable** (voluminous concurrent-file sweep + over-reporting audit). Released to `open`.
