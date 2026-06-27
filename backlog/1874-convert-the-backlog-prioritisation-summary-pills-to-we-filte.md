---
kind: story
size: 3
parent: "777"
status: resolved
blockedBy: ["1873"]
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: none
tags: []
---

# Convert the /backlog/ Prioritisation summary pills to we-filter-chip (rich-count, faithful)

Convert the six /backlog/ Prioritisation summary pills (data-pfilter: batchable / agent-ready / epics / programs / decision / not ready, we:src/backlog.njk:398-401) to we-filter-chip, faithfully preserving each pill's semantic background colour and its rich colour-coded sub-counts (e.g. prepared / in-flight / preparing). Blocked on #1873 (the rich structured-count + colour-variant API); the component cannot represent them today — decorate() clobbers el.innerHTML. Carved from #1866 as the deferred, fully-recoverable half of #1825's filter-chip migration; completes the #777 dogfood of the Prioritisation row. Locus: we.
