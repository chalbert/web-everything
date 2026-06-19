---
type: idea
workItem: task
parent: "1089"
status: resolved
blockedBy: ["1107", "1108"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/webstates/__tests__/unit/webstates-protocols.unplugged.test.ts"
tags: []
---

# webstates: unplugged conformance tests for both protocols

we:plugs/webstates/__tests__/unit/webstates-protocols.unplugged.test.ts proving both registries work opt-in with no global patch, mirroring we:plugs/webstates/__tests__/unit/webstates.unplugged.test.ts. Demo: green unplugged test.

## Progress (resolved 2026-06-19)

Authored we:plugs/webstates/__tests__/unit/webstates-protocols.unplugged.test.ts (10 tests, green). Mirrors the existing store unplugged test for the two strategy protocols the completion epic added:
- **CustomChangeStrategyRegistry (#1107)** — define/resolve via a scoped instance; `observe()` runs the native-first strategy as a plain library (one ChangeRecord per change, dispose stops the stream); zero-config baseline falls back to `nativeChangeStrategy`; two scoped registries stay independent; nearest-scope active resolves up the `extends` chain (own selection wins, parent unaffected).
- **CustomStorageStrategyRegistry (#1108)** — define/resolve; the degrading CRUD surface (persist/read/listKeys/remove) over an in-memory `Storage`-backed `LocalStorageStrategy`; transparent degradation when the active engine throws; scoped independence; `extends`-chain resolution.

Non-invasive proof: no global patch — strategies just wrap/subscribe to the platform APIs they're handed. Used an injected `MemoryStorage` so the storage test is hermetic. Whole-repo gate green.
