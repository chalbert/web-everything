---
kind: task
status: open
blockedBy: ["1475"]
dateOpened: "2026-06-21"
tags: []
---

# Analytics Event Vocabulary — add experiment-exposure event entry (consumed by #1414)

Per #1415 Fork-3 ruling, experiment-exposure (#1414) composes with telemetry by emitting THROUGH the emission seam. Add an experiment-exposed event entry to the existing Analytics Event Vocabulary protocol (we:src/_data/protocols/analytics-vocabulary.json) — a vocabulary addition, not a new protocol or transport. Lets #1414's experiment intent record an exposure as a standard track() call against the existing sink.
