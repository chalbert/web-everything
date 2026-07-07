---
kind: story
size: 3
parent: "2015"
status: resolved
locus: frontierui
blockedBy: ["1974"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-07"
dateResolved: "2026-07-07"
tags: []
---

# FUI: text-field + number-input to persistent host (keep factory parity)

Migrate fui:blocks/text-field/TextFieldElement.ts and fui:blocks/number-input/NumberInputElement.ts off transient self-erasure: both already build the full <div class=fui-*>…<input> structure via their factory in decorate (fui:blocks/text-field/TextFieldElement.ts:39-44, fui:blocks/number-input/NumberInputElement.ts:34-38) — the migration makes the host persist instead of self-erasing, keeping factory↔element parity single-renderer (no second render path). Update both blocks' unit tests. Locus: frontierui.

## Resolution (2026-07-07) — frontierui PR #17

Reparented both `we-text-field` and `we-number-input` onto the #2028 `fui:blocks/light-leaf/LightLeafElement.ts` **(B) wrap-a-real-native-child** shape (`resolveTag()` → `childTag()` returning `'div'`). The host now persists as a `display:contents` box **wrapping the factory's own `<div class="fui-text-field">` / `<div class="fui-number-input">` node verbatim** — `decorate()` still delegates to `createTextField` / `createNumberInput` unchanged (adopting the factory output onto the case-B-created div), so element↔factory parity holds through the **one** renderer (no second render path). The inner native `<input>` participates in forms / a11y directly (the host is box-transparent). Class names unchanged (`TextFieldElement` / `NumberInputElement`, no type collision). Both blocks' unit tests updated to the persistent-host shape (10 element tests green); render rests on the base **(B)** coverage in `fui:blocks/__tests__/unit/light-leaf/LightLeafElement.test.ts` (`display:contents` is layout-transparent). Landed as **frontierui PR #17** (`ready-to-merge`); the WE-side status splice is this change.
