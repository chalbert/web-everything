---
kind: story
size: 3
status: resolved
locus: frontierui
blockedBy: ["1492"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: frontierui/blocks/radio/Radio.ts
tags: [intent, selection, deselect, radio]
---

# FUI radio — toggle-off path + clear affordance (deselectable)

Ratified #1470: add the single-select deselect behavior to fui:blocks/radio/Radio.ts. Today select(index) sets el.checked = i===index across all options with no toggle-off path, so once a value is chosen exactly one stays checked forever. Add: re-activating the already-selected option clears it to no-selection (the survey's dominant radio trigger), gated on the deselectable config (default true, mirrors #1492 axis); roving-tabindex + onChange fire with an empty/undefined value on clear; a11y verified. Blocked by #1492 (consumes the deselectable axis). locus: frontierui.

## Progress

Landed (locus frontierui):
- `fui:blocks/radio/Radio.ts` — added `deselectable?: boolean` to `RadioGroupConfig` (default `true`, mirrors the #1492 selection-intent axis). Native radios fire no `change` on re-click of a checked option, so the per-input handler moved from `change` → `click` (which also catches Space activation): a click on an unchecked option selects it; a click on the already-selected option (tracked via a `selectedIndex` because the browser sets `checked=true` before `click` fires) clears to no-selection. A new `clear()` unchecks every option, keeps the just-cleared option as the single Tab stop (roving-tabindex preserved, focus stays put), and fires `onChange('')`. `deselectable:false` keeps the classic exactly-one-forever radio.
- `fui:blocks/__tests__/unit/radio/Radio.test.ts` — migrated the selection test to `click` and added 5 toggle-off cases (clear-to-none, toggle back on, deselectable:false, clear an initial value); 14/14 green.
- `check:standards` (frontierui) 0 errors.
