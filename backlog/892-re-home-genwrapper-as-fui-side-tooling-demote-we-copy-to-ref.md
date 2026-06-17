---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["855"]
dateOpened: "2026-06-17"
tags: []
---

# Re-home genWrapper as FUI-side tooling + demote WE copy to reference fixture; correct #821/#753 framing

Ratified by #855 (B2): the generator is impl/tooling, not a @webeverything standard. genWrapper lives in webeverything/scripts/gen-wrapper (#821). Re-home generation ownership to FUI, which runs a generator over WE's published CEM. Demote the WE-side copy to a reference generator / conformance fixture subordinate to the CEM (the #461 fetchHandler 'reference impl, not the definition' pattern), or move it out of @webeverything per #507. Correct the #821/#753 framing. Boundary invariant: only the CEM contract crosses WE→FUI; codegen never ships as a WE standard.
