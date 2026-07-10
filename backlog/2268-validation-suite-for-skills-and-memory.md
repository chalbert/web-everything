---
kind: epic
status: resolved
dateOpened: "2026-07-04"
dateResolved: "2026-07-10"
graduatedTo: none
tags: [agent-tooling, skills, memory, regression, testing]
---

# Validation suite for skills and memory

A replayable regression suite that seeds test cases from **project history** and runs
them against our skills, their scripts, the hooks, and the memory system — so a change
to any of them **proves it breaks nothing** before it lands. Today the agent tooling
(~46 `we:scripts/*.mjs`, 16 `we:.claude/skills/*`, and the memory system —
`we:MEMORY.md` + `we:memory/*.md` + `we:.claude/agent-memory/*.md`) is only *partially*
guarded (`we:scripts/check-memory.mjs`, `we:scripts/check-backlog-workflow.mjs`,
`we:scripts/memory-freshness.test.mjs`). This epic turns that scattered checking into
one history-seeded regression harness.

## Two tiers — the split decides CI vs session

The surface divides cleanly, and the division is what makes part of it automatable:

- **Tier A — deterministic script layer (CI-able).** The scripts skills sit on:
  `we:scripts/backlog.mjs` (scaffold/resolve/settle), the `we:scripts/check-*.mjs`
  gates, and the hooks (`we:scripts/lint-locus-prefix.mjs`, `we:scripts/guard-bash.mjs`,
  `we:scripts/guard-lane.mjs`). Pure input to (files + exit code), so **golden/snapshot
  tests** seeded from real history. Runs in CI.
- **Tier B — judgment skills (session-only).** `batch`, `drain`, `finish`, `next`,
  `review-program` — LLM-driven, no deterministic output. Validated by **replaying the
  real skill in an ephemeral, revertible git worktree**, asserting invariants against
  the resulting tree, then discarding the worktree. Run from session, not CI.

Both tiers assert against a shared **invariant catalogue** and run off a shared
**golden corpus** mined from git history — the "dry mode / revertible test branch"
idea, realized as worktree-replay rather than a per-skill `--dry-run` retrofit
(see the substrate decision #2274).

## Slices

- **#2274** (decision) — execution substrate: dry-run flags vs revertible worktree.
- **#2271** (story) — invariant catalogue: the must-never-break guarantees both tiers assert.
- **#2270** (story) — harvest a golden corpus of fixtures from git history (idempotent).
- **#2273** (story) — Tier-A deterministic snapshot harness, wired into CI.
- **#2272** (story) — Tier-B session-replay harness for judgment skills in a worktree.

## Related (cross-ref, not duplicated)

- **#2086** — extract & unit-test the batch carry-forward/reopen logic — folds into Tier-A (#2273).
- **#2266 / #2265** — relocate agent-memory + skills SoT out of `.claude`; fixtures want a
  stable home, so this is a soft prerequisite for the corpus (#2270).
- **#1855** — model-usage watch; **#1220** — stress-test skill (natural-language skill exercise).
