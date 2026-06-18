---
type: issue
workItem: story
size: 3
parent: "130"
status: resolved
dateOpened: '2026-06-07'
dateStarted: '2026-06-07'
dateResolved: '2026-06-07'
tags:
  - reorder
  - cross-list
  - reorderable-list
  - a11y
  - roving-tabindex
relatedReport: reports/2026-06-06-reorder-paradigms.md
relatedProject: webtraits
crossRef: { url: /blocks/reorderable-list/, label: Reorderable List block }
---

# Cross-list group loses its keyboard tabstop when focus rests on an empty list

Surfaced while pinning the empty-list fixtures in
[#151](/backlog/151-cross-list-empty-list-fixtures/). The group-wide roving-tabindex model
(`we:renderCrossListReorder.ts`) puts the single `tabindex="0"` tabstop on the **active list's focused
item**. When the active list is **empty**, there is no item to carry it, so the **whole group has
zero focusable items** — a user who Tabs in while focus rests on an empty column skips the entire
widget, and the `auditCrossListReorder` invariant *"exactly one item across the whole group is
`tabindex="0"`"* legitimately cannot hold.

This is reachable today: `reduceCrossListReorder` lets Left/Right rove focus onto an empty sibling
list (`focusIndex` clamps to 0), which is correct movement — but it leaves the composite widget with
no tabstop until focus roves back onto a non-empty list. #151 pinned this transient with a targeted
test that asserts zero focusable (honest, but documents the gap rather than fixing it).

## Scope

Decide and implement the keyboard-focus contract for an **empty active list** so the group always
keeps a tabstop:

- **Option A — focus the empty `<ul>` itself.** When the active list is empty, put `tabindex="0"` on
  the empty list container (it already carries `role="listbox"`), so Tab lands on the column and
  Up/Down/Space have an obvious "insert here" target. Closest to the listbox model.
- **Option B — skip empty lists when roving.** Left/Right hop over an empty sibling to the next
  non-empty one, so focus never rests on an empty column (an item is always the tabstop). Simpler,
  but you can't keyboard-target an empty column to drop into — which the empty-target *move* case
  (#151) needs to stay reachable, so this likely only applies to the *unGrabbed* rove.

Then **tighten the audit** to match the chosen contract (e.g. "exactly one tabstop across the group:
the focused item, or the empty active list's container") and promote the #151 targeted test from
"asserts zero focusable" to "asserts the tabstop is preserved".

## Notes

- A grabbed item crossing *into* an empty list is already fine — the item becomes the active list's
  content, so the tabstop rides with it. The gap is only the **unGrabbed rove onto an empty list**.
- Keep the pointer path in sync: an empty column must stay a valid drop target either way.

## Progress

- **Status:** resolved — **Option A** implemented (the empty active list's `<ul role="listbox">` carries the single group tabstop, so Tab always lands in the widget).
- **Branch:** docs/standard-authoring-workflow
- **Done:** `listEl` + `reconcileCrossList` put/clear `tabindex="0"` on the active list's container when empty; `auditCrossListReorder` tightened to the conditional contract; fixture case 12 (`rest-on-empty`) pins the resting state for the playground + CI; the #151 unit test promoted from "zero focusable" to "tabstop preserved", plus a reconcile guard. Full suite (1579) + check:standards (0 err) + build all green.
- **Next:** done.
- **Notes:** `we:blocks/renderers/reorderable-list/renderCrossListReorder.ts`, fixtures `we:__fixtures__/cross-list-reorder-cases.ts`, test `we:blocks/__tests__/unit/renderers/cross-list-reorder.test.ts`.
