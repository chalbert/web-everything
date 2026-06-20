---
kind: epic
status: resolved
dateOpened: "2026-06-19"
dateResolved: "2026-06-20"
graduatedTo: none
tags: [standards-surfacing, concept-to-built]
---

# Triage roadmap — implement the 12 designed-not-built standards (concept-to-built gap)

Surfaced by #998 (parent #991). These 12 standards each have a **resolved design + a written spec but
zero implementation and no open owner** — per `we:audits/standards-surfacing-audit.md` §3a. This epic
makes that gap explicit and trackable: each row is a candidate implementation epic to carve when picked
up. The audit's verdict — "most are real, fundable standards now" — holds; carving one per standard up
front would just create 12 detail-less epics, so they're enumerated here and carved on demand (the
materialization pattern: plan → discrete homes → refine in place).

## The 12 (standard → design lineage → carve note)

| Standard | Resolved design lineage | Carve note |
|---|---|---|
| webtraces | #093 / #111 / #407 / #408 — the #140 trace/replay keystone | **design first** — already being designed in #992 (trace/replay substrate); build follows that ruling |
| webpositioning | #014 / #467 / #508 (anchor-positioning / responsive placement) | **partial, not zero** — anchor-positioning protocol built in `fui:blocks/droplist/positioning/`; carve = complete/surface the WE-side seam, not build from scratch |
| webreliability | #011 / #028 / #101 / #503 (offline-retry / resumable transfer) | impl epic — recovery-handler registry; protocol-level `error-recovery` is a true GAP (no design, no impl) |
| webintl | #017 project promotion | impl epic — Intl.* provider seam |
| webmanifests | #102 changelog-manifest protocol | impl epic — manifest contract + reader |
| webidentity | #012 / #482 / #483 (credential-management protocol + thin intent) | impl epic — credential-management provider |
| webreporting | #350 / #431 (report-model protocol) | **partially built** — report-model protocol has a real impl; carve = finish (renderers + ingest/export adapters), not start |
| webnotifications | #456 / #459 / #460 (push-delivery + notification intents) | impl epic — push-delivery provider + intents |
| webrealtime | #458 (transport-negotiation protocol) | impl epic — transport-negotiation runtime |
| webprocess | #672 / #690 (self-driven artefact contract) | impl epic — artefact contract runtime |
| webresources | #061 / #455 (pagination / delivery-transport) | impl epic — pagination + delivery-transport |
| webpolicy | #406 / #407 / #408 (DMN meta-schema + proof + enforcement seam) | impl epic — DMN engine + proof-of-compliance |

## Triage verdict

- **No intentional deferrals identified** — all 12 are coherent, fundable standards (the audit's call,
  re-affirmed). None is a dead concept to retire.
- **Two are partial, not zero-impl** (per the task's §7 protocols-layer reconciliation): webpositioning
  (anchor-positioning built in FUI) and webreporting (report-model has impl) — their carve is *finish +
  surface*, not build-from-scratch.
- **One needs design before build:** webtraces — its substrate is mid-design under #992; its build epic
  is carved off #992's ruling, not from here.
- **The remaining nine** are pure build: carve a per-standard implementation epic (contract →
  `@webeverything`, runtime/provider → FUI) when prioritised. Each carries its lineage above as the
  starting context.
- Placement reminder per standard: protocol/contract → WE, runtime/adapters → FUI; ship a conformance
  demo as the proof.

This epic resolves when all 12 are either carved into owned implementation epics or explicitly retired.
