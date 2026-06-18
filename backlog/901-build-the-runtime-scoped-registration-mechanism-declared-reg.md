---
type: issue
workItem: story
size: 8
parent: "076"
status: open
blockedBy: ["900"]
dateOpened: "2026-06-18"
tags: []
---

# Build the runtime scoped-registration mechanism (declared-registry Tier-1.5 form + binding behavior + moment-2 scoped define)

Implements the #854 ruling: scoped registration is a RUNTIME declared-registry + binding-behavior model, off `<component>`. Build: (1) the Tier-1.5 no-build declared-registry form (mirrors #278's injector script, within #279's shipped ceiling); (2) a CustomAttribute binding-behavior that resolves the registry ref (local IDREF primary, `{{expr}}` bridge for raw foreign objects) and scoped-defines at MOMENT 2 (dom-less declaration registration), via an explicit scan with lazy-queue pending semantics; (3) the consumption-side `shadowrootcustomelementregistry`/`attachShadow` map-through. Reuses webregistries, the #242 seam, #228. The keyword DSL stays Tier-3 per #279 — not built here.
