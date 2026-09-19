---
name: use-codex
description: Delegate ONE real coding task to Codex CLI's agentic (tool-bearing) mode as a personal escape hatch, when the operator's own Claude usage is running low and the task is well-scoped enough not to need deep repo-specific judgment. Use when the operator says "use codex for this", "I'm low on usage, hand this to codex", or "delegate this to codex". NOT part of the product's own dispatch pipeline (that's `we:scripts/lib/codex-judge-spawn.mjs`, a tool-FREE schema-constrained judge role) and NOT for anything the operator wants committed/pushed automatically — this NEVER commits, NEVER pushes.
---

# Delegate a task to Codex CLI, agentic mode (a personal escape hatch)

**The method lives in `we:scripts/codex-direct-task.mjs`'s own header** — argv construction, the real
`codex exec --help` flags this was built from (not assumed from the tool-free judge-role probe, `#3371`),
the JSONL event-stream shape a real agentic run produces (`command_execution`/`file_change`/`agent_message`
items, confirmed live — not just a coarse final blob), and why the log file lives inside `.git/`. Don't
restate that here; if the argv or parsing changes, edit that file's header, not this skill.

## When to reach for this

- Your own Claude usage is running low and you still have a well-scoped coding task to get done tonight.
- The task doesn't need deep repo-specific judgment a fresh agent would lack — a scratch clone of this repo
  carries `we:AGENTS.md`, so Codex sees the same doctrine you do, but it hasn't seen this conversation.
- You want a real diff to review, not an auto-committed change. If you want something committed and PR'd
  without your review, this is the wrong tool — use the normal `/pr` flow yourself once you're happy with
  the diff this produces.

## The loop

1. Pick a target: an **existing lane/checkout** you already have (`--dir=<path>`), or let it make a
   **fresh scratch clone** of this repo (omit `--dir`; needs `--repo-root=<path>` unless run from inside a
   checkout, in which case it derives one from `git rev-parse --show-toplevel`).
2. Run it, with a real task description:
   ```
   node scripts/codex-direct-task.mjs --task="<what you want done>" [--dir=<checkout>] [--gate=standards|full]
   ```
   Long or multi-paragraph tasks: write them to a file and pass `--task-file=<path>` instead of fighting
   shell quoting.
3. **Watch it work.** The JSONL event stream prints to stdout live (unless `--no-stream`) and is always
   logged to `<dir>/.git/codex-direct-task.jsonl` — `tail -f` that file from another terminal to poll a
   long-running task instead of waiting on this one blocking.
4. **Read the report.** It ends with the real `git diff`/`git status` in the target dir — nothing more.
   If Codex made any commits despite being told not to (rare; belt-and-braces, not expected), the report
   flags it explicitly so you know there's a commit boundary inside the diff before you use it.
5. **You decide what happens next** — review the diff, `cd` into the dir and keep editing by hand, or land
   it yourself through the normal lane/PR flow. Nothing here does that for you.

## Safety note — read before running

**This script never runs `git commit`, `git add` (beyond a content-free `--intent-to-add` so new files show
up in the diff), or `git push`, and never opens a PR.** That is a hard property of the script, not a
default you need to opt into. The task prompt also tells Codex itself not to commit/push, but Codex has
real shell access in `workspace-write` mode and could in principle disobey — the diff capture is written to
be correct either way (it diffs against the commit that existed before the run started, regardless of what
happened in between), and the CLI report says plainly if that happened.

## Flags worth knowing

`--gate=none` (default, fastest) | `standards` (`check:standards` only) | `full` (`check:standards` +
the whole `vitest run` suite — this does **not** try to scope tests to what changed; that's a real gap,
not a silent claim). `--timeout-ms=` (default 30 min) is a parent-imposed wall — Codex has no CLI-side
timeout of its own. `--ephemeral` skips Codex's own session persistence (default: persisted, so a stalled
run is resumable by hand via `codex exec resume <thread-id>` — the report prints the thread id).

**Model / effort — nothing is ever left to Codex's own implicit default** (`#3635`, ratified; the rule is
`we:docs/agent/backlog-workflow.md#codex-model-routing`):

- `--model=<slug>` — forwarded as `-m`. **Defaults to `CODEX_MODEL` (`gpt-6-astra`)**; there is no way to
  make the script omit `-m`. Override only with a slug the ChatGPT entitlement actually lists — a guessed
  name is a hard 400, not a soft fallback.
- `--effort=low|medium|high|xhigh|max|ultra` — forwarded as `-c model_reasoning_effort=<level>`, unchanged
  (no clamping). Throws on any other value. The levels above `high` are real on `gpt-6-astra` but no probe
  has exercised them, so reaching for one is a deliberate call — and a `--model` override may not offer all
  six.
- `--tier=haiku|sonnet|opus` — the rung vocabulary instead of a raw level, mapped by `CODEX_TIER_EFFORT` to
  `low`/`medium`/`high`. **It selects effort only — all three rungs run the same model.** **Ignored when
  `--effort` is also given** (an explicit level outranks a named rung). Pass neither and you get the
  `sonnet` rung's `medium` — explicitly, not inherited. Read the routing rule before picking: the evidence
  behind the rungs is mixed (raising effort scored *worse* on one model, and is a no-op on the pinned one),
  so treat them as a cost/latency dial that gets recorded, not as a correctness ladder.

**`--clear-rollout-after-run`** (default off) — `#3635` Fork 4. Every non-`--ephemeral` run reads a real
quota signal (`used_percent` / `window_minutes` / `resets_at` / `plan_type`) out of Codex's persisted rollout
file and prints it in the report; there is no USD figure anywhere in Codex's output, this is the closest
thing. This flag switches that read to the ratified **read-then-delete** shape: read the one record, then
delete the rollout file — same net cleanliness as `--ephemeral`, but the signal gets read first. **It costs
you `codex exec resume`**, which is exactly why it is off by default here (a personal escape hatch's stalled
run is worth resuming). Turn it on only for a fire-and-forget run you will never resume. It is a no-op
alongside `--ephemeral`, which writes no rollout to read or delete in the first place.
