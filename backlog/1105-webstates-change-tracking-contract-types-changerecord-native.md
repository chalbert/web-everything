---
type: idea
workItem: story
size: 2
parent: "1089"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/webstates/CustomChangeStrategy.ts"
tags: []
---

# webstates: Change-Tracking contract types + ChangeRecord + native default strategy

Materialize the change-tracking contract in we:plugs/webstates/CustomChangeStrategy.ts per spec we:src/_includes/project-webstates.njk:136-172 (ChangeRecord, ChangeSource, CustomChangeStrategy: key/track/diff/applyInverse) + a native store-subscription to ChangeRecord default; export from we:plugs/webstates/index.ts. Demo: unit test that a CustomStore.setItem yields a well-formed ChangeRecord.

## Progress

Shipped `we:plugs/webstates/CustomChangeStrategy.ts` — the change-tracking contract + native default
strategy (spec `we:src/_includes/project-webstates.njk`): `ChangeRecord` (path/op/oldValue/newValue/
source/timestamp/version — self-invertible via oldValue), `ChangeSource` (channel + traceparent),
`CustomChangeStrategy` (key/track→Disposable/diff?/applyInverse?), and `NativeChangeStrategy`
(`native-signals`) — subscribes to a CustomStore and emits a ChangeRecord per changed top-level key,
diffing each notification against the prior snapshot (zero-config native-first; Immer/Yjs/CRDT plug in
behind the same contract). diff + reversible applyInverse implemented. Exported from
`we:plugs/webstates/index.ts`. Unit test `we:plugs/webstates/__tests__/unit/CustomChangeStrategy.test.ts` (5 green):
a CustomStore.setItem yields a well-formed replace ChangeRecord, add/remove diffs, dispose stops the
stream, applyInverse restores.
