---
kind: story
size: 2
parent: "2015"
status: open
locus: frontierui
blockedBy: ["1974"]
dateOpened: "2026-07-02"
tags: []
---

# FUI: button to persistent wrapper (host wraps the real native button/a)

Migrate fui:blocks/button/ButtonTransientElement.ts off transient self-erasure: the we-button host persists (per the #2028 persistent base contract landed with #1974's badge pilot) containing the real native <button>/<a> — variant class, icon/label composition, and toggle aria move onto the inner control (#1962 single-native-control family, the sl-input shape). Update blocks/button unit tests. Locus: frontierui.
