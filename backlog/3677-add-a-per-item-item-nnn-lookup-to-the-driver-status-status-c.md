---
bornAs: xuwbjb4
kind: task
parent: "3383"
status: open
scope: ["we:scripts/conveyor/driver-status.mjs", "we:scripts/conveyor/__tests__/driver-status.test.mjs"]
dateOpened: "2026-09-14"
tags: []
---

# Add a per-item --item=NNN lookup to the driver-status status command

we:scripts/conveyor/driver-status.mjs (#3521/PR #2196) shows overall driver status, the self-diagnosed stall list, and the last N raw decision-trace lines — but has no way to answer "what is item #X doing right now" for a non-stalled item without hand-grepping we:.conveyor/decision-trace/<date>.jsonl. Add an --item=NNN flag that filters todays (and optionally recent) decision-trace file for that items num field, cross-checks the stall list, and prints one clean per-item summary (last known decision, timestamp, whether currently stalled).

## Done when

1. **Executable** — `node we:scripts/conveyor/driver-status.mjs --item=<NNN>` prints a clean per-item
   summary (last known decision, its timestamp, and whether the item is currently self-diagnosed
   stalled) derived from today's `we:.conveyor/decision-trace/<date>.jsonl` and the stall list in
   `we:.conveyor/driver-status.json` — verified against a fixture trace file with a known entry for
   that item's `num`. Today the flag does not exist: `--item` is silently ignored by
   `we:scripts/conveyor/driver-status.mjs`'s flag parser, and there is no per-item summary at all.
2. Passing `--item=NNN` for an item with no trace entries in the scanned window prints a clear
   "nothing found" result rather than an empty/silent success.
