---
type: issue
workItem: task
parent: "570"
status: open
blockedBy: ["571"]
dateOpened: "2026-06-14"
tags: []
---

# webcharts slice c — CustomChartRenderer protocol

Slice c of #570 (webcharts scaffold). Add the CustomChartRenderer protocol to src/_data/protocols.json (shape per anchor-positioning: id/name/summary/status/ownedByProject=webcharts/anchor) and author its normative body as the matching `<section id=protocol-custom-chart-renderer>` in src/_includes/project-webcharts.njk — the renderer-swap registry contract, native-first SVG default, and tiered-conformance framing. The anchor section must exist in the partial or check:standards errors. Leaves the protocol visible on /protocols/; check:standards green. Blocked by #571 (project must exist for ownedByProject + the anchor section's home).
