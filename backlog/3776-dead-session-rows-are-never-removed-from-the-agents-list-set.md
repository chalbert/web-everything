---
bornAs: x9e1zpy
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/conveyor/session-reaper.mjs", "we:scripts/conveyor/session-reap-stop.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Dead session rows are never removed from the agents list: settle how rows leave, who may delete, and whether the operator must rule

FOUND 2026-09-20. After the reaper ran (714 sessions listed, 569 stopped, 145 kept), `claude agents --json` still listed 38 rows, 31 working but only 7 with a pid. That is the operator's 18:37 ET reading, recorded in the epic's tracker note; it was not re-run here. Re-read live now: 42 rows, 33 working, 4 blocked, 3 with no state, 2 done; 11 rows have a pid. So the list has not shrunk.

Read in code and help text, 2026-09-20:
- #3744 (built on the prototype branch as commits e0165b4e9 and 5258a5cb7, not on main) makes the reaper confirm a stop against a re-read registry and never re-stop a done, stopped or failed row. Its tracker note says the reaper no longer clears those rows, and that `claude rm` is not used by the reaper. So nothing removes a row today.
- `claude rm <id>` exists. Its help reads: "Delete a background session and its worktree. Unlike `stop`, works on already-exited sessions", with the flags `--discard-unpushed <commit>@<worktree-id>` and `--force-remove-worktree <worktree-id>` for a worktree that holds unpushed work or cannot be removed. It was NOT run (help text only). Not verified: whether it also deletes the session's transcript, and whether the row then leaves `claude agents --json`.
- The reaper's planner header on the prototype branch (we:scripts/conveyor/session-reap-plan.mjs) says the registry is the harness's, not this repository's; the repository only reads it or asks the CLI to mutate it. It also says a null pid is the normal shape of a background row and that liveness comes from a process-list scan for the session id. So "no pid" alone is a hint and not proof that a row is dead, and the "only 7 with a live pid" figure is a hint too.
- The 5 second confirmation wait (`STOP_CONFIRM_WAIT_MS` is 5000 in we:scripts/conveyor/session-reap-stop.mjs on the prototype branch) has not been tried against the live listing lag; the tracker note says the fix "was not run against the live registry".

OVERLAP, NAMED. #3744 covers verifying a stop and explicitly does not remove rows. #3756 covers scheduling the reaper and alerting when the runner is down. #3470 (resolved) fixed stopping by the short id. This card is only the delta: how rows leave the list at all.

DESIGN TO SETTLE.
1. The mechanism. (a) The reaper calls `claude rm <short id>` on rows it has confirmed terminal or dead. (b) Nothing: rows age out upstream (the reaper header records upstream lag issues), and the list is only ever read with a dead-row filter. (c) Cleaning the registry files directly: not this repository's data, and the one existing repair (we:scripts/operations/clear-stuck-session.mjs, a directory move) needs a human confirm. Try (a) on one throwaway finished session first and record what it removes.
2. What counts as dead for removal. A terminal state (done, stopped, failed) is safe. A row that says working but has no process is riskier: it needs the process-list check plus the ground-truth or verdict axes the reaper already has, never a missing pid alone.
3. Who may delete, and the data loss. `claude rm` removes the session and its worktree, and the worktree may hold unpushed commits. Options: the reaper removes only rows with no worktree or a clean, pushed one, never passes `--discard-unpushed` or `--force-remove-worktree`, and lists everything else for the operator. Settle whether the operator must rule once on that standing rule (a decision card) or approve per run.
4. Order with #3744 and #3756: removal follows a confirmed stop, and a scheduled reaper means removal is scheduled too, so the rule must be safe with nobody watching.
5. The report: a separate `removed` count, and the row count after the run equal to the rows kept.

## Done when

1. **Executable** — a test with a stubbed `claude` CLI: a done row with a clean, pushed worktree is removed with `rm <short id>`; a row with unpushed commits is not removed and is named in the report; the flag `--discard-unpushed` never appears in any call.
2. **Executable** — the summary line carries a removed count, and the row count after the run equals the rows kept.
3. **Human verify** — one real `claude rm` on a single finished throwaway session, with its output pasted into the card, before the pass is enabled; the 5 second wait compared with the live listing lag.
4. **Human verify** — the operator's ruling is recorded if the design says one is needed.
