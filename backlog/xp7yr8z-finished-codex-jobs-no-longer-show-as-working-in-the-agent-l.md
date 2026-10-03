---
kind: story
size: 2
status: open
scope: ["we:scripts/operations/agent-activity.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Finished Codex jobs no longer show as working in the agent listing

Live 2026-10-03: the WIP feed returned 622 job rows of which about 8 were live; about 30 finished Codex jobs read as working because of an ordering bug in how job rows are merged, and claude agents still lists 15 sessions as working that are 17-30 days old. Fix the row ordering so a job's latest terminal state wins, and age out sessions with no transcript activity. Files: the agent-activity producer under we:scripts/operations/ (find the job-row merge), with a test replaying a finished job followed by an older running row.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
