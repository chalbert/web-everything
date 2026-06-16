---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["706"]
dateOpened: "2026-06-16"
tags: []
---

# Build FUI block-catalog: completeness gate + fill authored entries + render /blocks/ from manifest

Execute the #706 ruling for FUI. Add a check-standards completeness invariant that FAILS if any implemented blocks/ family (24 dirs) has zero entries in src/_data/blocks.json — mirroring check-demos' every-folder-registered rule. Fill the ~17 missing authored entries (curated summary/type/protocol/weSpecPath) so 7/24 coverage becomes complete-by-gate. Render FUI's own /blocks/ catalog (frontierui/src/blocks.njk) from the manifest via WE's authored->CEM path (#626), no parallel analyzer. Document derivation-source as a supported dimension in the Web Docs standard (authored=default/reference; impl-scan=opt-in). WE never renders these blocks; #701 fuiDemo iframe owns demo embedding.
