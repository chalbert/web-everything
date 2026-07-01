---
kind: story
size: 1
status: open
blockedBy: []
dateOpened: "2026-07-01"
tags: [backlog-ui, prioritisation, design-review, css, tokens]
---

# Dedupe the Prioritisation toggle pressed-state tint with the selected-chip token

The pressed state of the Prioritisation table's ON/OFF toggles (`[data-psplit]` "Splittable only", `[data-pfiller]` "Hide low priority") reuses the **exact** accent tint of a selected facet chip (`we-filter-chip[selected]`) — but declares it independently, via a bespoke `[aria-pressed="true"]` rule in `we:src/css/style.css`, rather than referencing the same class or custom property. Two sources for one tint: if the selected-chip accent changes, the toggles silently drift out of parity.

## Scope
- In `we:src/css/style.css`: the `we-filter-chip[data-psplit|data-pfiller][aria-pressed="true"]` rule duplicates the accent-tint declaration from `we-filter-chip[selected]`.
- Factor the shared tint to one source of truth — a `--chip-selected-*` custom property or a shared selector both rules reference — so selected-facet and pressed-toggle stay locked together.
- **No visual change intended.** Confirm parity with `/review-design` (axis **#5 consistency / token use**) before/after; the pressed background must stay byte-identical.

## Lineage
Surfaced 2026-07-01 in the `/review-design` (#1034 rubric, v2) pass on the backlog Prioritisation UI. Open finding `{dimension: consistency, elementRef: "pressed-toggle CSS", severity: 1}`. Relates to the design-token consistency axis (#364 tokens).
