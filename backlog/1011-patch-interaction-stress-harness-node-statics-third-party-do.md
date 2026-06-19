---
type: idea
workItem: story
size: 3
parent: "1002"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/__tests__/patch-interaction.test.ts"
tags: []
---

# Patch-interaction stress harness — Node statics + third-party DOM lib under full bootstrap (#960 class)

Cross-cutting integration slice of #1002. New suite asserting global invariants survive the full plugged `we:plugs/bootstrap.ts`: `Node.*` static constants (TEXT_NODE/ELEMENT_NODE/…) intact after every patch (the exact #960 regression that broke Parchment/Quill), a third-party DOM library still instantiates under the bootstrap, and plugged↔unplugged parity where behavior must be identical. One coherent cross-plug slice (not per-plug). No equivalent test exists today (only `we:plugs/webcomponents/__tests__/unit/Node.cloneNode.patch.test.ts`). Align to the invariant list #1009 codifies. Independent of #1009/#1010.

## Progress (batch-2026-06-18)

Built the cross-plug harness — and it immediately surfaced (and fixed) a **real #960-class regression**:

- **New harness** `we:plugs/__tests__/patch-interaction.test.ts` (5 tests, green): imports the full plugged
  `we:plugs/bootstrap.ts` once, then asserts the three invariants from
  `we:docs/agent/plugs-testing-strategy.md` — every `Node.*` node-type constant intact, a stand-in
  third-party DOM library (reads `Node.TEXT_NODE` + round-trips `createElement`/`cloneNode`) instantiates,
  and plugged↔unplugged `CustomTrackerRegistry` parity.
- **Bug surfaced + fixed.** `applyNodeInjectorsPatches` (`we:plugs/webinjectors/Node.injectors.patch.ts`)
  replaced the global `window.Node` with a `PatchedNode` function but only carried the prototype chain —
  it **dropped the Node constructor's static node-type constants** (`TEXT_NODE`=3, `ELEMENT_NODE`=1, …).
  After the bootstrap `Node.TEXT_NODE` was `undefined` — the exact failure that breaks Parchment/Quill.
  Fixed by copying `OriginalNode`'s static own-property descriptors onto `PatchedNode` (skipping the
  function-internal keys). This is the #960 regression the harness exists to catch, found on first run.
- **Source-level regression guard** added to
  `we:plugs/webinjectors/__tests__/integration/Node.injectors.patch.test.ts` (asserts the statics survive
  `applyNodeInjectorsPatches` directly, not only via the bootstrap).
- webinjectors suite re-run green (194 pass), no regression from the fix.
