---
kind: story
size: 3
parent: "1399"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
tags: [discovery, lens, teardown, empirical, gap, book-candidate]
---

# Discovery lens — production-app teardown (inventory real apps, diff registry)

Run the [discovery](/backlog/1399-latent-standard-discovery-lens-catalogue-each-lens-only-emit/)
discipline **empirically**: pick a best-in-class production app, inventory every distinct interaction /
behavior / surface it ships, and diff against [we:src/_data/intents/](../src/_data/intents/) +
[we:src/_data/blocks/](../src/_data/blocks/). Highest-yield, noisiest lens — real apps combine patterns the
abstract taxonomies miss, but a teardown needs deliberate filtering so app-specific quirks don't become
spurious cards. One app per pass.

## Do

- Choose one app (e.g. Linear, Figma, Notion, Stripe dashboard, Gmail, Google Maps); state which.
- Walk it surface-by-surface; list each distinct pattern (not each screen).
- Verdict each: covered / partial / ❌. File `book-candidate` cards only for patterns that are *general*
  (would recur across apps), not app-specific; placement-unsure → `decision`.

## Run 1 — 2026-06-21 (app: **Linear**)

Chose **Linear** (keyboard-driven issue tracker — dense, pattern-rich). Walked the issue list, board,
detail peek, editor, and command surfaces; verdicted each distinct pattern.

**Covered:** command palette (Cmd-K) → `command`; keyboard shortcuts → `command` + `keyboard-shortcuts`;
virtualized issue list → `windowed-collection` + `data-table`/`data-grid`; filter/sort/group →
`collection-operations`; search → `type-ahead`; contextual right-click menu → `menu`; toasts →
`notification`; collapsible sidebar nav → `nav-list` + `disclosure`; breadcrumb → `breadcrumb`; detail peek
panel → `master-detail`; status/priority badges → `status-indicator` + `tag`; date fields → `date-picker`;
markdown editor → `rich-text-editor`; URL-encoded filters → `navigation` + `router`; multi-select (shift/cmd)
→ `selection`.

**Already filed / routed:** inline edit (click-to-edit a field) → [#1397](/backlog/1397-in-place-inline-edit-edit-in-place-editable-cell-standard-pl/);
optimistic updates → [#1395](/backlog/1395-optimistic-mutation-apply-reconcile-rollback-standard-placem/);
real-time collab + live cursors / presence → [#1420](/backlog/1420-offline-first-sync-realtime-conflict-resolution-standard-pla/);
kanban 2-D drag → [#1384](/backlog/1384-spatial-manipulation-arrangeable-surfaces-resizable-splitter/).

**Gap filed (general, placement-unsure → decision):**
- **Bulk actions over a multi-selection** (selection action bar + batch apply) →
  [#1423](/backlog/1423-bulk-actions-over-a-multi-selection-selection-action-bar-bat/) — recurs across
  Gmail/Drive/Notion/file managers; `selection` owns the choice, `command` owns single-invoke, neither owns
  the batch-apply surface.

**Set aside (app-specific or a dimension, not a general standard):**
- *Slash-command menu in the editor* (`/` → inline command list) → a `rich-text-editor` + `command` +
  `autocomplete` composition; editor-feature, not a new standard.
- *Saved views / filter presets* → a persisted-config **dimension** of `collection-operations` +
  `draft-persistence`, not its own standard.
- *Cycle/sprint burndown, triage inbox, sub-issue trees* → Linear-domain features (tree is `tree-select`);
  app-specific, not general.

## Done when

One app fully walked, each distinct pattern verdicted, generalizable gaps filed as cards, app-specific ones
explicitly set aside with a reason.
**Round 1 complete (2026-06-21, Linear) — 1 card filed (#1423 bulk-actions); rest covered, routed, or set aside.**
