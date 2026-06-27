---
kind: story
size: 3
parent: "1848"
status: open
locus: plateau-app
blockedBy: ["1849"]
dateOpened: "2026-06-27"
tags: [telemetry, enterprise, policy, privacy]
---

# Enterprise telemetry-policy precedence layer (fleet force-off/force-on override)

Roll-under of the enterprise epic #1848; the central policy-precedence layer for dev-metrics consent ratified in #1797. Absent organization policy, the per-developer opt-in default from #1849 applies; an enterprise policy (env var / config file at a precedence the per-dev flag cannot override) can force-off telemetry fleet-wide (the common compliance case) or force-on across machines the organization owns. Precedence order: enterprise policy > per-dev consent > opt-in default. A low-cost server-based / file-based policy distribution mechanism. Decoupled from #1849 so the per-developer channel can ship without waiting on enterprise infrastructure that does not yet exist; this is the first concrete consumer of the #1848 enterprise-policy pattern.
