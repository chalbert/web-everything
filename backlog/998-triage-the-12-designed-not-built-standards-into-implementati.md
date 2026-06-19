---
type: idea
workItem: task
parent: "991"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: backlog/1008-triage-roadmap-implement-the-12-designed-not-built-standards.md
tags: []
---

# Triage the 12 designed-not-built standards into implementation epics

Twelve standards have resolved design + a written spec but zero implementation and no open owner: webtraces, webpositioning, webreliability, webintl, webmanifests, webidentity, webreporting, webnotifications, webrealtime, webprocess, webresources, webpolicy. Triage each into an implementation epic (or confirm intentional deferral), so the concept-to-built gap is tracked rather than silent. See we:audits/standards-surfacing-audit.md section 3a.

## Reconciliation from the protocols-layer pass (§7, 2026-06-18)

The L2 protocol audit found two of these twelve are **partial, not zero-impl** — narrow the triage scope accordingly:

- **webpositioning** — its anchor-positioning protocol is **built in frontierui** (`fui:blocks/droplist/positioning/`). The standard already has a cross-repo impl; remaining WE work is completing/surfacing the WE-side seam, not building from scratch.
- **webreporting** — its report-model protocol has a real impl (3 ts). webreporting is **partially built**; triage = finish, not start.

The remaining ten are genuinely designed-not-built. Protocol-level note: `error-recovery` (webreliability) is a true GAP (no design, no impl); `policy-rule` (webpolicy) is a contract-stub.

## Outcome (batch-2026-06-18)

Triaged all 12 into a single tracking roadmap epic **#1008** rather than 12 detail-less epics up front
(materialization pattern — plan → discrete homes → carve on demand). #1008 enumerates each standard with
its design lineage and a per-standard carve note, folding in the §7 reconciliation above. Verdict:
**no intentional deferrals / dead concepts** — all 12 are fundable; **2 partial** (webpositioning,
webreporting → finish, not start); **1 design-first** (webtraces → build follows #992's substrate ruling);
**9 pure build** (carve a per-standard implementation epic when prioritised, contract→WE / runtime→FUI).
#1008 resolves when all 12 are carved into owned epics or retired.
