---
bornAs: xf02nzj
kind: story
size: 3
parent: "3718"
status: open
blockedBy: ["3724"]
relatedTo: ["3722"]
scope: ["we:scripts/turn-digest-hook.mjs", "we:.claude/settings.json", "we:scripts/__tests__/turn-digest-hook.test.mjs"]
dateOpened: "2026-09-19"
tags: []
---

# Deliver the turn digest into the session by hook: read a cached snapshot at SessionStart and prompt time, and derive the handoff from it

A hook is the delivery seam and the operation is the content. Once `turn-digest` (#3724) exists, a hook injects its output as context, so a session starts each turn already knowing what landed and what is owed, without model recall.

## Why hooks are this narrow

Hooks fire on harness events inside a session (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`). Almost every per-turn check is a derivation from GitHub and `claude agents`, not a gate on a tool call, so its home is an operation (the content). A hook only decides WHEN that content reaches the model. The existing surface already shows the pattern: `we:scripts/bootstrap-session.mjs` runs at `SessionStart` and reports drift as context. `UserPromptSubmit` is a documented Claude Code event but is not wired in `we:.claude/settings.json` and is not among the events `we:docs/agent/agent-cli-capability-map.md` records as verified here, so the implementer probes it first; if it does not fire as needed, fall back to `SessionStart` plus `Stop` (refresh after each turn, inject at the next start).

## Shape

- `we:scripts/turn-digest-hook.mjs`: at `SessionStart` and `UserPromptSubmit`, read the cached snapshot from #3724 and print it as additional context. **No network and no `gh` call inside the hook**: a hook runs before every prompt and a network call there adds latency and spends rate limit on every message.
- **Staleness is stated, never hidden:** the snapshot carries `generatedAt`; over a threshold the hook says "digest is N min old" and starts a detached, single-flight refresh (the operation) instead of blocking. A missing or unreadable snapshot prints one line saying so; it never fails the prompt.
- Quiet by default: print only when something changed since the last injection (new landings, a new needs-operator item, a new owed dispatch), so it is not a wall of text every turn.
- **Handoff:** the handoff is currently prose the model writes from memory (`/handoff`, a file outside the repo). Most of it is derivable: in-flight workers (run records plus `claude agents`), open PR states, the operator queue, the runner state. The handoff embeds the digest and keeps prose only for what cannot be derived: the goal, decisions taken in the conversation, and what the operator said.
- Wiring `we:.claude/settings.json` changes a harness-wide hook, so the operator reviews that diff explicitly.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/turn-digest-hook.test.mjs` passes; its cases fail before: a fresh snapshot is printed; a stale one is printed with an age note and triggers the refresh path without blocking; a missing snapshot prints one line and exits 0; an unchanged snapshot prints nothing; the hook performs no network call (asserted by a stubbed `gh` that fails the test if invoked).
2. **Probed live** — a fresh session shows the digest at start, and the `/handoff` output for that session contains the derived state block rather than hand-typed PR lists.
