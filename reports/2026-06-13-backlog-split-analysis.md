# Backlog split analysis — 2026-06-13

Focused run: `/slice 468`.

## Candidate

**#468 — Form-control block inventory — datepicker, timepicker, input family, toggle/radio/checkbox**
`workItem: epic` · `size: 5` (residual — must drop) · `parent: "099"` · no children → **unsliced epic
(kind b)**. The decision to decompose is settled at the epic level; its body literally says "Slice into
per-control blocks when relevant." So conditions (2)–(5) are evaluated per slice, and (1) within each.

Body lists six controls not yet itemized: **datepicker, timepicker, text/number/currency/phone/mask
inputs, toggle/switch, radio, checkbox**. Existing neighbours: #177 (form block), #359 (date/time/range
picker), #175 (slider, resolved), #176 (segmented, resolved).

## Could split

| Slice | workItem · size | Scope | DAG |
|---|---|---|---|
| **Input family block** (text / number / currency / phone / mask) | story · 3 | One block enhancing `<input>` across the text-ish types — typing/format/mask affordances, native-first over `type=text\|number\|tel`. | independent |
| **Checkbox block** | story · 2 | Native-first over `<input type=checkbox>` — single + group, indeterminate. | independent |
| **Toggle / switch block** | story · 2 | `<input type=checkbox>` + `role=switch` — boolean on/off. Author already lists separately from checkbox. | independent |
| **Radio group block** | story · 2 | Native-first over `<input type=radio>` group — single-select; composes Selection Intent `single` + Focus Delegation `roving`. | independent |

**Slice DAG:** four independent leaves under epic #468 — no inter-slice `blockedBy` edges. Each is a
thin enhancement of a native form element, re-estimates to `size ≤ 3`, names its own files, buries no
fork, and is independently demoable via a fixture-driven block demo (mirrors how #175/#176 graduated).
All four are immediately batchable. Conditions (2)–(5) hold for each.

## Could not split

| Sub-item | Failed condition | Unblocking action |
|---|---|---|
| **datepicker** | (1) buried fork — scope overlaps #359 "Date / time / range picker block" (covers date **and** time **and** range, calendar-based). Slicing a datepicker block here duplicates #359. | **Reconcile #468 ↔ #359 scope** (Tier-B decision): does the single-value date picker live as its own block here, or is it a variant of #359's calendar picker? #359 is itself a `size·8` story under gap-sweep #315 flagged "groom/split before building" — reconcile in that split, not this one. |
| **timepicker** | (1) buried fork — same overlap with #359 (which explicitly includes "time"). | Same reconciliation as datepicker. |

datepicker/timepicker stay described in #468's umbrella body as "held pending #359 reconciliation"; #468
remains their open tracker until the call is made.

## Proposed mutation (gated on go)

- Leave #468 an `epic` in place (kind b — no story→epic conversion); **drop residual `size: 5`**; refresh
  digest to umbrella framing noting datepicker/timepicker held pending #359.
- Scaffold 4 children under `--parent=468`: Input family · Checkbox · Toggle/switch · Radio group — all
  `story`, no `blockedBy` edges (independent).
- Net flow: **+4**, #468 stays epic. Gate on `npm run check:standards`. Then `/batch` can chain the four.
