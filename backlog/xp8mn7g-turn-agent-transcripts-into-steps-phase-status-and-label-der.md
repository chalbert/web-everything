---
kind: story
size: 3
parent: "x9ah1zb"
status: open
blockedBy: ["xa59gb9"]
dateOpened: "2026-09-22"
tags: []
---

# Turn agent transcripts into steps — phase, status and label derived mechanically, read incrementally

The step model with no model call: an incremental transcript tailer and a fixed classifier for Claude JSONL and Codex rollouts, exposed as `agent-activity --steps=<runId>`. Reuses the bounded readers in we:skills-src/inspect-agent-health/agent-health.mjs and we:skills-src/inspect-codex-transcript/codex-transcript.mjs. Design: plateau:docs/wip-live-agent.md §1.4–1.5.

## What to build

- Incremental tail by byte offset (≤ 256 KB per file per cycle; past that, skip ahead and emit a gap marker with the skipped count).
- Phase table (Lane · Read · Edit · Test · Verify · PR · Release · Delegate · Other) from tool name + a classified verb; the command string is used to classify and then dropped.
- Step status: running · waiting-long (> 60 s open) · backgrounded (`backgroundTaskId`) · passed · failed (`is_error`, `interrupted`, `timedOutAfterMs`) · skipped.
- Label: scrubbed `description` → repo path with locus prefix → fixed verb → tool name. Never the raw command.
- Run lifecycle: starting · working · waiting-long · waiting-child (reuse `detectBlockedOnChild`) · blocked · quiet (≥ 5 min) · ended-ok · ended-failed · gone; Codex via `buildVerdict`.

## Done when

1. **Executable** — we:scripts/operations/__tests__/agent-steps.test.mjs passes under `npx vitest run` on scrubbed fixtures: a passing test step, a failing one (`is_error`), a timed-out Bash, a backgrounded Bash, an open call over 60 s (`waiting-long`), an open `Agent` call (`waiting-child`), an edit → test ✕ → edit loop giving three phase groups, a Bash with no description whose output contains the fixed verb and NOT the raw command, and a Codex rollout with a pending call.
2. **Executable** — the same test feeds one transcript in two appended chunks and asserts the steps equal a single full read.
