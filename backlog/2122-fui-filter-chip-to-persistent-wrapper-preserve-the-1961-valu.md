---
kind: story
size: 2
parent: "2015"
status: resolved
locus: frontierui
blockedBy: ["1974"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-07"
dateResolved: "2026-07-07"
tags: []
---

# FUI: filter-chip to persistent wrapper (preserve the #1961 value/aria-pressed surface)

Migrate fui:blocks/filter-chip/FilterChipElement.ts off transient self-erasure: the we-filter-chip host persists wrapping the native <button> (#1962 single-native-control family — the epic body's 'behaviour-free leaf in #1974' claim was a mis-family, corrected by the 2026-07-02 split analysis). Preserve the #1961 exposed surface: value copied verbatim onto the inner control, selected→aria-pressed stays the one forced a11y rename. Update blocks/filter-chip unit tests. Locus: frontierui.

## Resolution (2026-07-07) — frontierui PR #15

Reparented the `we-filter-chip` element onto the #2028 `fui:blocks/light-leaf/LightLeafElement.ts` base in its **(B) wrap-a-real-native-child** shape (same migration as `we-button` #2121): `resolveTag()` → `childTag()` returning `'button'`, `FilterChipElement` name unchanged (no type collision). The `decorate()` body is untouched — `selected`→`aria-pressed` + `--selected` (the one forced a11y rename, #1961 Fork 1), the `value` copy stays verbatim on the inner control via the base's non-config attribute copy-down (#1961 Fork 1 (b)-narrow), and the `count`/`variant`/structured-sub-count composition (#1873) all still land on the wrapped `<button>`. Unit tests updated to the persistent-host shape (18 filter-chip tests green); render rests on the base **(B)** coverage in `fui:blocks/__tests__/unit/light-leaf/LightLeafElement.test.ts` (`display:contents` is layout-transparent). Landed as **frontierui PR #15** (`ready-to-merge`); the WE-side status splice is this change.
