---
kind: story
size: 5
status: open
dateOpened: "2026-06-24"
tags: []
---

# Relocate the auto-define registry + strategies out of WE per #1282 (impl→FUI)

The full auto-define impl lives WE-resident at we:blocks/renderers/auto-define/ — CustomAutoDefineRegistry + buildParsedStrategy + lazyDomStrategy + explicitAutoDefine (the #227/#241/#242 strategy axis). #1767 ported only the minimal defineElement leaf to FUI; the registry + strategies remain WE-side. #1282 (resolved) withdrew WE's reference-impl tier (WE = contract/vectors only), so this runtime belongs in FUI. Relocate the registry + strategies to FUI and the autoDefine.test (it imports explicitAutoDefine + the component kernel), KEEP in WE only the contract + conformance vectors. Prereq for deleting the shared component kernel (#1775). FUI has only the minimal defineElement today; nothing kept WE-resident imports the registry, so no #1771-style WE→FUI seam.
