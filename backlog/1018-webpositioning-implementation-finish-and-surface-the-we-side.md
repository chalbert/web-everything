---
type: idea
workItem: epic
parent: "1008"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webpositioning implementation — finish and surface the WE-side anchor-positioning seam

Implementation epic for the webpositioning standard (anchor-positioning / responsive placement). Design lineage: #014 / #467 / #508. Partial, not zero — the anchor-positioning protocol is already built in FUI (fui:blocks/droplist/positioning/); this epic completes and surfaces the WE-side seam (contract to @webeverything, runtime stays FUI), not a build-from-scratch. Carved from the #1008 concept-to-built triage roadmap.

**Sliced** into the contract/provider/demo trio: #1048 (contract → @webeverything), #1049 (finish/surface the seam over the FUI runtime, blockedBy #1048), #1050 (conformance demo, blockedBy #1048). #1049 and #1050 proceed in parallel after #1048.
