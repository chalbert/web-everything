---
kind: story
size: 2
status: open
scope: ["we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/__tests__/reconcile-pass.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "e1f0523e0881357fc863f3e88da72e0164eb7091"
tags: []
---

# Hydration refusals come after the planner refusal so the real reason shows first

Follow-up from the #3432 advisory (2026-10-02). we:scripts/conveyor/reconcile-pass.mjs:1112 prepends hydration refusals to plan.refusals, so first-match consumers such as pr-ownership reconcileRowFor show check-read-failed instead of the PR real planner refusal. Append them after plan.refusals (or have reconcileRowFor prefer REFUSAL_KINDS entries). Test: a PR with both refusals shows the planner one.

## Progress

- Old premise: the prepend is at `we:scripts/conveyor/reconcile-pass.mjs:1112`.
- Corrected: it moved to `we:scripts/conveyor/reconcile-pass.mjs:1119 (runReconcilePass)`. The line reads `refusals: [...hydrated.refusals, ...plan.refusals]`. The rest of the premise holds.
- The first-match consumer is `we:scripts/operations/pr-ownership.mjs:102 (reconcileRowFor)`. It takes the first refusal whose `prNumber` matches. Another `.find` on refusals (`we:scripts/conveyor/soak/breaks/promote-draft-cross-repo.mjs:204`) matches on `r.pr`, not `prNumber`, so it is not affected.
- `formatReport` (`we:scripts/conveyor/reconcile-pass.mjs:955`) groups by kind (`REFUSAL_KINDS` first, then `check-read-failed`), so the printed report does not depend on array order and does not change.

## Design

Pick the card's first option: append hydration refusals after the planner refusals at the source. Change one line in `runReconcilePass`:

```js
refusals: [...plan.refusals, ...hydrated.refusals]
```

Why this over making `reconcileRowFor` prefer `REFUSAL_KINDS`: it fixes every first-match reader at once, not just one. It also needs no change outside `we:scripts/conveyor/`. Both refusals stay in the array. Nothing is dropped and no refusal is loosened. Only their order changes.

Add a short comment above the line: planner refusals come first because they name why the PR is not dispatched; a hydration refusal only says CI evidence was withheld.

## MVP

1. Swap the spread order at `we:scripts/conveyor/reconcile-pass.mjs:1119`.
2. Add the comment.
3. Add one test to `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs`, next to the other `xxh4zw8` tests.

## Test plan

The test file uses vitest (`import { vi, it, expect, describe } from 'vitest'`).

New test: `xyqb9hu a PR with both a hydration refusal and a planner refusal lists the planner refusal first`.

- Use `xxOptions()` and `xxPr()` (defined near line 931).
- `readChecks: () => { throw new Error('HTTP 502'); }` makes hydration refuse with `check-read-failed`.
- `enrichFixClaims: prs => prs.map(pr => ({ ...pr, fixClaim: { who: 'fixer-1', why: 'repairing', claimedAt: null } }))` makes the planner refuse with `fix-claimed` (`we:scripts/conveyor/reconcile-core.mjs:1512`).
- Expect `plan.refusals.find(r => r.prNumber === 3336).kind` to be `'fix-claimed'`.
- Expect `plan.refusals.map(r => r.kind)` to equal `['fix-claimed', 'check-read-failed']`. Both are still present.
- Expect `plan.dispatch` to equal `[]`.

Before the fix the first match is `check-read-failed`, so the test fails. All existing `xxh4zw8` tests filter by kind, so they keep passing.

## Proof plan

Live: run `node we:scripts/conveyor/reconcile-pass.mjs --json` on main and on the lane. For any PR number that has both a `check-read-failed` and a `REFUSAL_KINDS` refusal, record the first refusal kind for that PR. Before: `check-read-failed`. After: the planner kind. This is read-only; the pass dispatches nothing.

If no live PR has both refusals at proof time, say so. Then use the new unit test as the replay of the recorded shape: a hydration read that fails with HTTP 502 on a PR that also has a live fix claim (the #3432 advisory case).

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/reconcile-pass.test.mjs -t xyqb9hu` fails before and passes after. Test file: `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs`.
2. `runReconcilePass` returns planner refusals before hydration refusals, and keeps both.
3. The full `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs` file passes.
4. Proof-plan evidence (live or replay) is recorded on the PR.

## Follow-ups

- None needed. If a future reader also merges refusals from another source, it should follow the same rule: planner first.
