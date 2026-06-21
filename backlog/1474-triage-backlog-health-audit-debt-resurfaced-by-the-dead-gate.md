---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
tags: []
---

# Triage backlog-health-audit governance debt resurfaced by the dead-gate fix (two lanes: fork-existence re-runs · codification hygiene)

Fixing the dead kind-field gate in we:scripts/audit-backlog-health.mjs (G3-G7 had silently never fired since the kind-axis migration, #487) resurrected a backlog of governance candidates that were invisible. Each is a CANDIDATE, not a verdict (the first judgment pass over-reports — verify lineage before acting), and the live counts drift with concurrent activity (≈75 G7 / 1 G5 / 1 G6 / 1 G4 at filing — read the current audit, do not trust these numbers). The work splits into **two distinct remediation lanes**:

- **Fork-existence lane (G4 effort tells + G5 missing fork-existence justification line, #819).** These are prepared decisions whose forks may not be real forks — exactly the class this session hardened the screens against. **Re-run each through the now-hardened fork-existence test** (composability probe → prove cannot-coexist by failing to compose; nature-test downsides + strip-effort loop; disprove "no consumer"/"cannot coexist" rather than assert — see we:docs/agent/backlog-workflow.md), dissolving any effort-fork to the #088 support-both shape. **#1457 is the worked example of this lane** (G4 tell "no consumer need") but is handled at its own /next decision turn, not here.
- **Codification-hygiene lane (G6 resolved decision with no codifiedIn + G7 cites a codified rule's #N but not its we:docs/agent/platform-decisions.md statute anchor).** Mechanical-ish: promote a case-law-only rule to a named guideline / set codifiedIn, and re-point #N citations to the statute anchor (cite the rule, not the case). The G7 sweep is the bulk.

Independent of the isExec/G2-G3 vocabulary decision (#1473), which re-enables the still-dead G2/G3 gates.

## Triage (batch-2026-06-21-1429-1487) — classified, quick win done, lanes routed

Ran the live audit (`we:audits/backlog-health-audit.md`): **G4=0 · G5=1 · G6=1 · G7=77** (the filing's
~75 G7 / 1 G6 / 1 G5 / 1 G4 confirmed, G4 now drained). Triaged each lane:

- **Fork-existence lane (G4=0, G5=1) → routed to decision turns, not fixed here.** G4 is empty (the
  worked example #1457 ratified). The lone G5 is **#428** (open-core tiering — *Fork 2, the free/paid
  threshold*). Per the item's own rule (*"#1457 is handled at its own /next decision turn, not here"*), a
  fork-existence re-run is a **decision-turn judgment**, not a mechanical batch fix — left for #428's
  `/prepare`/`/next` turn (add the fork-existence justification line or dissolve to the #088 support-both
  shape there). Filing no edge: #428 is already an open decision the ranker surfaces.
- **Codification-hygiene lane → quick win done + the bulk filed as its own item.**
  - **G6 (1) — done inline:** **#1270** (reconcile-direction ruling) had no `codifiedIn`; it is a
    situation-specific operational decision (the two reconciliation principles live in #1250's epic body,
    not a broadly-cited named statute) → marked **`codifiedIn: one-off`** (the G6 flag's own "or mark
    one-off" branch).
  - **G7 (77) — filed as #1502.** The bulk (re-point bare `#N` citations → their statute anchor; the
    audit pre-computes every mapping). 77 mostly-concurrent backlog files is a voluminous broad mutation —
    a **focused single-item mechanical sweep**, not a story·3 triage slot. Carved out as **#1502**
    (`/codification-hygiene sweep`, size 5).

Triage complete: candidates classified, the one mechanical singleton fixed, the fork lane routed to its
decision turn, the G7 bulk routed to a dedicated sweep (#1502). Resolving the triage.
