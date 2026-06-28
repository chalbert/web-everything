---
kind: decision
parent: "1831"
status: open
blockedBy: ["1891"]
dateOpened: "2026-06-27"
tags: []
---

# custom-states slice B: plugged validation + polyfill + declareStates plug-hook (FUI)

Slice B of #1831 (blockedBy slice A #1891). The plugged form: a validating CustomStateSet wrapper rejecting/warning un-declared internals.states toggles, the polyfill of the nowhere-native declaration+validation layer, and the declareStates(internals, vocab) plug-hook resolved from plug context — mirroring the fui:plugs/validationUnplugged.ts + bootstrap-block + injector-registry pattern. NEEDS /prepare before batching: the wrapper-vs-proxy architecture + reject/warn semantics are design, not just volume; if prep surfaces a real binary fork, file it as a type:decision card and blockedBy it. Contract: we:src/_data/plugs/customstates.json; ruling #1807.
