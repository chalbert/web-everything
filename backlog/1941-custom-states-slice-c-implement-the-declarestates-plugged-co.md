---
kind: story
size: 5
parent: "1831"
status: resolved
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
tags: []
---

# custom-states slice C: implement the declareStates plugged contract in FUI (validation + polyfill + lowering wiring)

FUI build of the ratified #1892 declareStates contract (a closed, opt-in validated custom-state vocabulary constraining native internals.states; severity config dimension, default report). Implements the plugged validation + the polyfill of the declaration/validation layer, and wires the declarative component states= lowering to emit the per-element declareStates call inline in BOTH the emitted self-contained ESM and the runtime twin. Mechanism (prototype-method wrapper vs out-of-band) is FUI's call — pick a conforming impl; candidates noted in #1892. Contract: we:src/_data/plugs/customstates.json; codifiedIn we:docs/agent/platform-decisions.md#native-first-baseline.

## Resolved 2026-06-28 (FUI build)

Built in Frontier UI (impl repo per #606/#1282; WE stays type-only — the contract `we:src/_data/plugs/customstates.json` was already minted in slice B #1892 and needs no change). The conforming implementation picked the **prototype-method wrapper** candidate (#1892, FUI-local & non-binding):

- **`fui:plugs/webcomponents/declareStates.ts`** — the plugged validation + polyfill layer. `declareStates(internals, vocab, { severity? })` records the closed vocab in a `WeakMap<CustomStateSet, Declaration>` and installs a one-time wrapper on `CustomStateSet.prototype.add` that consults it — so an undeclared toggle is constrained **regardless of call site** (Definition A). `severity` resolves per-call → process default (`setDefaultSeverity`, the `#config-extends-platform-default` rung) → platform-default flavor `report` (decline + warn); `throw` raises `UndeclaredCustomStateError`. A `CustomStateSetPolyfill` covers runtimes without native `CustomStateSet` (the declaration+validation layer only — not a `:state()` CSS engine, native per #1892). A set with no declaration stays the open native floor (opt-in at declaration).
- **`fui:blocks/renderers/component/declarativeComponent.ts`** — `generateClassSource`/`defineFromDefinition` gained an opt-in `plugged` param (default `false` = the unplugged slice-A floor, byte-identical). Plugged: the emit declares the closed vocab and wraps the element's `internals.states.add` **inline** so the wc-class stays a self-contained ESM (no plug import); the runtime twin calls `declareStates` so both forms agree.
- **`fui:plugs/webcomponents/parity.json`** — `declareStates` marked `plugged-only` with the residue justification (the missing native declaration/validation hook; the unplugged floor has no enforcement equivalent).
- Tests: `fui:plugs/webcomponents/__tests__/unit/declareStates.test.ts` (11, polyfill + wrapper + severity paths) and the plugged-lowering block in `fui:blocks/__tests__/unit/renderers/declarativeComponent.test.ts` (4). FUI `check:standards` green.

**Lineage.** Epic #1831 → slice C (slices A #1891 floor + B #1892 contract both resolved). Consumes the #1892 `declareStates` contract; mechanism is FUI's non-binding call (#1794 adoption uses the unplugged floor).
