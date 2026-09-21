---
kind: task
parent: "3369"
status: open
scope: ["we:scripts/lib/codex-judge-spawn.mjs", "we:scripts/lib/__tests__/codex-judge-spawn.test.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Classify a Codex not-logged-in turn.failed (401) as its own auth error, distinct from a juror failure

we:scripts/lib/codex-judge-spawn.mjs turns a Codex turn.failed into a generic Error carrying the CLI words verbatim (we:scripts/lib/codex-judge-spawn.mjs parseCodexJudgeOutcome, the "the juror failed" throw). #3371 probe 5 found the not-logged-in shape is a ~30s retry storm ending in turn.failed whose message carries "unexpected status 401 Unauthorized"; #3704 asked that this be matched on the 401, not passed through as one more juror failure. Today a caller cannot tell "Codex is not logged in" from "the model gave a bad answer" without regex on the message. Add a CodexAuthError class (mirroring CodexInvalidSchemaError) thrown when the LAST turn.failed message matches a 401 Unauthorized status, keep every other turn.failed as-is, and export it. Split out of #3704 when its verification found every other clause landed (PRs #2115, #2117).

## Done when

1. **Executable** — from the repo root, `node -e "import('we:./scripts/lib/codex-judge-spawn.mjs').then(m => process.exit(typeof m.CodexAuthError === 'function' ? 0 : 1))"` exits 0 (it exits 1 today, because `CodexAuthError` is not exported), and `npx vitest run we:scripts/lib/__tests__/codex-judge-spawn.test.mjs` passes. (The `we:` prefix is the backlog's locus marker; drop it when typing the command.)
2. A test in `we:scripts/lib/__tests__/codex-judge-spawn.test.mjs` feeds `parseCodexJudgeOutcome` the probe 5 stream (two `error` retry lines, then a `turn.failed` whose message reads `unexpected status 401 Unauthorized: Missing bearer or basic authentication in header`) and expects a `CodexAuthError` (`name === 'CodexAuthError'`, the CLI's own message kept verbatim on `.message`). The existing test `probe 5: the TERMINAL event is the LAST one` keeps passing, and a `turn.failed` with any other message still throws the generic `the juror failed` `Error`, not a `CodexAuthError`.
3. The match is on the LAST `turn.failed` only (an early retry `error` line carrying `401` never triggers it), and `we:scripts/operations/cli-adapter.mjs#resolveJudgeProvider` needs no change: it already forwards whatever `codexJudgeSpawn` throws.
