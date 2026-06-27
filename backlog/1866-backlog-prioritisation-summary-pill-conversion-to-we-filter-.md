---
kind: decision
parent: "777"
status: open
dateOpened: "2026-06-27"
tags: []
---

# Backlog Prioritisation summary-pill conversion to we-filter-chip — lossy structured-count tradeoff

Sub-fork blocking #1825: the /backlog/ Prioritisation summary data-pfilter pills (batchable/agent-ready/epics/program/decision/not-ready) carry a distinct semantic background colour + a rich structured count (nested colour-coded sub-spans: in-flight/to-split/prepared/preparing). we-filter-chip rebuilds the button from flattened textContent + a single scalar count, destroying that inner structure — lossy, conflicting with #1825's 'exactly as before' acceptance. Decide: (1) scope #1825 to the plain filter chips (faithful now) + carve the summary-pill conversion to a follow-up; (2) extend we-filter-chip to carry rich/structured counts; (3) accept the lossy flatten. The plain status/kind/size/tier/readiness chips are a clean swap regardless. Blocks #1825.
