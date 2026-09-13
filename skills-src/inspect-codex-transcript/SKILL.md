---
name: inspect-codex-transcript
description: Read back what a Codex CLI run actually did — its prompt, every shell command it ran, every output, its token/quota use, and whether it is still going — by reading a BOUNDED tail of the run's own rollout transcript on disk. Use when the operator or another agent asks "what did the Codex agent do?", "is the Codex run stuck?", "did that codex exec finish?", "read the Codex transcript", "audit that Codex run", or needs to score/judge a Codex-dispatched agent's work after the fact. The Codex counterpart to inspect-agent-health (which reads Claude subagent JSONL). NOT for Claude subagents (that is inspect-agent-health) and NOT for continuing a Codex thread (that is `codex exec resume <threadId>`).
---

# Inspect a Codex transcript — the run's own rollout file, bounded

The Codex-side counterpart to [`inspect-agent-health`](../inspect-agent-health/SKILL.md). Same safety
design (byte-capped tail, per-field truncation, streaming line count), different substrate and a different
verdict set, because Codex's session model genuinely differs from a Claude subagent's.

## What Codex actually persists (verified live, codex-cli 0.153.4, 2026-09-13)

Every `codex exec` run writes a full turn-by-turn trace to:

```
$CODEX_HOME/sessions/YYYY/MM/DD/rollout-<ISO8601>-<threadId>.jsonl      ($CODEX_HOME ?? ~/.codex)
```

`<threadId>` is exactly the `thread_id` the run's own `--json` stream prints on `thread.started`, and the
one `codex exec resume <threadId>` takes. Confirmed by running real probes and reading the files back:

- **It is written incrementally, during the run.** A probe blocked inside a 50-second shell command already
  had its prompt, its assistant message and its pending tool call on disk mid-call. A live "is it stuck?"
  read is genuinely possible.
- **Resume appends to the same file.** One thread is one file across any number of resumes, and a resumed
  run recalled a prior turn's detail verbatim.
- **Readable:** the user prompt, every assistant message, every tool call with its literal command, every
  tool output with exit code and stdout, per-turn token usage, the context window, and the quota record.

### The one real gap: there is no readable reasoning

`reasoning` records carry `encrypted_content` (an opaque blob) plus a `summary` array that was **empty in
66 of 66** reasoning records across the entire local corpus. There is no Codex equivalent of reading a
Claude `thinking` block. **Anything that scores a Codex run must judge its observable trace — what it ran,
what came back, what it concluded — never its deliberation.** This skill reports reasoning as a count and
says so explicitly rather than pretending the content is available.

## Two ways the transcript gets destroyed

Know these before relying on a transcript being there later:

1. `collectAndClearRolloutQuota()` in `we:scripts/codex-direct-task.mjs` **deletes** the rollout file after
   reading its quota record (#x8wbivt Fork 4's ratified shape for a fire-and-forget role). `codexDirectTask`
   does not call it by default — its `clearRolloutAfterRun` opts in — but any caller that opts in destroys
   the transcript.
2. Codex's own `--ephemeral` flag suppresses the rollout file entirely.

A run you may later want to audit must avoid **both**.

## Run it

```
node skills-src/inspect-codex-transcript/codex-transcript.mjs <threadId | rollout path | latest> [--lines=15] [--json]
```

- Give it the `thread_id` from the run's `--json` output, a rollout path directly, or the literal word
  `latest` for the most recently written rollout on the machine.
- `--codex-home=PATH` overrides `$CODEX_HOME` / `~/.codex`.
- The read is **bounded by construction** — see the script's header for the mechanics. This matters more
  here than for a Claude transcript, not less: a rollout's *first line alone* embeds the full base
  instructions and is ~40 KB before any turn content. The session header is read by a separate small
  bounded head-read that whitelists a few short fields and never retains `base_instructions`.

## Reading the verdict

Codex's process model is not Claude's, so the verdicts are not a copy of `agent-health`'s:

- **`RUNNING_TOOL`** — a tool call is outstanding with no output record yet, recently. Working, not stuck. A
  Codex tool call is a real shell command and routinely runs for minutes, which is why the stall threshold
  here is 300s rather than `agent-health`'s 180s.
- **`STALLED_IN_TOOL`** — that same call has been silent past the threshold. Either a genuinely long command
  or a dead process; check whether a codex process is still alive.
- **`ACTIVE`** — turn open, nothing pending, recent activity.
- **`ABANDONED_MID_TURN`** — **the Codex-specific one, with no Claude analogue.** A turn started, never
  completed, and nothing has been appended for a long time. The `codex exec` process is almost certainly
  gone and **nothing will resume it** — there is no harness watching it the way one watches a Claude
  subagent. The thread is still recoverable by hand via `codex exec resume <threadId>`.
- **`COMPLETED`** — the last turn closed cleanly. Note this means the process **exited**, not that it is
  idle; a finished Codex run is gone, and continuing it means an explicit resume.

### Why pending detection pairs `call_id`, not `status`

A tool-call record's `payload.status` said `"completed"` while its command demonstrably had not finished —
that field describes the *model item's* generation, not the tool's execution. Pairing a `custom_tool_call`
(or `function_call`) to its `*_output` by `call_id` is the only sound signal, and is what this script does.

## Relationship to run-quality auditing (#3649)

The run-quality-auditor mechanism needs to read a dispatched agent's own transcript to score it. This skill
is the Codex half of that. The constraint it must design around: a Codex subject gives you a **complete
observable trace but zero reasoning**, whereas a Claude subject gives you both. A scoring rubric that reads
`thinking` blocks cannot be applied to a Codex-dispatched subject at all — and a Codex run dispatched with
`--ephemeral`, or through a caller that clears its rollout, gives you nothing to score.
