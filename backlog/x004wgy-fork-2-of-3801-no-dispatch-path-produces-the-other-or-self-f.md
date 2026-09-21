---
kind: story
size: 2
parent: "3717"
status: open
scope: ["we:scripts/lib/dispatch-contracts.mjs", "we:scripts/lib/__tests__/dispatch-contracts-profile.test.mjs", "we:scripts/lib/dispatch-task-type.mjs", "we:scripts/lib/__tests__/dispatch-task-type.test.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Fork 2 of #3801: no dispatch path produces the other or self-fix task type; remove the two G1 defaults that still yield other

Ruled in #3801 Fork 2 (a): self-fix and other are never produced, and conflict-resolution comes only from a fix with the conflict cause. The #3717 path already holds this (TASK_TYPES_WITHOUT_PRODUCING_KIND in we:scripts/lib/dispatch-task-type.mjs), but two G1 defaults still yield other: TASK_TYPE_BY_CARD_KIND maps task and epic to other (we:scripts/lib/dispatch-contracts.mjs:83) and deriveDispatchProfile falls back to other (:392). Both are removed or made to refuse with a named reason.

**Home:** the prototype branch `lane/mechanical-dispatcher` (both files exist only there, checked on `5ab89f87b`). Commit straight to the branch, no PR, one tracker note on #3383 per push; it reaches `main` through #3443.

**Not in this slice:** re-labelling `main`'s 10 `other` and 1 `self-fix` trial rows. #3801 Fork 2 proposes none.

## Done when

1. **Executable** — on the branch, `grep -n "TASK_TYPE_BY_CARD_KIND = " we:scripts/lib/dispatch-contracts.mjs` shows no `'other'` or `'self-fix'` value (today it shows `task: 'other', epic: 'other'` at `:83`).
2. **Executable** — `npx vitest run we:scripts/lib/__tests__/dispatch-contracts-profile.test.mjs we:scripts/lib/__tests__/dispatch-task-type.test.mjs` passes with new cases that fail before: `deriveDispatchProfile` on a card of kind `task`, of kind `epic`, and with no kind and no `taskType` returns `ready: false` with a named reason instead of a profile whose `taskType` is `other` (`:392`); a `fix` without the `conflict` cause never derives `conflict-resolution`.
