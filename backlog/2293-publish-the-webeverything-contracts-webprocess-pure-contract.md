---
kind: task
parent: "1294"
status: open
dateOpened: "2026-07-06"
relatedReport: reports/2026-07-05-backlog-split-analysis.md
tags: [constellation-placement, reference-runtime, webprocess, relocation]
---

# Publish the @webeverything/contracts/webprocess pure-contract entry

Add the type-only contract barrel we:contracts/webprocess.ts (export type * from ../process/contract) plus the FUI tsconfig path, mirroring we:contracts/webcompliance.ts — the FUI→WE arrow the relocated webprocess runtime imports. First slice of the process relocation cascade under #1294.
