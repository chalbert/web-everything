---
bornAs: x1d4k2v
kind: decision
parent: "2445"
size: 3
status: open
priority: low
dateOpened: "2026-07-11"
tags: [plateau-loop, agent-runner, claude-cli]
---

# Plateau Loop phase-1 agent-runner shape — CLI-spawn contract, steering, and auth

Define the agent-runner interface (spawn/steer/stop/resume) with the claude CLI backend: -p stream-json spawning, hook-gate mid-turn steering, kill+resume redirects, subscription auth only; SDK/API-key backend deferred. Includes the setup-token/SDK spike outcome.

> **Deferred (2026-07-11 red team — operator call).** Phase 1 is re-scoped to the resident drain
> daemon only ([#2449](/backlog/2449-ship-the-phase-1-resident-drain-daemon-merge-queue-only/)),
> which spawns no agents — so this decision has no consumer yet. Prepare/ratify only once the daemon's
> operating evidence says the extraction should grow. `priority: low`: pickable, out of auto-select.

## Red-team risks to fold into the forks (2026-07-11)

- **Subscription quota is a hard wall for a resident spawner.** A coordinator spawning agents
  continuously hits weekly/session caps in ways interactive use doesn't, and the pipeline then stalls
  on a rate limit. Any fork must state its quota-exhaustion behavior.
- **The CLI contract is observed behavior, not an API.** `-p --output-format stream-json`, hook-gate
  denial injection, and `--resume` semantics ship breaking changes without notice; the dev-panel proves
  the pattern at toy scale, not as load-bearing infrastructure. The runner interface must budget for
  contract drift (pin + smoke-test the CLI version).
- **Steering only reaches an agent when it calls a tool.** An agent deep in reasoning or writing prose
  is unreachable mid-turn; kill+`--resume` discards in-flight work. Present hook-gate steering as
  partial, not solved.
- **The setup-token spike leans on an unpromised auth path.** `CLAUDE_CODE_OAUTH_TOKEN` for SDK use is
  not a supported contract; a fork built on it needs an exit plan.

## The question

The coordinator spawns Claude agents as supervised children. Phase 1 runs on the user's
subscription, which rules out the Agent SDK (API-key only per its auth docs) — so the
backend is spawning the `claude` CLI (`-p --output-format stream-json`, `--resume`,
`--model`, `--allowedTools`/`--permission-mode`), the pattern
`plateau:tools/dev-panel/vite-plugin.ts` already proves. This decision fixes the runner
*interface* so an SDK/API backend can slot in later without UI or orchestration changes.

## To settle (unprepared — forks to be authored by /prepare)

- **Interface surface** — proposed first-class ops: `spawn(task, {model, tools, cwd})`,
  `steer(text)`, `stop()`, `resume(text)`, `observe()` (typed event stream from stream-json).
- **Steering mechanics** — mid-turn via PreToolUse hook-gate (deny-with-reason injects the
  user's text; documented as visible to the model mid-turn) vs between-turn kill +
  `--resume <session>`; which the UI exposes and how.
- **Permission model headless** — no interactive prompts headless: per-task
  `--allowedTools` profiles vs `--permission-mode` presets vs hook-based approval routed to
  the Loop UI.
- **Spike to fold in** — whether `claude setup-token` (`CLAUDE_CODE_OAUTH_TOKEN`) lets the
  Agent SDK run on subscription auth for single-user use; if yes, native `interrupt()` and
  queued messages become available in phase 1 and the CLI backend shrinks to a fallback.
- **Model configurability** — per-spawn `--model` (works under one subscription today) as
  the platform-config hook for later configurable/non-Claude models.
