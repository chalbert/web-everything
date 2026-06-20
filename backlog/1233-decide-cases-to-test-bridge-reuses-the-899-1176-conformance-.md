---
type: decision
workItem: story
size: 3
status: open
dateOpened: "2026-06-20"
tags: []
---

# Decide: cases-to-test bridge reuses the #899/#1176 conformance-vector driver, or a separate WE-side mechanism

The cases-to-test bridge (we:webcases/compileRequirement.ts produces the `<!-- assert: protocol/observe/tier/kind -->` directive; nothing consumes it yet) overlaps the #899/#1176 behavioral-conformance-vector driver (fui:tools/explorer/oracles/conformanceVectors.ts — runner + judge + clock). A bridge that drives a component and checks the named observable at its tier IS what that driver already does. So before #1162 (Cases Spec completion) builds the bridge, decide: **reuse** the FUI-owned vector driver (one runner, two front-ends — an assert-directive front-end and the vector-suite front-end, joined by a contract seam since the driver is FUI-owned per #899 Fork-1 and the bridge is WE-layer webcases) or build a **separate** WE-side bridge mechanism. The WE/FUI boundary bites: a reuse path needs a contract seam, not a direct import. Carved out of #1162 (which is blocked on this); surfaced in batch-2026-06-20.
