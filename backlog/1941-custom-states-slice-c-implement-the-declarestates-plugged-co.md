---
kind: story
size: 5
parent: "1831"
status: active
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
tags: []
---

# custom-states slice C: implement the declareStates plugged contract in FUI (validation + polyfill + lowering wiring)

FUI build of the ratified #1892 declareStates contract (a closed, opt-in validated custom-state vocabulary constraining native internals.states; severity config dimension, default report). Implements the plugged validation + the polyfill of the declaration/validation layer, and wires the declarative component states= lowering to emit the per-element declareStates call inline in BOTH the emitted self-contained ESM and the runtime twin. Mechanism (prototype-method wrapper vs out-of-band) is FUI's call — pick a conforming impl; candidates noted in #1892. Contract: we:src/_data/plugs/customstates.json; codifiedIn we:docs/agent/platform-decisions.md#native-first-baseline.
