---
bornAs: x4dx7f2
kind: decision
parent: "3383"
status: open
dateOpened: "2026-09-07"
tags: [infra, conveyor, contention, decision]
---

# Structural fix for we:skills-src/conveyor/runner.mjs's makeCliMechanicalPasses repeat-edit contention

we:skills-src/conveyor/runner.mjs's makeCliMechanicalPasses function (485-line file) is a confirmed repeat hotspot: `git log --since='14 days ago' -- we:skills-src/conveyor/runner.mjs` shows 9 commits in 14 days, essentially every one of them adding one more `runQuiet('we:conveyor/<new-watch>.mjs', [...])` line to this same function body as each new mechanical pass (parked-pr-conflict-watch, duplicate-pr-watch, reconcile-fix-dispatch, branch-drift, review-reconcile dispatch, etc.) landed. we:scripts/readiness/dispatch-plan.mjs's `branch-drift-blocked` hold already guards against two concurrent dispatch streams editing this same file at once (confirmed working) — this decision is about the underlying problem the hold is compensating for, not the hold itself.

Fork — structural options to reduce how often new work has to touch this one function body: (a) Plugin/registry pattern — makeCliMechanicalPasses iterates a declared array/registry of pass descriptors (name, script path, args) instead of a hardcoded sequence of runQuiet(...) calls; a new pass adds one array entry, ideally in its OWN small registration file under a new we:scripts/conveyor/passes/ (or similar) directory that self-registers, so most new passes never touch we:skills-src/conveyor/runner.mjs's body at all. Mirrors the pattern each sibling watch (we:scripts/conveyor/branch-drift.mjs, we:scripts/conveyor/duplicate-pr-watch.mjs) already uses for the pass ITSELF (a standalone file with its own sweep verb) — this extends the same idea one level up, to the registration point. (b) Split the file — pull makeCliMechanicalPasses out of we:skills-src/conveyor/runner.mjs into its own module (e.g. we:skills-src/conveyor/mechanical-passes.mjs), shrinking the file two concurrent edits are likely to collide on, without changing the registration shape itself — lower effort than (a), smaller payoff (still one function body every new pass edits, just in a smaller file). (c) A custom git merge driver scoped to this function/file, configured to auto-resolve pure line-insertion conflicts (each new pass adds a single line in a stable position) — no code restructuring needed, but fragile: a real semantic conflict (two passes inserted at the exact same line, or one edit touching pass ORDER, which matters here since we:backlog/3571-runner-tick-loop-mechanical-passes-starve-behind-a-long-disp.md's own root cause was pass ORDERING) would auto-resolve incorrectly and silently, the worst failure mode for delivery-critical dispatch code — not recommended as a primary fix.

Recommended default: (a) — it's the only option that actually reduces the collision surface (most new passes add a file elsewhere, not a we:skills-src/conveyor/runner.mjs edit) rather than just shrinking or automating around it, and it reuses a pattern (self-contained pass file + sweep verb) already proven safe by every sibling watch this function calls. (b) is a reasonable lower-effort interim step if (a) is judged too large a refactor to prioritize now. Existing test we:scripts/conveyor/__tests__ coverage asserting the exact mechanical-pass set (we:backlog/3501-assert-the-exact-mechanical-pass-set-makeclimechanicalpasses.md) would need updating under either (a) or (b) — flagged, not a blocker.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
