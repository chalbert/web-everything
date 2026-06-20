---
kind: story
size: 3
parent: "1258"
status: open
dateOpened: "2026-06-20"
tags: []
---

# Adopt Form-Associated Custom Elements (ElementInternals) across WE form-participating blocks

Form-Associated Custom Elements via ElementInternals are now broadly available (Chromium, Firefox, Safari 16.4+, early 2026). WE form-participating blocks (droplist, inputs, selection controls) should use ElementInternals for native form participation and validity, dropping polyfilled or wrapper-based form-value paths per native-first (#031). Platform-adjacent finding surfaced via the framework lens of the 2026-06-20 framework-churn watch (#1258).
