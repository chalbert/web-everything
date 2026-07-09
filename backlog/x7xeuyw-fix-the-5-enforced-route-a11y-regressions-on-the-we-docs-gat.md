---
kind: story
size: 3
parent: "777"
status: open
dateOpened: "2026-07-09"
tags: []
---

# Fix the 5 enforced-route a11y regressions on the WE-docs gate

The a11y gate's enforced lane is red now: /, /adapters/, /blocks/, /intents/, /protocols/ all fail [serious] color-contrast (plus one nested-interactive on /) — all five are the SSR we-card index tiles converted in #2019 and siblings, which regressed the earned enforce posture unnoticed. Fix the tile contrast + the nested-interactive so the enforced lane goes green. NOT blocked by #867 (red under the already-ratified posture); re-measure before fixing since route lists are from 2026-07-02.
