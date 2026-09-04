# Claude Instructions for Web Everything

> **Canonical instructions live in [AGENTS.md](./AGENTS.md).** This stub exists so Claude Code
> auto-loads the pointer. Read `AGENTS.md` (the Tier-0 router), then follow its links into
> `docs/agent/*.md` only as the task requires — this keeps context lean.

## Pinned rule (the one exception to "just a pointer" — see why below)

**Never end a turn assuming a backgrounded Bash command or a nested Agent/Task call will wake you
up.** That auto-resume only exists for a Task/Agent-type job the harness itself tracks — never for
your own backgrounded shell command or an untracked nested child. Run gating checks (tests,
`verify-lane`, PR/merge polls) to completion in the foreground, or actively poll them yourself,
before ending a turn. If you must stop mid-task, say so explicitly — never imply a notification is
coming. Full rationale + evidence:
[`agent-memory-src/subagent-must-not-end-turn-on-passive-wait.md`](agent-memory-src/subagent-must-not-end-turn-on-passive-wait.md).

*(Pinned here, not in `AGENTS.md`/`docs/agent/`, because those are pull-based — a fresh subagent has
no reason to open them unless told. This file is the one thing confirmed to auto-load into every
session **and** every Agent-tool subagent's context regardless of cwd — main checkout, lane clone, or
VM. The lesson above first landed only in `agent-memory-src/` and the same failure recurred 3+ times
afterward on different subagents, because nothing pulled it in automatically, #3383.)*

See **[AGENTS.md](./AGENTS.md)**.
