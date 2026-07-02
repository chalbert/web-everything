---
kind: story
size: 3
status: open
dateOpened: "2026-07-02"
tags: []
---

# Split the FUI blocks/view directive registry to per-entry self-registration (mirror #1145/#1146) so directive items stay concurrent-and-merge-clean

Evidence from batch-2026-07-01-wf (2nd real multi-lane /workflow run): 3/6 concurrent items merge-failed at the central gate; #2068 and #2012 overlap the FUI directive cluster on frontierui:blocks/view/registerViewDirectives.ts and frontierui:blocks/view/index.ts (both hand-edited barrels — a templates.define() list plus an export list) shared with serial items #2075/#2076, so the probe under-predicted the shared-barrel touch and the partition ran them concurrent then conflict then gate-red then reopened. Fix: apply the same per-entry split #1145/#1146 did for the WE registries — each directive self-registers in its own file and the barrel is generated (glob) — so a new or edited directive writes ONLY its own file (disjoint) and directive-touching items stay concurrent AND merge clean, strictly better than co-serializing. Ties into the export-shape/barrel track #1164. The orchestrator self-heal (reopen plus ref-preserve) worked; this is partition-quality, not a correctness hole.
