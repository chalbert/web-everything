---
kind: task
status: open
dateOpened: "2026-07-11"
relatedTo: ["2302", "2339", "2219", "104", "883"]
tags: [guard, lane-isolation, backlog-cli, enforce-at-source]
---

# Enforce lane-only backlog item-mutations at the source, not just the Bash-tool hook

Move the primary-cwd guard for card-file mutations into we:scripts/backlog.mjs itself so non-Bash-tool channels (workflow/subagent/cron/headless) cannot stamp we:backlog files on the primary checkout.

## Observed (2026-07-10)

Three backlog cards (#2404, #2406, #2408) were found with uncommitted `costUsd`/`costSessions`
frontmatter in the **primary** checkout — an even-split cost-attribution stamp ($7.77 × 3). No
one hand-authored them: they came from `we:backlog cost <NNN> --usd=…`, the close-flow cost-on-card
step.

## Root cause

The lane-isolation rule for item-mutations (#2302/#2219/#2339) is enforced **only** by
`we:scripts/guard-bash.mjs`, a `PreToolUse(Bash)` hook. That hook fires **only** for Bash-*tool*
calls in a session that loads `we:.claude/settings.json`. A cost stamp written by a **workflow
agent, subagent, cron/scheduled close, or headless SDK run** never passes through that hook, so the
mutation lands on the primary tree unguarded — exactly the hole `we:scripts/guard-lane.mjs` already
closes for the Edit/Write tools, but left open for the CLI's own file writes.

## Fix

Shift-left to the **source** (the #883 "enforce at write-time" philosophy already applied to the
locus-prefix scan in `writeBacklogMd`). Add an unconditional primary-checkout guard at the entry
of the **same verb set** `we:scripts/guard-bash.mjs` blocks — `cost`, `claim`/`resolve`/`release`,
`scaffold`, `settle`, `retype`, `yield`, `prepare-stamp` — keyed on the **realpath of the target
card file** (reuse `laneGuardDecision`/`resolveReal` from `we:scripts/guard-lane.mjs`, the single
source of truth for "is this path a primary checkout"). Deny unconditionally (no override), matching
#2339 — nothing ever splices to primary.

**Do NOT** put the guard inside `writeBacklogMd` itself: the numbering-repair verbs
(`number-stranded`) and the drain's JIT-numbering (`numberPendingHashes`, imported from
`we:scripts/lane-drain.mjs`) legitimately rewrite card files in the primary/land checkout and must
stay allowed — so the guard belongs at the verb entry points, mirroring guard-bash's deliberate
carve-out.

## Done when

- The nine item-mutation verbs refuse to write a card file whose realpath is under a constellation
  primary checkout, regardless of invocation channel (Bash tool, subagent, workflow, cron, headless).
- Numbering-repair + drain JIT-numbering remain allowed in the primary/land checkout.
- A unit test covers: primary target → denied; lane-clone target → allowed; numbering verb in
  primary → allowed.
- `check:standards` green.
