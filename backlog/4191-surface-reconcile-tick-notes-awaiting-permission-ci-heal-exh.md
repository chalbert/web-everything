---
bornAs: xg460kw
kind: story
size: 3
parent: "4075"
status: active
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/operations/operator-queue.mjs"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-26"
tags: []
---

# Surface reconcile/tick notes (awaiting-permission, ci-heal-exhausted) to the operator

we:scripts/conveyor/reconcile-core.mjs#planReconcile emits an 'awaiting-permission' note and we:scripts/conveyor/tick-core.mjs#planTick emits a 'ci-heal-exhausted' note (surfaced live 2026-09-25 on PR #2703/#2636), but neither reaches a deterministic operator-facing surface today: planReconcile's notes only print through we:scripts/conveyor/reconcile-pass.mjs's CLI text/--json output, and planTick's notes only reach the operator when an interactive runner session happens to be attending and chooses to relay decisions.notes (we:skills-src/conveyor/SKILL.md). Nothing wires either into we:scripts/operations/operator-queue.mjs or a PR comment. Surface both kinds there and/or as a gh pr comment so they are seen without a human polling raw CLI output or an attending session's judgment.

## Done when

1. **Executable** — a test shows a `planReconcile` `awaiting-permission` note and a `planTick` `ci-heal-exhausted` note both landing in `we:scripts/operations/operator-queue.mjs`'s read model (or as a queued `gh pr comment` payload) — fails before this lands (neither reaches that module today) and passes after.
2. **Live proof** — with one real PR carrying an unresolved `awaiting-permission` or `ci-heal-exhausted` condition, before: neither `node we:scripts/operations/run.mjs operator-queue` nor the PR's own comments mention it. After: one of them does.
3. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
