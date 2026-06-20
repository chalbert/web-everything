---
type: idea
workItem: story
size: 3
parent: "1038"
status: open
blockedBy: []
dateOpened: "2026-06-20"
tags: []
relatedProject: webcases
---

# Cases Spec completion — case-to-test bridge conformance + validator coverage

WE-layer Cases Spec (webcases) completeness on the existing we:webcases/ surface (we:webcases/requirementValidator.ts #100, we:webcases/compileRequirement.ts #797): close case-structure-validation + case-to-test bridge conformance coverage. Child of the #1038 webdocs spec-surface epic. The then.observe observable-state grounding gap is carved to decision #1160 (blocker), not bundled here. Demo: webcases conformance suite green.

## Surfaced fork (batch-2026-06-20)

The "case-to-test bridge" has **no implementation yet** — only `we:webcases/compileRequirement.ts` *produces* the `<!-- assert: protocol/observe/tier/kind -->` directive (the `kind` token was added by #1201 so the bridge can read-a-state vs await-an-event); nothing *consumes* it. A bridge that drives a component and checks the named observable at its tier **overlaps the #899/#1176 behavioral-conformance-vector driver** (`fui:tools/explorer/oracles/conformanceVectors.ts` — runner + judge + clock, built this same batch). So before building, an open design question: does the bridge **reuse** that vector driver (one runner, two front-ends — an assert-directive front-end and the vector-suite front-end) or stay a **separate** WE-side mechanism? The WE/FUI boundary bites here too (the driver is FUI-owned per #899 Fork-1; the bridge is WE-layer webcases), so a reuse path needs a contract seam, not a direct import. Likely a `type:decision` (bridge-vs-driver unification) before this builds.
