---
kind: task
status: resolved
blockedBy: ["1933"]
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: none
tags: []
---

# Lane scoped fast-fail gate (#1159 --local --files) in the batch orchestrator

Per #1937 (Fork C), wire the lane step of #1933's parallel-batch orchestrator to run check:standards --local --files=<lane's edited files> (the #1159 partition) before pushing lane/*, as a BEST-EFFORT pre-push fast-fail — catches the author's own file-local errors before a wasted push+merge round-trip. NOT the authority (the central full no-flag gate after merge is), NOT a prerequisite for central-gate delivery: skipping it costs only a round-trip. Deliberately omits global-consistency rules (#1159 demotes descriptor.global under --local) so it cannot false-red the #1153 4-of-7 way.

## Outcome (2026-06-28)

The slice rewrites (#1942/#1943) had wired a WE `--local --files` lane gate in, but the
cross-repo extension diverged from Fork C: it ran each impl repo's **full** gate inside the lane
clone and **hard-blocked the push** on *any* repo's red (an "AGGREGATE gate"). A full lane gate
false-reds on cross-lane consistency (#1153), so this could block a legitimate push on a false-red
— exactly what Fork C forbids.

Corrected `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` to the ratified
semantic: the **only** lane gate is the WE scoped `--local --files` best-effort fast-fail (cannot
false-red — global rules demoted to notes). A red there is a real file-local error → fast-fail, push
nothing. Impl repos (frontierui/plateau-app, which have no `--local`/`--files` partition) get **no**
lane gate; their authority is the central per-repo FULL gate after merge, and the impl-first/WE-last
integration order (`integratePrompt` + the `gate !== 'red'` stop at the integrate loop) guarantees a
red impl is caught before WE's resolve lands, so a broken impl is carried, never falsely resolved.
Updated the `gate` field description in `ITEM_RESULT_SCHEMA` and the lane agent's report instruction
to match. `check:standards` green (0 errors); wrapped-syntax check passes. `we:SKILL.md` already
framed the lane gate as WE-scoped, so no change there.
