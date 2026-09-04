---
name: inspect-agent-health
description: Check whether a background/subagent is genuinely stuck, mid-blocking-call, or just quiet — by reading a BOUNDED tail of its own JSONL transcript directly, never by pinging it. Use when the operator or another agent asks "is this agent stuck?", "why isn't it responding?", "check on the background agent", "is it still going?", "what is <agent> doing right now?", "read its transcript", or "agent health check" — or before you're about to SendMessage-ping a background agent just to check on it (do this instead). A SendMessage ping to an agent blocked in a synchronous tool call just queues behind whatever it's blocked on and tells you nothing; this skill reads the transcript's last few lines instead, which works even then, and specifically detects the case where the target is itself blocked on a synchronous nested Agent() call to its own child. NOT for redirecting an agent's work, giving it new instructions, or resuming it after a genuine stall — that's still SendMessage.
---

# Inspect agent health — read the transcript, don't ping

**Intentionally generic, not repo- or epic-specific.** This is a general Claude-Code
multi-agent-orchestration utility, useful in any project where subagents get dispatched (backgrounded via
the `Agent` tool, tracked via `ListAgents`). It lives in this repo's `skills-src/` only because this is
what's actually committed and backed up to a remote right now — it may migrate to a personal, cross-project
skills repo later. Keep any future edits here free of this repo's own domain assumptions.

## Why this exists

A `SendMessage` ping is the wrong tool for a routine "is it still going?" check. The message enqueues and
drains at the target's *next tool round* — but if the target is currently blocked inside a synchronous tool
call (most notably its own nested `Agent()` call with `run_in_background: false`, waiting on a child), there
is no next tool round until that call returns. The ping just sits there. From the pinger's side, silence is
then indistinguishable between "genuinely stuck" and "busy and can't respond yet" — and the ping itself cost
the target nothing useful and risked landing mid-context, adding noise it has to process once it resumes.

Reading the target's own transcript sidesteps this entirely: it's non-disruptive (costs the target nothing),
and it directly answers the question a ping can't when the target is mid-blocking-call — the transcript's
last entry being an unresolved `tool_use` for `Agent` with `run_in_background: false` **is** the explanation
for the silence.

## Run it

```
node skills-src/inspect-agent-health/agent-health.mjs <agentId | output_file path | .jsonl path> [--lines=15] [--json]
```

- Give it whatever you have: the bare `agentId` an `Agent` spawn result or `ListAgents` printed, the full
  `output_file:` path from a spawn result, or a `.jsonl` transcript path directly — all resolve to the same
  file. An id-only lookup searches `~/.claude/projects/**/subagents/agent-<id>.jsonl` (the durable store);
  `--session=`/`--project=` narrow it if an id happens to collide across sessions.
- The read is **bounded by construction** — see the script's own header comment for the full mechanics
  (byte-capped tail read, per-field truncation, streaming line count). It is safe to run against a transcript
  of any size; it never loads or prints the whole file, which is exactly the thing the `Agent` tool's own
  spawn result warns NOT to do via a raw `Read`/shell `tail`.

## Reading the report

The report gives: total line count (rough activity/progress proxy), the last few entries in human-readable
form (`» text`, `→ tool_use: Name(input)`, `← tool_result`), and one of three verdicts:

- **`BLOCKED_ON_CHILD`** — the newest action is an unresolved nested `Agent()` call with
  `run_in_background: false`. This is the single most useful thing this skill surfaces: it explains silence
  that would otherwise look like a stall. Not a problem by itself — just don't expect a ping to land yet.
- **`BLOCKED_ON_TOOL`** — newest action is some other pending tool call with no result yet. Same shape, less
  specific cause.
- **`ACTIVE`** / **`IDLE_OR_STALLED`** — nothing pending; recent transcript activity vs. quiet past the
  default 180s threshold decides which.

## When to still use SendMessage instead

This skill only *reads*. Use `SendMessage` when you actually need to redirect the target's work, hand it new
instructions, or resume it after this skill's report shows a genuine stall (`IDLE_OR_STALLED` with no pending
call) — not for a routine "is it still going" check, which this answers without costing the target anything
or risking a message queued behind a long-running blocking call.
