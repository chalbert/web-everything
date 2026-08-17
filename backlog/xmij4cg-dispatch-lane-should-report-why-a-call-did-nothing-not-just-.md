---
kind: task
status: open
parent: "3029"
tags: [operations, epic-3029, orchestration-load, dispatch-lane]
dateOpened: "2026-08-17"
---

# dispatch-lane should report why a call did nothing, not just a bare non-dispatch JSON blob

`dispatch-lane` already computes a genuinely useful reason internally when a call doesn't dispatch (e.g.
`"this operation already has a dispatch in flight for #NNNN... nothing could establish whether its agent is
alive"`) — it's present in the JSON verdict, but reaching it means a human (or an orchestrating session)
has to parse the whole run-record JSON by hand every single time, rather than the CLI printing it directly.
Observed repeatedly on 2026-08-17: calling `dispatch-lane --num=NNN` for an item already dispatched earlier
in the same session returns a payload requiring the exact same manual `python3 -c "json.load(...)"` parse
each time to confirm it actually is already running rather than silently doing nothing.

## Done when

1. **Executable** — a non-dispatching `dispatch-lane` CLI call prints a one-line human-readable reason to
   stdout (in addition to the full JSON with `--json`), so a caller doesn't need to parse the run record to
   know whether "nothing happened" means "already in flight," "held on a stale blocker," or a genuine error.
