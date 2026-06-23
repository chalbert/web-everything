---
kind: story
size: 5
status: open
dateOpened: "2026-06-23"
tags: []
---

# Build 2-C: session file-claim registry — union baseline-diff with explicit Edit/Write + CLI touches

Close #953's ratified fail-unsafe hole in gate attribution. Extend the session claim registry (we:.claude/skills/batch-backlog-items/claims.json, already session-keyed + TTL-pruned) to record each file a session actually touches, then compute mineFiles = (currentFiles − baseline) ∪ (explicitly-recorded touches) — a MONOTONIC tightening of 2-A that can never be worse than the shipped baseline-diff. Record touches two ways: a PostToolUse hook on Edit/Write, AND direct appends from the backlog CLIs (claim/resolve/scaffold) so Bash-path mutations of the shared registries are covered. Document the raw-sed residual honestly.

## The hole this closes

2-A (#952) attributes a gate failure to a session only when its file is dirty *now* but **not** in the
claim-time baseline ([we:scripts/readiness/claimScope.mjs:153](../scripts/readiness/claimScope.mjs)). So a
file already dirty at claim that **this** session then breaks stays `external` → demoted to a note →
stepped over (own real red mistaken for foreign). The modal trigger is the shared registries concurrent
batch sessions touch every claim/release. See #953's *Ratification* for the full ruling + red-team.

## Build plan

- **Record explicit touches.** Add an `editedFiles` (or `touched`) array per session row in
  [we:scripts/readiness/claimScope.mjs](../scripts/readiness/claimScope.mjs) (pure module — extend the
  parse/serialize/record/prune surface, keep it fs-free). A small `recordTouch(state, {session, files,
  nowIso})` appends de-duped paths to the session row.
- **Compute mineFiles as a UNION.** `mineFiles = (currentFiles − baseline) ∪ touched`. This is the only
  behavioural change — and it is **monotonic**: the registry can only *add* files to "mine", so the gate
  can never red *less* than 2-A, only catch the own-edit-of-baseline-file case it currently misses.
- **Two recording paths so Bash mutations are covered:**
  1. A `PostToolUse` hook on Edit|Write in [we:.claude/settings.json](../.claude/settings.json) that
     appends the edited path(s) for the active session.
  2. Direct appends from the backlog CLIs — [we:scripts/backlog.mjs](../scripts/backlog.mjs)
     `claim`/`resolve`/`scaffold` already write through one module; have them record the files they splice
     (the backlog `.md`, the registries) against the session, no hook needed.
- **Honest residual.** A mutation path outside *both* Edit/Write and the CLIs (raw `sed`/`node -e` on a
  registry) still rides the baseline-diff with 2-A's residual — document this in the module header
  (and correct the existing "NEVER a foreign red mistaken for clean" line, which #953 found inaccurate).
- **Session keying.** The PostToolUse hook needs the active session slug. Resolve how it learns it
  (env var set at claim, the chat-rename slug, or the single most-recent claim in `we:claims.json`); pick
  the cheapest reliable signal and document it.

## Acceptance

- Unit tests in [we:scripts/__tests__/claimScope.test.mjs](../scripts/__tests__/claimScope.test.mjs)
  cover the union: a file in the baseline that is also a recorded touch is classified `mine` (blocks),
  while a baseline file with no touch stays `external`.
- `npm run check:standards` green; the new hook adds bounded latency only (no gate behaviour change for the
  default no-flag run).
