---
type: issue
workItem: story
size: 3
parent: "658"
status: open
blockedBy: ["693"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
tags: []
---

# Migrate background-task-surface UP to @frontierui/blocks

S2b of #658. Migrate the background-task-surface family UP to @frontierui/blocks (12 files: BackgroundTasksElement, index, registerBackgroundTasks, types, reloadDurabilityAdapter, the 6 traits/with* mixins, __fixtures__/mock-loader) + its tests, byte-verified against WE's copy, WITHOUT deleting WE's copy (#170 guard). Add to the S1 exports map. Independent of S2a/S2c. Leaves both trees valid.

## Blocker surfaced (2026-06-15, batch — attempted, released unworked)

Attempted in a batch and **released, not resolved** — the clean byte-copy can't satisfy the card's two
constraints at once (byte-identity **and** a green FUI build). The 12 files copy byte-identically and the
**tests pass in FUI (30/30)**, but `npm run build -w @frontierui/blocks` (the S1 `tsc -p` typecheck)
**fails** on `background-task-surface/reloadDurabilityAdapter.ts:53`:

```
error TS2339: Property 'prototype' does not exist on type 'never'.
```

**Root cause — a cross-repo TS-narrowing discrepancy, not a copy error.** `isBackgroundFetchAvailable()`
casts `scope.ServiceWorkerRegistration` (typed `unknown`) to `{ prototype?: object } | undefined`, then
guards with `typeof reg === 'function'`. A newer/stricter TS (FUI's `@frontierui/blocks` build) narrows
that non-function union to `never` and flags `reg.prototype`; WE's toolchain does **not** narrow it that
way, and — critically — **WE never tsc-typechecks `blocks/` through any gate** (`check:standards` skips
the build; the `build:plugs` tsc is the known tree-polluting footgun), so the latent issue rides along
invisible in WE and only surfaces when FUI's stricter standalone build compiles the family.

**Why it's not resolvable as a pure byte-copy:** the card forbids editing the migrated file, so the fix is
either (a) a **coordinated edit in BOTH repos' copies** (make the Background-Fetch feature-detect
type-safe — e.g. cast through a function/constructor type — keeping the two copies byte-identical *to each
other*; touches WE's shipping file, so it's its own change), or (b) a **FUI blocks-build concession**
(relax the workspace typecheck for this family). Either is out of scope for "migrate the family"; **decide
the approach before re-attempting.** S2a (#694, the 6 single-file families) landed clean — this S2b family
is the one with the latent type issue. Recommend a small precursor task: type-harden
`reloadDurabilityAdapter.ts`'s feature-detect in WE (which a real `tsc` would flag), then this migration is
a clean byte-copy.
