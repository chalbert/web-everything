---
bornAs: xbff6in
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/operations/run.mjs", "we:scripts/operations/operator-queue.mjs", "we:scripts/lane-pool.mjs", "we:scripts/conveyor/status-board.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Start-of-session state pass: one read-only report replaces the eight commands /continue runs by hand

FOUND 2026-09-20. The deployed /continue command (in the operator's home commands directory, 2349 bytes, modified 2026-09-20 08:35) makes the orchestrator open a session by running about eight separate reads by hand: `gh pr list` for web-everything, the same for frontierui, the lane pool status, `claude agents --json` (a session count, before and after the reaper), the session reaper (foreground, timeout 600000, "one gh call per session" by the command's own text; not run here), the operator queue script, the tracker card tail read with `git show origin/lane/mechanical-dispatcher:backlog/3383-...`, and the ranked next item. Read against the code and run live 2026-09-20:
- we:scripts/lane-pool.mjs status prints one line per lane (71 lines today) and has a `--json` mode.
- we:scripts/operations/operator-queue.mjs ran from a lane clone in under one second and prints four fixed sections: NEEDS YOU, PENDING, UNSUPPORTED REPO, NOT READY.
- `claude agents --json` rows carry cwd, id, kind, name, sessionId, startedAt and state, and some rows carry a pid. Today: 42 rows, 33 working, 4 blocked, 3 with no state, 2 done; 11 rows have a pid.
- The reaper is the one step that is NOT a read: it stops sessions. So it cannot live inside a read-only report. It has a `--dry-run` flag (we:scripts/conveyor/session-reaper.mjs).
- `gh pr list` returned no open pull requests in web-everything or frontierui when checked.

OVERLAP, NAMED. #3775 (orchestrator status view) already covers workers by state, pull requests by state with the owed action, background workflow runs and the top planned cards, and it says to reuse we:scripts/conveyor/status-board.mjs and we:scripts/operations/pr-status.mjs. This card is only the smaller delta: the session-start sections #3775 does not list. Those are lane health, the operator queue printed verbatim, the tracker card tail, the review labels and merge state of PRs in each repo, and the split of session rows into live pid versus dead row.

DESIGN TO SETTLE.
1. Extension or new operation. Recommendation: extension. One operation with one pure core, and the session-start sections are a profile of the #3775 view (for example a `--start` flag). A second operation would re-read the same PRs and workers and drift from the first. The cost is that this card cannot ship before the #3775 core exists. If the #3775 design review agrees, fold these sections into #3775 as slices instead of building separately.
2. Reuse, fork nothing. Each section calls the existing script or its pure core: the operator queue output printed verbatim, the lane pool `--json`, the ranked item from the ordered-list card filed alongside (the next item must come from the epic-scoped order, not the whole-board ranker).
3. The reaper stays a separate, explicit, mutating step. The report may show what a `--dry-run` would stop, as a count, but never runs the real pass. Either /continue keeps the reap as its own call, or the reaper is scheduled (#3756) and the report shows the last run.
4. Cost. The report must run in a few seconds: one list call per repo, not one call per PR. A source that fails prints one line naming the section and the reason, never a silent blank.
5. Where the tracker tail comes from: `git show` on the prototype branch (no clone needed), and how many lines.
6. Output shape: fixed section order, under about 40 lines for the 2026-09-20 state, so /continue can print it and reason from it.

## Done when

1. **Executable** — a test runs the operation over fixtures (a stubbed `gh` listing for two repos, a lane pool JSON, agents rows with live-pid and dead rows, an operator queue text, a tracker tail) and asserts one report with every section, under 40 lines, and that its operator queue section equals the script's own output byte for byte.
2. **Executable** — a test proves it writes nothing and runs no mutating command: no `claude stop`, no reaper run without `--dry-run`, no git write.
3. **Executable** — a test makes one source fail (a `gh` error) and asserts that section prints a named "unavailable" line with the reason while the other sections still print and the exit code is 0.
4. **Human verify** — after it lands, the /continue command text calls this one operation instead of listing the eight commands (that edit is tracked by the deployed session command card, #3767).
