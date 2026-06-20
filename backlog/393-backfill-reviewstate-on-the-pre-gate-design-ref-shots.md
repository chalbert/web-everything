---
kind: task
parent: "382"
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: none
tags: []
---

# Backfill reviewState on the pre-gate design-ref shots

The 14 screenshots captured before the inclusion gate shipped carry no reviewState and show as 'ungated' in the gallery. Add readySelectors to the remaining targets where a reliable app-surface signal exists, then re-run design-refs collect --refresh so each shot is re-evaluated and stamped confirmed/ungated, backfilling the field.
