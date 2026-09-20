---
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/review-dispatch.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Hand dispatch must carry out the brief, and every dispatch must subscribe to an idle notice

FOUND 2026-09-20. (1) Hand dispatches used the prompt Read <brief>. Two sessions (wip-honest-remedy, reaper-split) read the brief and stopped: they treated it as data, not an instruction, and sat idle for hours while the orchestrator reported one as working. Earlier workers happened to carry on with the same prompt, so this is intermittent. Fix: every background dispatch prompt states that the brief IS the instruction and to carry it out completely, including the result file; the template used since is in the handoff. we:scripts/operations/dispatch-lane-io.mjs and we:scripts/operations/review-dispatch.mjs already build a full brief for their own launches; the hand path is the gap. (2) Sessions started with claude --bg never wake the orchestrator. SendMessage with notify_when_idle true gives one idle-or-exit notice; the dispatch step must subscribe automatically right after every spawn. (3) The dispatch scripts refuse a lane cwd and a checkout behind origin/main (the primary checkout was 151 commits behind), so a maintained fresh dispatch clone is needed, with a refresh step. DESIGN TO SETTLE: where the prompt template lives (one shared function), whether the subscription is made by the orchestrator harness or the dispatcher, and how a session that is idle but not done (blocked at a prompt) is told apart. ACCEPTANCE: a test asserts every launch prompt contains an execute instruction; a dispatch is followed by a subscription; a dispatch from a stale or lane cwd fails with the refresh hint.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
