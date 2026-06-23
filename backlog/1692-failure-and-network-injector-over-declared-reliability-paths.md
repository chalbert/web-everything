---
kind: story
size: 5
parent: "142"
status: resolved
locus: plateau-app
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: "plateau:src/dev-browser/fault-injector/"
tags: []
---

# Failure and network injector over declared reliability paths (dev browser)

Build the dev-browser fault injector (#1644, ratified go; webreliability registry shipped #1051/#1052/#1032): enumerate the app's declared reliability paths from the webreliability recovery-handler registry, inject the matching failure (timeout/5xx/offline/partial) live, and assert the declared recovery path actually fired. Home plateau:dev-browser.

## Progress (resolved 2026-06-23, batch-2026-06-23-1689-1500)

Built as `plateau:src/dev-browser/fault-injector/`:

- **`plateau:src/dev-browser/fault-injector/types.ts`** — `FailureKind` (`timeout`/`5xx`/`offline`/`partial`,
  the #1644 injection vocabulary); `RecoveryOutcome` (the closed webreliability set `retry|queued|fallback|
  abort`, mirrored from `we:reliability/contract.ts` so the module needs no new cross-package alias);
  `ReliabilityPath` (a declared protected operation: `operationKey` + the `failureKinds` it handles + the
  `expectedOutcome`); `FaultInjector` (the single app seam — `inject(path, kind)` → observed recovery +
  optional `reset`); and the `InjectionResult`/`PathInjectionReport` shapes.
- **`plateau:src/dev-browser/fault-injector/inject.ts`** — `enumerateInjections` (each path × its declared
  failure kinds), `injectFault` (inject one fault + **assert** observed outcome === declared `expectedOutcome`,
  capturing an injector throw as `ok:false` — never throws), `runPathInjection`/`runFaultInjection` over the
  whole declared set.
- **`plateau:src/dev-browser/fault-injector/fault-injector.test.ts`** — 6 tests (enumeration, conformant
  pass, a non-conformant outcome fails the path, `null` no-recovery → fail, injector-throw capture,
  reset-between-faults).

The declared paths come from the app's webreliability recovery-handler registry (#1051/#1052/#1032); the
injector enumerates them and proves the declared recovery actually fires under each injected failure. The
`inject`/observe seam is the app's. Home plateau dev-browser. Plateau suite green (only the pre-existing
external `render-conformance` baseline red, not this module).
