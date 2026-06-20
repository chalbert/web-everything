---
kind: task
parent: "991"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: backlog/1039-webcompliance-we-layer-build-own-the-poc-impl-spec-layers-ga.md
tags: []
---

# webcompliance — PoC impl is unowned and disconnected from spec; assess WE-layer completion

webcompliance L2 coverage check (audit section 8): a proof-of-concept impl exists (we:webcompliance/ — gate/waiver/audit/platform-default modules, 10 ts) but is unowned by any backlog item and not linked via relatedProject to the spec; the only owner #966 is a PARKED hosted-product question. The declared spec layers (Gates, Waivers, Audit/Web-Reporting emit, Retrofit existing check:standards/readiness gates as declared policies) have no build item. Assess whether the WE-layer conformance build should be completed/tracked now, or formally parked with a note — separate from the deferred hosted product.

## Progress (batch-2026-06-18)

Triaged. The unowned webcompliance PoC impl (`we:webcompliance/`) + its declared spec layers now have a
WE-layer owning item — scaffolded **#1039** (story·8, tagged `webcompliance`) capturing Gates / Waivers /
Audit-emit / retrofit-existing-gates-as-policies, kept distinct from the parked hosted-product question
#966. Surfacing only: complete-now vs formal-park is a prioritization call left to ranking.
