---
kind: story
size: 3
status: open
dateOpened: "2026-06-21"
tags: []
---

# Triage backlog-health-audit governance debt resurfaced by the dead-gate fix (two lanes: fork-existence re-runs · codification hygiene)

Fixing the dead kind-field gate in we:scripts/audit-backlog-health.mjs (G3-G7 had silently never fired since the kind-axis migration, #487) resurrected a backlog of governance candidates that were invisible. Each is a CANDIDATE, not a verdict (the first judgment pass over-reports — verify lineage before acting), and the live counts drift with concurrent activity (≈75 G7 / 1 G5 / 1 G6 / 1 G4 at filing — read the current audit, do not trust these numbers). The work splits into **two distinct remediation lanes**:

- **Fork-existence lane (G4 effort tells + G5 missing fork-existence justification line, #819).** These are prepared decisions whose forks may not be real forks — exactly the class this session hardened the screens against. **Re-run each through the now-hardened fork-existence test** (composability probe → prove cannot-coexist by failing to compose; nature-test downsides + strip-effort loop; disprove "no consumer"/"cannot coexist" rather than assert — see we:docs/agent/backlog-workflow.md), dissolving any effort-fork to the #088 support-both shape. **#1457 is the worked example of this lane** (G4 tell "no consumer need") but is handled at its own /next decision turn, not here.
- **Codification-hygiene lane (G6 resolved decision with no codifiedIn + G7 cites a codified rule's #N but not its we:docs/agent/platform-decisions.md statute anchor).** Mechanical-ish: promote a case-law-only rule to a named guideline / set codifiedIn, and re-point #N citations to the statute anchor (cite the rule, not the case). The G7 sweep is the bulk.

Independent of the isExec/G2-G3 vocabulary decision (#1473), which re-enables the still-dead G2/G3 gates.
