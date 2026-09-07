---
kind: story
size: 3
parent: "x4e6mib"
status: open
scope: ["we:scripts/operations/file-item.mjs", "we:scripts/operations/file-item-io.mjs", "we:scripts/operations/__tests__/file-item.test.mjs", "we:docs/agent/backlog-workflow.md"]
dateOpened: "2026-09-07"
tags: []
---

# Per-epic approval policy gates file-item's auto-queue decision (epic-level override, auto stays the default)

Extends we:scripts/operations/file-item.mjs's planQueueing (currently: refuse to queue only for --queue=false, kind:epic/decision, or born-active) with one more check: before clearing a story/task into we:.conveyor/queue.json, look up its parent epic's own new optional approvalPolicy frontmatter field (auto|manual, default auto when absent -- zero behavior change for every existing/un-annotated epic). When the resolved policy is manual, planQueueing returns queueing:false with reason 'awaiting human approval (epic <parent> policy: manual)' -- the card still files successfully (write effect unaffected), it just is not auto-cleared. No new per-item approve mechanism is needed: we:scripts/conveyor/queue.mjs's existing 'add <NNN>' already unconditionally clears any single item by id (confirmed live 2026-09-07 -- it never checks policy today, per we:backlog/3587), so an operator naming an id there already IS the explicit human sign-off for that one item, the same 'naming it is the instruction' shape we:.claude/skills/mechanical-delivery-doctrine/SKILL.md rule 6 already establishes for clear-human. This slice covers EPIC-LEVEL granularity only -- category-level (e.g. auto-approve by tag) and a global manual-everything default are deliberately deferred; see the open decision this epic's sibling item states.

## Done when

1. **Executable** — a new test in we:scripts/operations/__tests__/file-item.test.mjs calls `planQueueing` with a
   `parentPolicy` (or equivalently named) input of `'manual'` and asserts `{ queueing: false, reason: '...manual...' }`
   — fails against today's code (which has no such input/behavior at all) and passes once
   we:scripts/operations/file-item.mjs is fixed.
2. **Executable** — the same suite asserts `planQueueing` behaves IDENTICALLY to today (unchanged) when
   `parentPolicy` is `'auto'`, absent, or the parent has no `approvalPolicy` field at all — the default-auto
   invariant this slice must not regress for every existing, un-annotated epic.
3. **Executable** — a lane-clone smoke test: file a scratch story under an epic card carrying
   `approvalPolicy: manual` via `node we:scripts/operations/run.mjs file-item`, then confirm via
   `node we:scripts/conveyor/queue.mjs list` that the new story's id is NOT present — absent today's fix (it
   would be auto-cleared), present-as-absent after.
4. we:docs/agent/backlog-workflow.md documents the new optional epic frontmatter field: `approvalPolicy: auto |
   manual` (default `auto` when absent), scoped explicitly to epic cards, with a short note that a `manual`
   epic's children still file successfully — they are simply not auto-cleared, and remain approvable one at a
   time via the existing we:scripts/conveyor/queue.mjs's `add <NNN>` action (no new approve-mechanism needed
   at the CLI level for this slice — confirmed live 2026-09-07 that we:scripts/conveyor/queue.mjs's `add`
   already unconditionally clears any named id regardless of policy, which is itself the human sign-off
   gesture for that one item).
5. `npm run check:standards` shows no new errors and no new warnings against the observed baseline (disclose the
   baseline delta in the PR body per this repo's convention — do not hardcode a number here).

## Grounding

- we:scripts/operations/file-item.mjs:83-113 — `planQueueing`, the exact function this slice extends; its three
  existing refusal branches (`--queue=false`, `NON_DISPATCHABLE_KINDS`, born-`active`) are the pattern a fourth
  branch (parent-policy) follows.
- we:scripts/operations/file-item.mjs:159-165 — the `plan` step's `reads` list, which will need to grow to
  include whatever new fact carries the parent's `approvalPolicy` (read via the io shell, mirroring how
  we:scripts/conveyor/queue.mjs's own `kindOf` (:52-77) already reads a card's frontmatter directly by id/`bornAs`
  match — the same lookup shape, reused rather than reinvented).
- we:scripts/conveyor/queue.mjs:44-49 — `NON_DISPATCHABLE`, confirming we:scripts/conveyor/queue.mjs's `add`
  action only ever WARNS on epic/decision kinds, never refuses — i.e. we:scripts/conveyor/queue.mjs's `add
  <NNN>` is already an unconditional, always-available per-item override an operator can use as the explicit
  "yes, queue this one" gesture, so this slice does not need to build a parallel approve-mechanism at the CLI
  layer.
- we:backlog/3587-file-item-can-never-queue-a-decision-or-epic-even-on-explici.md — confirms
  we:scripts/conveyor/queue.mjs's add-with-warning (never refuse) behavior is the standing convention
  we:scripts/operations/file-item.mjs's own `planQueueing` is meant to mirror for dispatchability refusals;
  this slice's new `manual`-policy refusal follows the same "refuse queueing, never refuse filing" shape
  already established there.
- Confirmed live 2026-09-07 (this item's own research): we:.conveyor/queue.json membership (added via
  we:scripts/conveyor/queue-store.mjs's `addToQueue`) is TODAY's only human-OK gate — nothing in
  we:scripts/conveyor/tick-core.mjs, we:scripts/readiness/dispatch-plan.mjs, or any `*watch*.mjs` pass ever
  calls `addToQueue` on a later tick once an item's `blockedBy` clears; a cleared-but-blocked row simply flows
  into `plan.launch` the moment `openBlockers` hits 0. This means gating at file-item's own clear-time (this
  slice's only change) is sufficient for v1 — no separate "re-check on unblock" mechanical pass is needed,
  because none exists today for the ungated case either.
