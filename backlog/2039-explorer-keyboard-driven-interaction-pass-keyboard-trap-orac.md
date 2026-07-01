---
kind: story
size: 5
parent: "1522"
locus: plateau-app
status: active
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
tags: []
---

# Explorer: keyboard-driven interaction pass + keyboard-trap oracle

The walk fires only click/scroll/drag — Tab/Enter/Space are never pressed, so focus order and keyboard activation go untested. Add a keyboard event kind to the driver and a keyboard-trap oracle (Tab cycles without escaping).

## Lineage
Surfaced 2026-07-01 in the first #1522 (Explorer CLI autonomy) goal-completeness pass — the issue-class front is under-decomposed vs the "find every issue on any app" goal; keyboard operability was an unfiled issue-class. Report: [we:reports/2026-07-01-program-explorer-cli-autonomy.md](../reports/2026-07-01-program-explorer-cli-autonomy.md).
