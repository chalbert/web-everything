---
kind: story
size: 5
parent: "746"
status: open
dateOpened: "2026-06-24"
tags: []
---

# Workbench surfaces per-block conformance status (impl may lag newest standards)

The block workbench/explorer must EXPOSE each block's conformance status against its standard, not only render it — because FUI is an impl that will lag the very newest standards, so a shown block may be partially- or non-conformant. Surface the webcompliance verdict (pass/partial/fail + which vectors/clauses fail) alongside the live stage and author-mode source, so a viewer sees not just what a block looks like but how compliant the current impl is against the standard it claims. Distinct from #1731 (block-shape resolution): this is a conformance-visibility surface on the workbench. Parent #746.
