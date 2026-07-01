---
kind: story
size: 3
parent: "1522"
status: active
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
tags: []
---

# Explorer: broken-link / 4xx oracle

The collector records only 5xx; 404s and other 4xx are dropped. Add a 4xx/broken-link finding (or a same-origin link check) so broken links surface.

## Lineage
Surfaced 2026-07-01 in the first #1522 (Explorer CLI autonomy) goal-completeness pass — broken-link/4xx was an unfiled issue-class (collector records only 5xx). Report: [we:reports/2026-07-01-program-explorer-cli-autonomy.md](../reports/2026-07-01-program-explorer-cli-autonomy.md).
