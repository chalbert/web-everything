---
bornAs: xqa9ttq
kind: story
size: 8
parent: "3369"
status: resolved
blockedBy: ["3371"]
scope: ["we:scripts/lib/judge-spawn.mjs", "we:scripts/operations/cli-adapter.mjs", "we:scripts/operations/review-dispatch.mjs", "we:scripts/lib/jury-core.mjs"]
dateOpened: "2026-09-09"
dateStarted: "2026-09-21"
dateResolved: "2026-09-21"
graduatedTo: none
tags: []
---

# Wire Codex CLI as a second judge provider (tool-free panelist first)

we:scripts/lib/judge-spawn.mjs's JudgeProvider port (#3370) gets its second real implementation: a Codex CLI provider satisfying the same port shape, per #3371's probe verdict (buildable, with a mandatory schema-transform prerequisite). Concretely: (1) a schema-transform helper that adds every property to 'required' before send (OpenAI structured-output mode 400s otherwise, per #3371 probe 3/4) -- applies only to the Codex path, we:scripts/operations/review-pr.mjs's REVIEW_JUDGE_SHAPE etc. keep their optional-key shapes unchanged for Claude; (2) a Codex-specific spawn module translating argv per #3371's table ('exec --json --output-schema <tempfile>', prompt with explicitly-closed stdin per probe 0's deadlock trap, mandate folded into prompt text since there is no --append-system-prompt equivalent); (3) JSONL output parsing -- last agent_message or the --output-last-message file, terminal status is the LAST event (turn.completed/turn.failed, never the first error per probe 5), null-stripping before we:scripts/lib/jury-core.mjs's normalizeFinding (probe 4); (4) failure-mode mapping -- JudgeTimeoutError maps cleanly via parent-imposed SIGKILL (no CLI timeout flag exists), JudgeBudgetError cannot be built (report costUsd:0, token counts only), the not-logged-in shape is a ~30s retry storm ending in turn.failed matched on a 401 (not a one-line passthrough), invalid_json_schema 400 is a new error class with no Claude counterpart. Per #3581's ratified sequencing, seat the first Codex juror as a TOOL-FREE panelist only (probe 9: no context-strip flag exists for a tool-bearing juror in a lane cwd, since -C always loads we:AGENTS.md) -- do not wire it into a tool-bearing role yet. Wire opt-in provider selection into we:scripts/operations/cli-adapter.mjs's createDefaultJudge, extended to we:scripts/operations/review-dispatch.mjs's fix-dispatch path per #3581's own declared scope.

## Verification (2026-09-21) — what landed, what was split out, what belongs to the prototype branch

Checked clause by clause against `origin/main` (`e71426493`) in lane-12. Landed by PR #2115 (the provider, merged 2026-09-19) and PR #2117 (the opt-in review seat, merged 2026-09-19). The scope line above names `we:scripts/lib/judge-spawn.mjs` and `we:scripts/lib/jury-core.mjs`; neither was edited, and the work lives in `we:scripts/lib/codex-judge-spawn.mjs` on purpose (its header records the import-graph reason).

| Clause | Evidence on main | Done |
| --- | --- | --- |
| 1. Schema transform, Codex path only | `requireAllProperties` (`we:scripts/lib/codex-judge-spawn.mjs:122`); applied at the provider boundary in `resolveJudgeProvider` (`we:scripts/operations/cli-adapter.mjs:557`), so `REVIEW_JUDGE_SHAPE` is untouched for Claude; tests in `we:scripts/lib/__tests__/codex-judge-spawn.test.mjs`, describe `#xqa9ttq requireAllProperties` (8 cases, including enum and null widening) | yes |
| 2. Spawn module: argv, closed stdin, mandate folded into the prompt | `buildCodexJudgeArgv` (`:330`, `exec --json --output-schema`, no positional prompt), `buildCodexPrompt` (`:375`), `child.stdin.end(prompt)` (`:626`); tests `has NO POSITIONAL PROMPT`, `closes stdin via .end()` | yes |
| 3. JSONL parse: last message, last event, null strip | `parseCodexJudgeOutcome` (`:416`), `stripNulls` (`:190`); tests `probe 7: falls back to the LAST agent_message`, `probe 5: the TERMINAL event is the LAST one`, `probe 4 shape: strips nulls` | yes |
| 4a. Timeout via parent SIGKILL | `codexJudgeSpawn` (`:602-614`, `:638-641`); tests under `a juror that hits the wall` | yes |
| 4b. Budget cannot be built: report `costUsd: 0` | `:488` (`costUsd: 0`), `budget` accepted and ignored (`:516-519`); test `returns the thread_id as sessionId, costUsd 0` | yes |
| 4c. Not-logged-in: a ~30s retry storm ending in `turn.failed`, matched on a 401 | `parseCodexJudgeOutcome` (`:442-454`) throws one generic `Error` with the CLI's words; the only test (`:167-176`) checks the text contains `401 Unauthorized`. No 401 match, no distinct class | **no** — split out (below) |
| 4d. `invalid_json_schema` 400 as a new error class | `CodexInvalidSchemaError` (`:285`), `parseInvalidSchemaError` (`:391`), thrown at `:445`; test `probe 3: invalid_json_schema 400 is a NEW error class` | yes |
| Tool-free panelist only | `assertNoCodexTools` (`:305`); the same refusal in `createDefaultJudge` (`we:scripts/operations/cli-adapter.mjs:607`); tests `refuses a tool-bearing request before ever spawning`, `refuses any non-empty tool list` | yes |
| Opt-in provider selection in `createDefaultJudge` | `JUDGE_PROVIDER_NAMES` (`we:scripts/operations/cli-adapter.mjs:72`), per-request `providerName` pin (`:607` on); `we:scripts/operations/__tests__/judge-provider-selection.test.mjs` (29 tests) and `we:scripts/operations/__tests__/juror-flags.test.mjs` (26 tests) | yes |
| Seat the first Codex juror as a review panelist | `ADVISORY_JUDGE_SEAT` (`we:scripts/operations/review-pr.mjs:324`), `CODEX_ADVISORY_ENV_VAR = 'REVIEW_PR_CODEX_ADVISORY'` (`:338`), `reviewPrOperation({ codexAdvisory })` (`:1352`), bound in `we:scripts/operations/run.mjs:98-109`; resume reads the saved roster (`we:scripts/operations/record-verdict-io.mjs:274`, tests `PR #2117 review` in `we:scripts/operations/__tests__/record-verdict-cli.test.mjs`) | yes |
| "Extended to the fix-dispatch path of `we:scripts/operations/review-dispatch.mjs`" | Refused on purpose: `TOOL_FREE_ONLY_JUDGE_PROVIDERS = ['codex']` (`we:scripts/operations/review-dispatch.mjs:169`) makes `dispatchReview` throw for `judgeProvider: 'codex'` (`:449`), because every judge step a dispatched review runs is tool-bearing. A tool-free judge cannot fix anything. The write-capable Codex fix path exists only on the prototype branch (see the last section) | not on main, not owed to this card |

Tests run on the lane checkout of main: `npx vitest run we:scripts/lib/__tests__/codex-judge-spawn.test.mjs we:scripts/lib/__tests__/codex-judge-spawn.integration.test.mjs we:scripts/operations/__tests__/judge-provider-selection.test.mjs we:scripts/operations/__tests__/juror-flags.test.mjs we:scripts/operations/__tests__/record-verdict-cli.test.mjs` gave 5 files passed, 125 tests passed, 3 skipped. The 3 skipped are the live suite in `we:scripts/lib/__tests__/codex-judge-spawn.integration.test.mjs`, opt-in behind `WE_CODEX_JUDGE_SPAWN_LIVE=1`; it was not run here (it spawns a real Codex process on the operator's subscription).

**Classification: partial, resolved with the remainder filed.** The one clause still unmet on main, 4c, is filed as `#xoyzend` (a task under #3369, with an executable Done-when). The `blockedBy: ["3371"]` edge was already stale: #3371 resolved on 2026-09-11.

**Fix-dispatch clause, on the prototype branch only.** The write-capable Codex provider for the build, fix and ci-heal dispatch kinds is on `origin/lane/mechanical-dispatcher`, not on main: `we:scripts/operations/codex-delivery-provider.mjs`, `we:scripts/operations/fix-dispatch-wrapper.mjs` (`FIX_CODEX_PROVIDER`) and `we:scripts/operations/ci-heal-dispatch-wrapper.mjs` (`CI_HEAL_CODEX_PROVIDER`). Its graduation belongs to #3443 and #3580, and #3630 records the file list. Nothing further is owed to this card.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/codex-judge-spawn.test.mjs we:scripts/operations/__tests__/judge-provider-selection.test.mjs we:scripts/operations/__tests__/juror-flags.test.mjs we:scripts/operations/__tests__/record-verdict-cli.test.mjs` passes (verified 2026-09-21: 4 files, 124 tests). The 401 classification, the only clause not covered, is `#xoyzend`. (The `we:` prefix is the backlog's locus marker; drop it when typing the command.)
