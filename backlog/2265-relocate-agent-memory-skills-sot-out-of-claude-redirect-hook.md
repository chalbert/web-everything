---
kind: decision
size: 5
status: open
locus: webeverything
dateOpened: "2026-07-04"
tags: [permissions, agent-ergonomics, memory, skills, tooling, decision]
---

# Relocate agent-memory/skills SoT out of .claude/ + redirect hook to auto-approve their edits

## Problem
The Claude Code VS Code extension **hard-prompts on every edit whose literal path OR realpath contains
`/.claude/`**, and nothing in config-land overrides it — verified failing: `Edit()` allow rules (all path
forms), `additionalDirectories`, VS-Code workspace membership, `acceptEdits` mode, `bypassPermissions` via
project settings, symlinks *into* `.claude`, and a `PreToolUse` hook returning `permissionDecision: "allow"`.
Consequence: long unattended workflows stall waiting for approval on memory/skills edits, and interactive
memory/skills edits cost a click each. (Non-`.claude` code edits already auto-approve under `acceptEdits`,
workflows included — that half is solved.)

## Proven mechanism (both load-bearing unknowns verified 2026-07-04)
1. **Redirect hook beats the gate.** A `PreToolUse(Read|Edit|Write)` hook that rewrites the edit's file path
   from a `.claude/(agent-memory|skills)/…` path to a **real non-`.claude` path** (`we:agent-memory-src/**`,
   `we:skills-src/**`) makes the gate see a non-`.claude` path → **auto-approves**, and the write lands on the
   real file. (Verified: an edit to a `.claude/agent-memory/…` path landed silently in the `we:agent-memory-src`
   tree.)
2. **Symlink discovery works.** Claude Code **follows a symlinked skill dir** — a symlinked `.claude/skills/…`
   entry pointing to an out-of-`.claude` dir was listed as an available skill after reload. So the
   `.claude/skills` and `.claude/agent-memory` dirs can be symlinks to the real SoT and discovery/loading
   still works.

The real files MUST live outside `.claude` (the gate checks realpath too — a symlink *pointing into* `.claude`
still prompts). So this is a genuine SoT relocation, not just a hook.

## Design
- Move SoT: `we:.claude/agent-memory/**` → `we:agent-memory-src/**`, `we:.claude/skills/**` → `we:skills-src/**`
  (git mv).
- Symlink `we:.claude/agent-memory` → `we:agent-memory-src`, `we:.claude/skills` → `we:skills-src` (discovery +
  all existing `join(ROOT, '.claude/skills/…')` refs resolve through the link, no code change).
- A user-level `PreToolUse(Read|Edit|Write)` hook (personal-machine config in the home `~/.claude/hooks` dir,
  **not** the repo) does the rewrite. A machine without it just gets prompts (graceful degradation).

## Governed surfaces this touches (why it's a decision, not a drive-by)
- `we:docs/agent/platform-decisions.md` cites `we:.claude/agent-memory/**` as a durable/statute path.
- `we:scripts/guard-lane.mjs` has explicit `.claude/agent-memory` exemption logic.
- `we:scripts/check-standards.mjs` memory-index gate + `we:scripts/check-memory-freshness.mjs` reference the path.
- `we:.claude/skills/batch-backlog-items/*.json` (queued/claims/capacity) are stateful, read+written by ~10
  scripts — must keep resolving through the symlink (verify in the gate).

## Forks
- **Fork A — adopt (default: YES, memory-first).** Slice 1: migrate `agent-memory` + hook + doc/guard updates,
  gate green, lane→PR, reload-verify. Slice 2: `skills` (higher coupling — stateful JSON).
- **Fork B — scope: memory only, never skills.** Memory is the high-frequency edit surface; skills change
  rarely and carry the state-file coupling. (default: revisit after Slice 1.)
- **Fork C — don't migrate.** For the actual pain (unattended workflows), launch those runs with
  `--dangerously-skip-permissions` — one flag, no governed-path churn. Keep `.claude` prompts as the
  interactive review gate. (Cheap alternative; the migration's edge is auto-approval *without* bypass mode,
  scoped precisely to memory/skills.)

## Recommendation
Adopt **Fork A, memory-first** if frictionless memory editing (incl. in workflows) is worth owning a
personal redirect hook + a governed-path migration. Otherwise **Fork C** — the launch flag solves the
unattended-workflow stall for free and the migration isn't worth the statute-path churn.

## Provenance
Mechanism discovered + fully verified in an interactive debugging session on 2026-07-04 (permission-prompt
diagnosis: the `.claude`-path gate sits above the settings/hook allow pipeline; a `updatedInput` path-rewrite
is the only lever that auto-approves a `.claude`-classified edit).
