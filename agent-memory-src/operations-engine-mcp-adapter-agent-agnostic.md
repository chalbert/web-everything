---
name: operations-engine-mcp-adapter-agent-agnostic
description: MCP is the planned 3rd generated adapter (alongside CLI/HTTP) for the operations engine, giving CLI/API parity and provider-neutral calling for free; multi-agent EXECUTION (not just calling) is separate, harder, deliberately deferred
metadata:
  type: project
---

**Direction, not yet built:** the operations engine (`we:scripts/operations/`, epic #3029 "declare a delivery
operation once, generate every caller") currently generates a CLI adapter and an HTTP adapter from one
declared operation. The plan is to add MCP as a third generated adapter off the same declaration, rather
than hand-building a separate integration. MCP is Anthropic's protocol but is explicitly vendor-neutral —
other providers/frameworks can speak it too — so this one adapter satisfies two asks made in the same
conversation: (1) dual design so Claude Code CLI and the raw Claude API get identical operation behavior
(the API has a built-in MCP connector, no CLI required), and (2) it's provider-neutral, so any future
non-Anthropic *caller* of an operation is already covered without extra work.

**Why:** discussed 2026-08-17 while investigating why background dispatch agents were silently stalling —
the operations engine is currently only reachable by shelling out to a CLI script from inside a Claude
Code Bash call, which only works for Claude Code sessions. MCP was identified as the layer that makes one
operation declaration reachable identically from Claude Code, the raw API, and a future UI.

**Two layers — don't conflate them:**
- **Calling an operation** (interface layer) — MCP adoption solves this for any agent/provider, "for free,"
  once built as a 3rd generated adapter.
- **Doing the work** (execution layer) — `dispatch-lane`'s effect step spawns a `claude --bg` process;
  `judgeSpawn`/`judgePanel` spawn `claude -p` with a session id. This is genuinely Claude-Code-specific and
  MCP does NOT fix it. Supporting a non-Anthropic agent as the actual worker is separate, harder (different
  tool-calling conventions, no shared session/resume model), and the user explicitly called this
  hypothetical and low priority — "way down the pipe."

**How to apply:** don't build the MCP adapter or a swappable-executor abstraction speculatively. But when
touching dispatch/execution code (`dispatch-lane-io.mjs`, `judge-spawn.mjs` and similar), avoid letting
Claude-specific assumptions leak any deeper into surrounding logic than the actual spawn call requires —
keep "spawn the worker" isolated as its own step/function. Cheap now, keeps the door open later without
being a project of its own.
