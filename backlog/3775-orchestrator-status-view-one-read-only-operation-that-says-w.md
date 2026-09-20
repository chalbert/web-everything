---
bornAs: xyzbwsw
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/operations/run.mjs", "we:scripts/conveyor/status-board.mjs", "we:scripts/operations/pr-status.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Orchestrator status view: one read-only operation that says what is building, what is stuck, and what is next

FOUND 2026-09-20. Operator: "tell me what is building and next without passing by wip because very unhelpful as is." Today the orchestrator answers "what is building and what is next" with several manual reads: claude agents --json (confirmed live today: 43 rows, 33 reported working, and the rows carry only id, cwd, kind, startedAt, sessionId, name and state, so there is no last-activity or pid field to tell a live worker from a dead one; the orchestrator reports many of the working rows are dead, not independently confirmed here), the worker result files in the operator jobs directory, open pull requests in three repos, review labels, the tracker card, and the planned cards. An idle notice is not proof a worker finished: two workers went idle at a prompt and were still counted as working, so done must be cross-checked against the worker's result file. The 2026-09-20 batch also cost about 36k tokens per finished-worker check when a read-only agent did it by hand. DESIGN: ONE read-only operation for the orchestrator (not the operator's wip prompt) that prints in a few lines: workers running / idle-and-done / idle-and-stuck; pull requests by state with the owed action; background workflow runs and whether each is alive (see the background-workflow-liveness card filed alongside this one); the top planned cards. REUSE, DO NOT FORK: we:scripts/conveyor/status-board.mjs already renders the conveyor lane picture as text (a pure formatter over the conveyor state, on main); we:scripts/operations/pr-status.mjs already answers per-PR check state on main; the wip card 3736 owns the compact top-planned table and the track epic owns the unified planned list, so this view calls those, it does not re-derive them. DESIGN TO SETTLE: (1) where worker liveness comes from when claude agents --json has no activity field (result file present, transcript mtime, or a heartbeat convention from the dispatch card); (2) the exact rule for idle-and-done versus idle-and-stuck; (3) whether it is a declared operation (we:scripts/operations/run.mjs) with a pure core and an IO shell like its neighbours; (4) how it stays cheap enough to run on every orchestrator turn. ACCEPTANCE: run against a fixture of agent rows plus result files it classifies a worker with a result file as done and an idle worker without one as stuck; it prints under 15 lines for the 2026-09-20 fixture; a test proves it makes no writes and shells no mutating command.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
