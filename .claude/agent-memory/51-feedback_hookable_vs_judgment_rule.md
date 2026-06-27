---
name: feedback_hookable_vs_judgment_rule
description: a rule belongs in a hook iff a script can decide it; judgment stays in context; mechanical footguns → hooks
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 43c091c2-3478-4489-a078-8bb6c34d20bb
---

A rule moves OUT of loaded context (MEMORY.md / AGENTS.md / docs/agent) and INTO a deterministic hook **iff a script can decide compliance** from the tool input — a regex/pattern match on edited content, a file-path check, a count, a size limit, a banned command string, a required-field check. If catching it needs judgment (intent, a design fork, "is this on merit?"), it STAYS in context.

**Why:** memory is probabilistic recall (rules get dropped, then caught late at the gate); a hook is deterministic enforcement at the write/command seam. Moving a mechanical rule wins TWICE — the line leaves the context budget AND the rule starts being enforced instead of hoped-for. Pure token savings alone don't justify the churn; the reliability gain does. Prime candidates are the "footgun" memories — mechanical traps currently caught late.

**How to apply:** classify each rule HOOKABLE / JUDGMENT / ALREADY-HOOKED. For HOOKABLE, pick the seam (PreToolUse Bash, Pre/PostToolUse Edit|Write, UserPromptSubmit) and enforcement strength per-rule: hard DENY (PreToolUse, exit 2 / `permissionDecision:deny`) for things that must never land; soft WARN (PostToolUse, stdout feedback) for cheap reminders. Existing hooks to extend rather than duplicate: [[project_enforce_shared_gate_at_write_time]] (lint-locus-prefix, #883), check-memory ([[project_memory_management_policy]]), guard-git-branch ([[feedback_commit_to_default_branch_ok]]). Once a rule is hook-enforced, drop or shrink its MEMORY.md line.
