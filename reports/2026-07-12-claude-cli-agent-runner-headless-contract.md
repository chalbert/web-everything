# Claude CLI headless runner contract — docs survey for the Plateau Loop agent runner (#2444)

**Date**: 2026-07-12
**Point**: The verified CLI/SDK facts (stream-json contract, steering channels, auth boundary) that fix #2444's runner-interface defaults.
**Research page**: `/research/claude-cli-agent-runner-headless-contract/`

---

## Question

What does the Claude Code CLI guarantee when spawned headless as a supervised child (`-p
--output-format stream-json`), what mid-turn steering channels exist, and can the Agent SDK run on
subscription auth — the facts the #2444 runner contract must rest on?

## Recommendation

**Banked, not ruled — the 2026-07-11 operator defer on #2444 is honored** (phase 1 is the drain daemon
only, which spawns no agents). Facts the eventual prep builds on: a subscription-funded runner spawns
the local CLI (the SDK is a later API-key backend behind the same contract); steering has **two
documented channels that compose** — queued stdin messages via `--input-format stream-json` (boundary,
non-destructive, same process) plus the PreToolUse deny-with-reason signal (earlier, best-effort,
deny-once-and-pass-the-retry, steering fitness unproven → spike); every spawn needs a *closed*
permission resolution because headless `-p` aborts on an unresolved permission; kill + `--resume` is
the hard-redirect op, not the steer channel.

## Key Findings

- **Stream contract:** `-p --output-format stream-json` emits typed NDJSON (`system/init` with session
  id, text deltas, tool events, final `result`); `--resume <session-id>` continues `-p` sessions even
  after a crash/kill, scoped to the starting directory; mid-turn truncation semantics after a hard kill
  are undocumented.
- **Permissions:** `-p` is strictly non-interactive — an unresolved permission **aborts the session**;
  so spawns must ship complete static profiles (`--allowedTools`, `--permission-mode`) plus PreToolUse
  hook gates. No prompt fallback exists.
- **Steering:** `--input-format stream-json` is documented print-mode input, and since v2.1.205 a user
  message sent while Claude is working **stays queued and runs as its own turn** — a non-destructive
  boundary channel on the same process (spawn must keep stdin open). The earlier-than-boundary signal
  is a PreToolUse deny whose `permissionDecisionReason` reaches the model (wire shape proven for policy
  blocks at `we:scripts/guard-bash.mjs:410-414`; repeated blocks abort a headless session, so a steer
  gate must deny once and pass the retry; steering fitness needs a spike).
- **Auth boundary:** `claude setup-token` mints a one-year OAuth token the CLI honors on Pro/Max; the
  Agent SDK documents API-key auth only and Anthropic's terms restrict third-party subscription use —
  the setup-token/SDK spike resolves **against** an SDK phase-1 backend.
- **SDK-only capabilities** (later backend): `interrupt()`, queued streamed input, `canUseTool`
  callback, `setModel()`.
- **In-repo precedent:** `plateau:tools/dev-panel/vite-plugin.ts:150-165` (spawn/resume/SIGTERM +
  stream demux in `plateau:tools/dev-panel/dev-panel.html:268-286`) is the constellation's only
  existing claude-spawn — the proven half the runner generalizes.

## Files Created/Modified

| File | Action |
|---|---|
| `we:src/_data/researchTopics/claude-cli-agent-runner-headless-contract.json` | created — registry entry |
| `we:src/_includes/research-descriptions/claude-cli-agent-runner-headless-contract.njk` | created — write-up |
| `we:backlog/2444-plateau-loop-phase-1-agent-runner-shape-cli-spawn-contract-s.md` | rewritten to prepared-fork shape |
| `we:reports/2026-07-12-claude-cli-agent-runner-headless-contract.md` | this report |
