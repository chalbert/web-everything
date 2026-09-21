---
name: use-gemini
description: Delegate ONE real coding task to Google's Antigravity CLI (agy) in agentic mode as a personal escape hatch when the operator's own usage is running low. Use when the operator says "use gemini for this", "hand this to agy", or "delegate this to gemini". NOT the retired standalone Gemini CLI, NOT a schema-constrained judge or product dispatch pipeline, and NOT automatic landing — this script NEVER commits, NEVER pushes, and never opens a PR. There is no real sandbox for agy's native file tools.
---

# Delegate a task to Antigravity CLI, agentic mode (a personal escape hatch)

**The method lives in `we:scripts/gemini-direct-task.mjs`'s own header** — the observed `agy` flags from
backlog #3633, the stream-json stdin route, the real event shapes, target-directory handling, and diff
capture. Don't restate that here; if the argv or parsing changes, edit that file's header, not this skill.

## When to reach for this

- Your own usage is running low and you have one well-scoped coding task to delegate.
- The task can be explained to a fresh agent without this conversation. Include the relevant constraints
  and tell it to follow the target repo's agent instructions; do not assume they are auto-loaded.
- You want a diff to review and will decide how to land it yourself.

## The loop

1. **Pick a target:** an existing lane/checkout (`--dir=<absolute path>`), or preferably a fresh scratch
   clone (omit `--dir` and supply `--repo-root=<absolute source checkout>`). The source path is required
   when no target is given. Cloning uses committed HEAD; it does not copy uncommitted work.
2. **Run it** with a self-contained task:
   ```
   node scripts/gemini-direct-task.mjs --task="<what you want done>" --repo-root=/absolute/repo --gate=standards
   ```
   Use `--dir=/absolute/checkout` in place of `--repo-root` for an existing target. For long tasks,
   use `--task-file=<path>` instead of shell quoting.
3. **Watch it work.** JSONL streams to stdout unless `--no-stream` or `--json`, and is always logged to
   `<dir>/.git/gemini-direct-task.jsonl` by default. Use `--log=<path>` to choose a known log location;
   `tail -f` it from another terminal while the run proceeds.
4. **Read the report:** terminal status, error, token usage, final response, actual git status/diff
   against the recorded start SHA, intervening commits, and any gate results. Tool-path telemetry is
   informational; it is not a complete account of files changed. No result event means terminal `null`.
5. **Decide what happens next.** Review the diff, keep editing, or land it yourself through the normal
   review process. Stop after presenting the report unless the operator has authorized further work.

## Safety note — read before running

**There is NO real write/read confinement.** `agy`'s own native file tools can read and write outside
its target directory even with `--sandbox` enabled. `--add-dir` is bookkeeping only. The run is scoped
only by launch cwd, prompt instructions, and the directory where the diff is captured.

A fresh scratch clone is the default mitigation because ordinary edits and nearby wandering then happen
away from the primary checkout. It does **not** guarantee that the primary repo, the operator's home,
or anything else on the machine stays untouched. A target git diff cannot prove there were no outside
writes. Read the script's header before invoking it; do not describe this run as isolated.

The script never runs `git commit`, content-staging `git add` (only content-free `--intent-to-add` to
show new files), `git push`, or opens a PR. The agent is instructed likewise but can disobey. Intervening
commits are reported; pushes and activity outside the target cannot be verified by the local diff.

## Flags worth knowing

- **`--model=<slug>` / `--effort=low|medium|high`** are optional passthroughs, forwarded only when given.
  No model/effort recommendation or ratified default exists for this open-ended coding-task role.
  Unlike Codex's #x8wbivt pin, no evidence validates a ladder here; #3633's judge-role probes do not fill
  that gap. Let `agy` reject unsupported model/effort combinations with its own remedy.
- **`--gate=none|standards|full`** defaults to none. Standards runs `check:standards`; full also runs the
  whole Vitest suite, without selecting tests by changed files.
- **`--timeout-ms=<n>`** defaults to 30 minutes. The parent SIGKILL wall is the real ceiling;
  `--print-timeout` is only a secondary hint and does not cover the OAuth wait.
- **`--add-dir=<dir>` / `--sandbox`**: repeatable additive bookkeeping / shell-only confinement.
  Neither bounds agy's native file tools. Sandbox is forwarded only when explicitly requested.
- **`--json`** prints the full report as JSON and suppresses live stdout events; the log still streams.
  Token usage comes directly from `result.usage`. There is no USD figure or quota signal to look up.
- **`--no-install`** skips dependency installation in a fresh scratch clone.
