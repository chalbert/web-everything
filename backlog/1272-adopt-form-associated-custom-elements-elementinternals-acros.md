---
kind: story
size: 3
parent: "1258"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: src/_data/capabilities/face.json
tags: []
---

# Adopt Form-Associated Custom Elements (ElementInternals) across WE form-participating blocks

Form-Associated Custom Elements via ElementInternals are now broadly available (Chromium, Firefox, Safari 16.4+, early 2026). WE form-participating blocks (droplist, inputs, selection controls) should use ElementInternals for native form participation and validity, dropping polyfilled or wrapper-based form-value paths per native-first (#031). Platform-adjacent finding surfaced via the framework lens of the 2026-06-20 framework-churn watch (#1258).

## Progress

Resolved 2026-06-20. **Baseline confirmed:** Form-Associated Custom Elements (FACE / `ElementInternals`)
is broadly available — all engines since Safari 16.4 (2023); the WE capability SoT
(we:src/_data/capabilities/face.json) already carries `baseline: "2023"`, `polyfill: "polyfillable"`
(native default + fallback).

**WE-side registration (done):** recorded FACE as the native-first **form-participation resolver** for WE
form-participating blocks (droplist, inputs, selection controls) in the `face` capability summary — blocks
own value + validity through `ElementInternals`, demoting any polyfilled or wrapper-based form-value path to
opt-in (native-first #031). This is consistent with the dropdown/droplist defs which already describe a
"form-associated, single string surface."

**FUI-side (separate locus):** the actual per-block adoption — wiring `static formAssociated` +
`ElementInternals` into each form block's impl and dropping wrapper form-value shims — is FUI block-impl
work (`@frontierui/blocks`), downstream of this WE-side capability registration; the WE contract just
affirms FACE as the native-first default. Gate green.
