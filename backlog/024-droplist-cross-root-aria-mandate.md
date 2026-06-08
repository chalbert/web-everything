---
type: decision
workItem: story
size: 3
parent: "023"
status: open
dateOpened: '2026-06-02'
tags:
  - droplist
  - accessibility
  - shadow-dom
  - aria
  - architecture
relatedReport: reports/2026-06-02-native-platform-substrate.md
---

# Does the droplist contract mandate cross-root ARIA correctness?

Cross-root ARIA / Reference Target is the only substrate API with no baseline and no clean polyfill — the gap lives in the accessibility tree. If the droplist contract requires a fully accessible combobox across a shadow boundary, that forks the architecture toward light-DOM content or native base-select rather than shadow encapsulation.
