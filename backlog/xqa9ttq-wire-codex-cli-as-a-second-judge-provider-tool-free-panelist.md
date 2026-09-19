---
kind: story
size: 8
parent: "3369"
status: open
blockedBy: ["3371"]
scope: ["we:scripts/lib/judge-spawn.mjs", "we:scripts/operations/cli-adapter.mjs", "we:scripts/operations/review-dispatch.mjs", "we:scripts/lib/jury-core.mjs"]
dateOpened: "2026-09-09"
tags: []
---

# Wire Codex CLI as a second judge provider (tool-free panelist first)

we:scripts/lib/judge-spawn.mjs's JudgeProvider port (#3370) gets its second real implementation: a Codex CLI provider satisfying the same port shape, per #3371's probe verdict (buildable, with a mandatory schema-transform prerequisite). Concretely: (1) a schema-transform helper that adds every property to 'required' before send (OpenAI structured-output mode 400s otherwise, per #3371 probe 3/4) -- applies only to the Codex path, we:scripts/operations/review-pr.mjs's REVIEW_JUDGE_SHAPE etc. keep their optional-key shapes unchanged for Claude; (2) a Codex-specific spawn module translating argv per #3371's table ('exec --json --output-schema <tempfile>', prompt with explicitly-closed stdin per probe 0's deadlock trap, mandate folded into prompt text since there is no --append-system-prompt equivalent); (3) JSONL output parsing -- last agent_message or the --output-last-message file, terminal status is the LAST event (turn.completed/turn.failed, never the first error per probe 5), null-stripping before we:scripts/lib/jury-core.mjs's normalizeFinding (probe 4); (4) failure-mode mapping -- JudgeTimeoutError maps cleanly via parent-imposed SIGKILL (no CLI timeout flag exists), JudgeBudgetError cannot be built (report costUsd:0, token counts only), the not-logged-in shape is a ~30s retry storm ending in turn.failed matched on a 401 (not a one-line passthrough), invalid_json_schema 400 is a new error class with no Claude counterpart. Per #3581's ratified sequencing, seat the first Codex juror as a TOOL-FREE panelist only (probe 9: no context-strip flag exists for a tool-bearing juror in a lane cwd, since -C always loads we:AGENTS.md) -- do not wire it into a tool-bearing role yet. Wire opt-in provider selection into we:scripts/operations/cli-adapter.mjs's createDefaultJudge, extended to we:scripts/operations/review-dispatch.mjs's fix-dispatch path per #3581's own declared scope.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
