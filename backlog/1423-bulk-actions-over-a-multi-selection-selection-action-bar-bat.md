---
kind: decision
size: 3
parent: "099"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#composition-artifact-ownership"
tags: [decision, book-candidate, bulk-actions, selection, gap]
relatedReport: reports/2026-06-21-bulk-action-selection-fanout.md
preparedDate: "2026-06-21"
---

# Bulk actions over a multi-selection — selection action bar + batch operations standard: placement

## Ruling (ratified 2026-06-21)

Both forks ratified **as recommended**:

- **Fork 1 → (a)** — the batch-apply concern is a thin **`bulk-action` intent** composing
  `selection` + `command` over a target set, realized by a FUI behavior block. (b) a `selection` trait
  and (c) a headless behavior with no intent are both *broken* — (b) forces selection→command coupling
  against `we:src/_data/intents/command.json`'s declared orthogonality; (c) leaves the recurring named pattern un-contracted
  (correct only as the impl half of (a)). Net-new residual owned by no neighbor: fan-out across the live
  selection set, the select-all `matching` predicate, the partial-failure outcome, and the count-announce
  binding. Confidence ~85%.
- **Fork 2 → (a)** — expose `scope: visible | matching`, default **`visible`** (accident-protected;
  `matching` is the author opt-in carrying a predicate). Mandating one is broken under most-flexible-default
  (both ship deliberately). The predicate *shape* stays impl-ish — the intent names the axis. Confidence ~80%.

**Red-team** (Fork 1, "it's just toolbar+selection+command, home it as an assemblerPreset"): lands partially
— most of the bar is reuse — but fails on the load-bearing residual a preset can't carry (fan-out, the
`matching` predicate, partial-failure, count binding). Attack does not break (a).

**Seam to watch:** the partial-failure outcome (per-target success/fail) *names* the contract and *delegates*
apply/rollback to a future #1395-style optimistic-mutation home — no forward dependency created, but the
seam most likely to need revisiting if #1395 lands differently.

Realizing work (separately prioritized) carved as a follow-up build item.

Surfaced by the production-app teardown lens
([#1404](/backlog/1404-discovery-lens-production-app-teardown-inventory-real-apps-d/), Linear walk): selecting
several rows reveals a **contextual action bar** offering operations applied to the **whole selection**
(move, assign, label, delete), with select-all / clear-selection affordances and an a11y announcement of "N
selected" ([prior-art survey](/research/bulk-action-selection-fanout/)). This recurs across Gmail, Linear,
Google Drive, Notion, file managers — a *general* pattern, not app-specific.

The axis the prep pins to the real tree: WE owns the pieces but not the composition.
[we:src/_data/intents/selection.json](../src/_data/intents/selection.json) models the *choice* (which items),
[we:src/_data/intents/command.json](../src/_data/intents/command.json) / `action` model a *single* invocation
(one `CommandEvent`), and the action-*bar* is already homed by the #1409 toolbar placement
([we:src/_data/assemblerPresets/toolbar.json](../src/_data/assemblerPresets/toolbar.json) + `focus-delegation`
+ `composite-widget`). Neither owns the **batch-apply binding**: fanning one command across the live
selection set's N targets, select-all (`visible` vs `matching`) + the `mixed` header + clear, the "N
selected" `aria-live="polite"` count, and post-action focus return. Polaris (`bulkActions` /
`promotedBulkActions`) and Carbon (`TableBatchActions`) both ship this as a **first-class named API**, and
MUI X documents it as a *composition* (read `selectedRows` in a custom toolbar), not a built-in.

### Triage context

- **Kind**: Intent (composes `selection` + `command`) + FUI behavior block · **Native grounding**: ARIA live region (`aria-live="polite"`), `role="toolbar"`, `aria-checked="mixed"`, listbox/grid multi-select
- **Native-first**: ▽ low (all native/ARIA + existing intents) · **Gap**: ◆ medium · **Effort**: ◆ medium · **Surfaced by**: #1404 (production-teardown lens)

### Recommended path at a glance

Ratify both rows, or override just the one you'd change. **Confidence** says where judgment is actually needed.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · home** | a thin **`bulk-action` intent** composing `selection` + `command` over a target set (+ FUI behavior) | a `selection` extension/trait *(rejected — forces selection→command coupling)* · a headless behavior only *(rejected as sole home — no contract)* | **~85%** — Polaris/Carbon name it; net-new fan-out semantics |
| **2 · select-all model** | a `scope: visible \| matching` dimension, default **`visible`** | mandate one *(rejected — both ship deliberately)* | **~80%** — most-flexible default; `matching` is a predicate |

## Fork 1 — where does the batch-apply concern live?

*Fork-existence:* real — two branches are **broken** on the separation/coexistence bias. **(b) a `selection`
trait** is broken: it forces `selection` (the *choice*) to own `command` fan-out, contradicting
`we:src/_data/intents/selection.json`'s scope and the command-orthogonality `we:src/_data/intents/command.json` asserts (selection must not depend on
command). **(c) a headless behavior with no intent** is broken as the *sole* home: WE owns contracts, so a
behavior with no contract leaves the recurring named pattern un-standardized (it is correct only as the
*impl half* of (a)). The genuine choice is the contract's home shape.

**Fork 1 (a) — a thin `bulk-action` intent composing `selection` + `command` over a target set
(recommended, ~85%).** It models fan-out + select-all-scope + count-announce + focus-return as a small
contract; a FUI behavior block realizes it (the usual intent→block seam). The concern recurs independently
(Polaris/Carbon name it; Gmail/Linear/Drive/Notion repeat it) and owns a real residual neither neighbor
owns — a *thin composition*, exactly the intent layer's job.

**Fork 1 (b) — a `selection` extension / "selection actions" trait (rejected).** The broken branch above.

**Fork 1 (c) — a headless behavior only, no intent (rejected as sole home).** Correct only as the impl half
of (a).

*The residual (~15%):* it could be expressed as an `assemblerPreset` (composition recipe) beside the
`toolbar` preset rather than a first-class intent — but unlike the toolbar preset it carries *net-new
semantics* (fan-out + select-all-matching predicate + the count contract), which clears the bar for an
intent.

## Fork 2 — select-all model: mandate matching, or expose it as a dimension?

*Fork-existence:* real but soft — both `visible-only` and `matching` are legitimate end-states (Gmail/MUI
ship both deliberately), so mandating one is the **broken** branch (most-flexible-default).

**Fork 2 (a) — expose `scope: visible | matching`, default `visible` (recommended, ~80%).** `visible` is the
safe/accident-protected default (Gmail's two-step); `matching` is the author opt-in and carries a
predicate/exclusion-set rather than an id-list.

**Fork 2 (b) — model only the id-set (visible), defer matching (rejected).** Drops a load-bearing,
universally-shipped capability.

*The residual:* the predicate representation for `matching` is impl-ish — the intent names the *axis* and
leaves the predicate shape to the behavior/data layer.

---

### Supported by default (not forks)

- **"N selected" via `aria-live="polite"` / `role="status"`** (not `assertive`).
- **Indeterminate header checkbox = `aria-checked="mixed"`** (click-on-mixed → select-all, again → clear).
- **Multi-select input reuses the existing `SelectionBehavior`** (`aria-multiselectable` / `aria-selected`)
  — bulk-action *consumes* it, never reimplements.
- **The action bar reuses the existing toolbar** (`role="toolbar"` + focus-delegation roving tabindex) —
  bulk-action *binds* the bar to the selection set, doesn't own the bar.
- **Each bar action is a `command` invocation; bulk-action fans it** — no new invocation primitive.
- **Post-action focus return** = a focus-delegation concern.
- **Promoted-vs-overflow action partitioning** (Polaris `promotedBulkActions`) is a presentational option of
  the bar, supportable later; not load-bearing to the contract.
- **Intent contract + FUI behavior-block realization coexist** at different layers.

### Seams

- **vs `selection` (the choice):** one-way dependency bulk-action → selection; selection stays oblivious to
  commands (preserves command orthogonality).
- **vs `command` (single invoke):** bulk-action's net-new verb is **fan-out** — invoke one command across N
  targets. command must not learn about selection; bulk-action is the composer holding both.
- **vs #1409 toolbar (the bar container):** the toolbar owns the *bar*; bulk-action owns the **binding of
  that bar to the live selection set** (show on ≥1 selected, the count region, select-all/clear, fan-out).
- **vs a future #1395-style optimistic mutation:** a batch of N mutations is the natural consumer of
  optimistic-apply/reconcile/rollback; bulk-action *names* the **partial-failure** outcome contract
  (per-target success/fail) and *delegates* the apply/rollback mechanics — don't duplicate it here.

### Realizing work (post-ratification, separately prioritized)

If Fork 1 (a) + Fork 2 (a) ratify: author the `bulk-action` intent JSON (`scope`, the fan-out + count +
focus-return contract, the partial-failure outcome) + the FUI behavior block + a demo (a selectable list
with a contextual action bar). File via `/new-standard`. Not part of this placement call.
