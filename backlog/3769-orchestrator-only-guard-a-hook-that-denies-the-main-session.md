---
bornAs: xx87ew1
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/guard-orchestrator.mjs", "we:scripts/__tests__/guard-orchestrator.test.mjs", "we:.claude/settings.json"]
dateOpened: "2026-09-20"
tags: []
---

# Orchestrator-only guard: a hook that denies the main session's own edits, commits and mutating shell commands

The operator's standing rule is that the main (orchestrating) session never edits, commits or investigates by itself (we:agent-memory-src/feedback-main-session-no-direct-edits.md for edits and commits, we:agent-memory-src/main-session-delegates-investigation-too.md for reads and status checks: "ask subagent, never you"). It was not followed on 2026-09-20 (operator's report; not re-derived here) because nothing enforces it: it lives only in memory. Edit, Write and the mutating shell commands are script-decidable, so under memory rule 51 (script-decidable becomes a hook, judgment stays in context) they belong in a PreToolUse hook.

FOUND, AND WHERE. (1) The models to copy: we:scripts/guard-lane.mjs (PreToolUse Edit|Write, exit 2 plus a stderr message, fail-open on any internal error, `LANE_GUARD_OFF=1` escape) and we:scripts/guard-bash.mjs (2839 lines, the Bash arm). Both are registered in we:.claude/settings.json. we:scripts/guard-monitor-subagent.mjs is the one guard that already separates subagent calls from main-thread calls, by `event.agent_id`. (2) Golden corpus: we:scripts/golden-corpus/hook-guard-bash/ (42 cases, each `{id, cmd, ctx, basis, expect:{reason}}`) and we:scripts/golden-corpus/hook-guard-lane/ (8 cases), driven by we:scripts/__tests__/golden-corpus-snapshot.test.mjs. (3) Subagent identity: Claude Code's hooks documentation (https://code.claude.com/docs/en/hooks, read 2026-09-20 through a summarising fetch, not against a live payload) says `agent_id` is "present only when the hook fires inside a subagent call. Use this to distinguish subagent hook calls from main-thread calls", and that a hook process inherits the parent environment (except OTEL_* variables, and everything `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` strips). The repo already relies on `agent_id` in we:scripts/guard-monitor-subagent.mjs and we:scripts/guard-stop-passive-wait.mjs. NOT confirmed: that the field is present for every kind of worker this project spawns (a `claude --bg` worker is presumably its own top-level session rather than a subagent, in which case it carries no `agent_id` and only the worker marker can tell it apart; not checked against a live payload). (4) The worker marker: `WE_CONVEYOR_WORKER=1`, set at every spawn site by markWorkerEnv in we:scripts/operations/session-role.mjs (exists on lane/mechanical-dispatcher only, NOT on main yet). Its header says why it is a negative marker: nothing spawns an orchestrator, so nothing could stamp a positive one, and an UNSET variable classifies as orchestrator. That classification cannot be reused as is here, because the acceptance below requires that an unmarked session is never blocked. The header also lists as UNVERIFIED that `claude --bg` hands the CLI's environment to the daemon-spawned session.

PRIOR RULING TO RECONCILE. #2749 (resolved, ratified 2026-07-28) chose to key the main-session guard on the TREE-WRITE and explicitly rejected keying on session identity ("it can't identify the main session — the discriminator resets, #2335"); #2788 built the tree-write backstop in guard-bash. This card does not replace that backstop. It adds an identity-keyed deny that #2749 declined because no identity existed. Two things are new since then: the worker marker, and the documented `agent_id`. Whether that is enough to reopen Fork 2 of #2749, or is a separate layer that leaves it standing, has to be said in the ruling, not assumed here. Related: #2851 (the orchestrator stops the line and never absorbs a case).

DESIGN TO SETTLE.
1. How a session is marked as orchestrator. Options: a marker file keyed by `CLAUDE_CODE_SESSION_ID`, written at the /continue step; a positive environment variable the operator's launch sets; or reading the negative worker marker. The third fails the "unmarked is never blocked" rule on its own. Verify the marker survives to the hook process (documented inheritance, plus the unverified `claude --bg` hand-off).
2. Worker and subagent exemption: deny only when the event has no `agent_id` AND the worker marker is absent AND the positive orchestrator marker is present. Decide what happens when the marker file is stale (a resumed or cleared session id).
3. The denied set: Edit, Write, NotebookEdit, and mutating shell commands (git add, git commit, git push, redirects into files, `sed -i`, `rm`, the file-item and append-note operations, `gh pr create`). Decide whether the shell arm extends we:scripts/guard-bash.mjs or lives in its own script, and how it parses a compound command without re-implementing guard-bash's parser.
4. The message names the dispatch path (which operation or agent to call instead), so a denial teaches, and is not just a wall.
5. The escape hatch: an environment variable like `LANE_GUARD_OFF`, but LOGGED (where, and what the record holds), and never silently sticky.
6. Investigation ("ask subagent, never you") is judgment, not script-decidable: reads and status checks stay ALLOWED. Add only a soft nudge, a warning after N direct investigative calls in one turn. Settle N, what counts as investigative, and how the per-turn counter resets (a UserPromptSubmit hook, or a counter keyed by the transcript).
7. Rollout: ship default-off (no marker means no effect), then have /continue write the marker. Where the we:.claude/settings.json registration lands, given that it is a change to a committed settings file.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/guard-orchestrator.test.mjs we:scripts/__tests__/golden-corpus-snapshot.test.mjs` passes; the new cases fail before this item lands (there is no guard). Golden cases live in `we:scripts/golden-corpus/hook-guard-orchestrator/`, one file per case, same shape as `we:scripts/golden-corpus/hook-guard-bash/`:
   - DENIED, one case each, in a session marked orchestrator with no `agent_id` and no worker marker: Edit, Write, NotebookEdit, git add, git commit, git push, a redirect into a file, `sed -i`, `rm`, the file-item operation, the append-note command, `gh pr create`. Each denial message names the dispatch path.
   - ALLOWED, one case each, in the same marked session: Read, Grep, Glob, git status, git log, git diff, `gh pr view`, `ls`, `cat`.
   - A worker session is never blocked: every denied call above, repeated with `WE_CONVEYOR_WORKER=1`, is allowed; and repeated with an `agent_id` on the event (a subagent), is allowed.
   - An unmarked session is never blocked: every denied call above, with no orchestrator marker, is allowed.
   - A malformed or empty payload is allowed (fail-open), the same as we:scripts/guard-lane.mjs.
   - The escape hatch allows the call and writes exactly one log record naming the session, the tool and the time.
   - The soft nudge: N direct investigative calls in one turn produce a warning on the next one and never a deny; a new turn resets the count.
2. **Probed live** — in a real session marked orchestrator, an Edit and a `git commit` are denied; the same calls made by a subagent it spawns succeed; a session started through the dispatch operation (a `claude --bg` worker) is never blocked. This is the check that the worker marker reaches the hook process, which is still unverified.
3. **Recorded** — the card's resolution says whether this reopens Fork 2 of #2749 or stands beside it, and cites the hooks documentation lines on `agent_id`.
