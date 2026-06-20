---
type: issue
workItem: story
size: 5
status: open
dateOpened: "2026-06-20"
tags: []
---

# Demo surface reframe — conformance = project-strength status page; /demos/ = WE protocols in real action

Today /demos/ conflates two surfaces: conformance playgrounds (headless proofs a standard is satisfied) and real showcases. Per #1078, conformance is better framed as a project-**strength status** surface (protocols live, tests green, vectors covered) — not a "demo". Visitors to /demos/ expect WE protocols in **real action** (compelling, real-usage showcases), not a conformance checklist. The data model already marks `kind:playground` vs showcase (`we:docs/agent/demo-workflow.md`). Split them: route playgrounds into a status/health view advertising WE's strength; reserve the /demos/ index for real-action showcases. Touches `we:demos.json`, the /demos/ index template, a new conformance-status surface, `we:docs/agent/demo-workflow.md`. Surfaced from #1078.
