---
type: decision
workItem: story
size: 3
parent: "023"
status: open
dateOpened: '2026-06-02'
tags:
  - droplist
  - dropdown
  - di
  - native-first
  - intents
relatedReport: reports/2026-06-02-native-platform-substrate.md
relatedProject: webintents
---

# Decide native-first resolution model for droplist DI

Is native (base-select) privileged before the capability check, or just the tiebreak among already-eligible implementations? Settling on 'lightest eligible impl, native wins ties' makes native-first a tiebreak rule rather than a default — and the polyfillability tier of each required intent decides whether a gap can be layered onto native or forces a wholesale switch to the custom impl.
