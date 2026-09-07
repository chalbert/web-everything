---
kind: task
parent: "3383"
status: open
scope: ["we:scripts/operations/file-item.mjs", "we:scripts/operations/__tests__/file-item.test.mjs", "we:skills-src/file-item/SKILL.md"]
dateOpened: "2026-09-07"
tags: []
---

# file-item can never queue a decision or epic, even on explicit request -- the conveyor queue CLI itself always can

we:scripts/operations/file-item.mjs's planQueueing unconditionally refuses to queue a kind:decision or kind:epic card (NON_DISPATCHABLE_KINDS), with no override -- even an explicit --queue=true input is ignored for these kinds. This makes file-item strictly LESS capable than the sibling primitive its own header claims to fully replace, we:scripts/conveyor/queue.mjs's add action: we:scripts/conveyor/queue.mjs ALWAYS clears the item (addToQueue always runs) and only attaches a nonDispatchable warning for epic/decision -- it never refuses the add. we:scripts/operations/__tests__/file-item.test.mjs:32's own describe block asserts a false claim (NON_DISPATCHABLE_KINDS agrees with what we:scripts/conveyor/queue.mjs itself refuses to clear) -- we:scripts/conveyor/queue.mjs refuses nothing; it always clears. Consequence, confirmed by tracing we:scripts/readiness/conveyor-state.mjs's deriveDecisions/deriveNeedsSlice (#2647/#2645): both require the item's OWN buildQueued flag before it ever appears in state.decisions / state.needsSlice, the exact inputs we:scripts/conveyor/tick-core.mjs's planPrepareSpawns (mechanical prepare-decision auto-dispatch) and the /conveyor skill's own decision/epic routing read. A decision or epic filed via file-item can therefore never be armed for either surface through the declared operation -- a caller who wants one cleared immediately (e.g. because it is blocking a queued build item) has no way to do that except a raw we:scripts/conveyor/queue.mjs add shell call, the exact manual step file-item's own header says it replaces. Fix: change planQueueing so a NON_DISPATCHABLE_KINDS kind is QUEUED (not refused), carrying a nonDispatchable:true/warning note in the queuePlan finding -- mirroring we:scripts/conveyor/queue.mjs add's real, already-shipped behavior exactly -- and fix the false test claim to actually cross-check against we:scripts/conveyor/queue.mjs's NON_DISPATCHABLE map. Independent of we:backlog/3562-a-standing-mechanical-pass-keeps-the-5-highest-leverage-open.md, which separately closes the broader 'keep top-5 leverage decisions always prepared regardless of queue state' gap (confirmed open, unbuilt, filed under this same parent epic 2026-09-07) -- this item only restores file-item's parity with we:scripts/conveyor/queue.mjs's own existing, narrower clear-with-warning behavior. Also touches the same describe block we:backlog/3564-file-item-s-non-dispatchable-kinds-test-never-cross-checks-w.md flags for test drift -- fixing the real cross-check here can close that concern too.

## Done when

1. **Executable** — a new/updated test in we:scripts/operations/__tests__/file-item.test.mjs asserts that
   `planQueueing({ kind: 'decision', status: 'open' }, {})` and `planQueueing({ kind: 'epic', status: 'open' }, {})`
   both return `queueing: true` with a `nonDispatchable: true` (or equivalently named) flag/reason in the result —
   fails against today's code (which returns `queueing: false` for both) and passes once we:scripts/operations/file-item.mjs
   is fixed.
2. **Executable** — the same suite's `describe('NON_DISPATCHABLE_KINDS agrees with what we:scripts/conveyor/queue.mjs
   itself refuses to clear', …)` block (we:scripts/operations/__tests__/file-item.test.mjs line 32) is rewritten to a
   real cross-check: import we:scripts/conveyor/queue.mjs's own `NON_DISPATCHABLE` map (exporting its keys if not
   already exported) and assert `NON_DISPATCHABLE_KINDS` matches it directly — closing the same drift risk
   we:backlog/3564-file-item-s-non-dispatchable-kinds-test-never-cross-checks-w.md flags — rather than comparing
   against a hardcoded literal, and its description no longer claims we:scripts/conveyor/queue.mjs "refuses to
   clear" (it doesn't).
3. **Executable** — from a lane clone, running we:scripts/operations/run.mjs's `file-item` op to file a scratch
   `kind=decision` card, then listing the conveyor queue via we:scripts/conveyor/queue.mjs's `list` action, shows
   the newly filed card's num present in the queue sidecar — absent today, present after the fix.
4. we:skills-src/file-item/SKILL.md's "What it does, end to end" section is corrected: it currently says a
   `decision`/`epic` kind is "filed, not queued" — update it to describe the real post-fix behavior (filed AND
   queued, with a `nonDispatchable` note, mirroring we:scripts/conveyor/queue.mjs's own add-with-warning behavior).
5. `npm run check:standards` shows no new errors and no new warnings against the observed baseline (disclose the
   baseline delta in the PR body per this repo's convention — do not hardcode a number here).
