---
kind: story
size: 3
parent: "658"
locus: frontierui
status: resolved
blockedBy: ["693"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: ../frontierui/blocks/background-task-surface (migrated; WE feature-detect type-hardened per option A)
tags: []
---

# Migrate background-task-surface UP to @frontierui/blocks

S2b of #658. Migrate the background-task-surface family UP to @frontierui/blocks (12 files: BackgroundTasksElement, index, registerBackgroundTasks, types, reloadDurabilityAdapter, the 6 traits/with* mixins, __fixtures__/mock-loader) + its tests, byte-verified against WE's copy, WITHOUT deleting WE's copy (#170 guard). Add to the S1 exports map. Independent of S2a/S2c. Leaves both trees valid.

## Progress — resolved 2026-06-15 (via option A)

FUI-only migration (commit → frontierui) **plus** a one-line WE type-harden precursor (commit → webeverything), per the ratified **option A** (type-harden the feature-detect in *both* repos' copies, kept byte-identical to each other).

- **Precursor (WE `fui:blocks/background-task-surface/reloadDurabilityAdapter.ts`)** — cast `scope.ServiceWorkerRegistration` to `(Function & { prototype?: object }) | undefined` so the `typeof reg === 'function'` guard narrows to a usable type instead of `never` under FUI's stricter TS. Pure type annotation — no runtime change (WE bg-task tests 30/30 unchanged; WE `check:standards` 0 errors).
- **Migration** — copied the whole family (12 files: `BackgroundTasksElement`, `index`, `registerBackgroundTasks`, `types`, `reloadDurabilityAdapter`, the 6 `traits/with*`, `__fixtures__/mock-loader`) + its 2 tests to `../frontierui/blocks/background-task-surface/`, **byte-identical** to the now-hardened WE copy (`diff -rq` clean). Added `./background-task-surface` (+ wildcard) to the S1 exports map. WE copy left in place (#170 guard).

Verification (in `../frontierui`): `npm run build -w @frontierui/blocks` (the S1 `tsc -p` typecheck) now **passes**; bg-task tests 30/30; full `npm run test:unit` = **1612 passed / 8 skipped** (+30 vs #694's 1582); `check:standards` 0 errors. Both trees valid; the latent type issue is gone from both.

---

## Blocker (resolved above by option A — kept for history)

Originally **released unworked** — the clean byte-copy can't satisfy the card's two
constraints at once (byte-identity **and** a green FUI build). The 12 files copy byte-identically and the
**tests pass in FUI (30/30)**, but `npm run build -w @frontierui/blocks` (the S1 `tsc -p` typecheck)
**fails** on `fui:background-task-surface/reloadDurabilityAdapter.ts:53`:

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
`fui:reloadDurabilityAdapter.ts`'s feature-detect in WE (which a real `tsc` would flag), then this migration is
a clean byte-copy.
