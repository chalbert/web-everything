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

# FUI: button to persistent wrapper (host wraps the real native button/a)

Migrate fui:blocks/button/ButtonTransientElement.ts off transient self-erasure: the we-button host persists (per the #2028 persistent base contract landed with #1974's badge pilot) containing the real native <button>/<a> — variant class, icon/label composition, and toggle aria move onto the inner control (#1962 single-native-control family, the sl-input shape). Update blocks/button unit tests. Locus: frontierui.

## Resolution (2026-07-07) — frontierui PR #14

Reparented the `we-button` element onto the #2028 `fui:blocks/light-leaf/LightLeafElement.ts` base in its **(B) wrap-a-real-native-child** shape (the base already does the persistent-wrapper mechanics: `display:contents` host + non-config attribute copy-down onto the inner control + child-move). `resolveTag()` became `childTag()`; the `decorate()` body (variant class, `type=button` default, icon/label composition, toggle `aria-pressed`/`aria-controls`/`aria-expanded`) is unchanged and still maps onto the inner native control. Renamed `ButtonTransientElement` → `ButtonHostElement` (no external consumers; `ButtonElement` is the existing `HTMLButtonElement | HTMLAnchorElement` union type, so the host class takes the `…HostElement` name). `fui:blocks/button/registerButton.ts` + `fui:blocks/button/index.ts` re-point to the new class; the unit test is rewritten to the persistent-host shape (13 button tests green). Render rests on the base **(B)** coverage in `fui:blocks/__tests__/unit/light-leaf/LightLeafElement.test.ts` (`display:contents` is layout-transparent, so the visual output is identical to the prior self-erased control). Landed as **frontierui PR #14** (`ready-to-merge`); the WE-side status splice is this change.
