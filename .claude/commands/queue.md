---
description: Read who's holding/waiting on the heavy-admission pool right now and present it as a table (routes to the queue skill)
---

Invoke the `queue` skill.

Run `node scripts/operations/run.mjs heavy-queue --json` (foreground, read-only) and present `verdict.rows`
as a brief table — RUN/WAIT, lane, who, minutes, kind — followed by the held/cap, waiting count, and
`projectedWaitMinutesForNewJob` headline. Do not add, drop, or reorder rows; if the queue is empty (cap free),
say so in one line instead of an empty table.

$ARGUMENTS
