---
name: scoped-approval-beats-global-bypass
description: For autonomous/self-improving agent loops, prefer scoped per-category auto-approval over a global permission bypass
metadata:
  type: feedback
---

Self-improving / unattended agent loops are the highest-risk, least-supervised workload AND the one that
most needs to edit protected state (memory/skills). Reaching for `--dangerously-skip-permissions` to unblock
them is the wrong instinct — it strips ALL guardrails from exactly the run you least want unguarded, and its
blast radius lands on the primary tree.

**Why:** the flag is all-or-nothing and global; a scoped mechanism auto-approves ONLY the specific protected
category (e.g. a memory/skills path prefix) while every other write stays gated, keeping the safety envelope
intact everywhere else.

**How to apply:** when an autonomous loop stalls on a permission gate, scope the auto-approval to the exact
protected path/category before reaching for a global bypass. Only fall back to the global flag when no scoped
lever exists.

Established 2026-07-04 when the owner overturned the prepared NOT-YET verdict on #2265 (relocate
agent-memory/skills SoT out of `.claude` + scoped redirect hook), objecting that the NOT-YET default's
`--dangerously-skip-permissions` fallback "blocks launching self-sustaining and self-improving loops."
Related: [[autonomous-loops-non-blocking-red-team-not-prompts]] (the approval-*model* axis — machine red-team
instead of per-iteration human prompts); this entry is the permission-*scope* axis.
