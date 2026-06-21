---
kind: task
status: resolved
blockedBy: ["1475"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/protocols/analytics-vocabulary.json"
tags: []
---

# Analytics Event Vocabulary — add experiment-exposure event entry (consumed by #1414)

Per #1415 Fork-3 ruling, experiment-exposure (#1414) composes with telemetry by emitting THROUGH the emission seam. Add an experiment-exposed event entry to the existing Analytics Event Vocabulary protocol (we:src/_data/protocols/analytics-vocabulary.json) — a vocabulary addition, not a new protocol or transport. Lets #1414's experiment intent record an exposure as a standard track() call against the existing sink.

## Progress (batch-2026-06-21)

- Added the **Experiment Exposed** event to the Analytics Event Vocabulary — a vocabulary addition over
  the existing `track` sink, not a new protocol/transport (#1415 Fork-3: an exposure IS a `track()`).
- `we:src/_data/protocols/analytics-vocabulary.json` — summary extended to name the Experiment Exposed
  event (experimentId / variant / subjectId) and its compose-through-the-seam rationale.
- `we:src/_includes/project-webanalytics.njk` — new "Experiment Exposure Event" section (#experiment-events)
  with the event table, mirroring the deck-event extension. Verified live: /projects/webanalytics/ renders
  200 with the section + the "Experiment Exposed" row.
- `check:standards` → 0 errors.
