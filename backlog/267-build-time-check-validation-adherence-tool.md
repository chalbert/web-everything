---
kind: story
size: 2
parent: "005"
status: resolved
blockedBy: ["266"]
dateOpened: "2026-06-10"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: capability-manifest/check.ts
tags: []
---

# Build-time check:validation-adherence tool

A build-time check:validation-adherence command that reads each validation implementation's capability manifest (#266) and flags out-of-capability usage — a feature used that the impl doesn't declare support for — rather than letting it silently no-op. Consumes the manifest schema; independent of the runtime guard and report-format slices.

## Progress

- **Status:** resolved 2026-06-11 (batch `batch-2026-06-11`). The build-time, fail-the-build sibling of #268's runtime dev-mode guard. Blocker #266 (manifest schema) was resolved; #269 (report format) and #270 (fixtures) also landed, so this slice is pure aggregation over the existing single-sourced model.
- **Done:**
  - **`we:capability-manifest/check.ts`** — `runAdherenceCheck(inputs)` aggregates per-implementation findings into a pass/fail result; `formatCheckResult` renders the readable verdict. Two finding kinds: **`malformed-manifest`** (the declared value fails `assertCapabilityManifest` — which already enforces OP-18, so an L1+ claim missing a Core feature is caught here, no re-encoding of the Core rule) and **`out-of-capability`** (`buildAdherenceReport().outOfCapability` non-empty). No second copy of the vocabulary or the diff — it composes the #266 model + #269 report + #270 `outOfCapability`.
  - **`IMPLEMENTATION_MANIFESTS`** — the shipped-impl gate corpus, intentionally **empty today** (no impl yet exports a `manifest` per `MANIFEST_EXPORT_NAME` with a usage corpus), with a documented seam: add `{ name, manifest, usedFeatures }` when one ships and the gate bites. The #270 fixtures (some out-of-capability by design) are *test* scenarios, not the gate corpus.
  - **`we:capability-manifest/__tests__/check.test.ts`** (8 tests) — drives `runAdherenceCheck` over `CAPABILITY_FIXTURES` (in-capability → no finding; out-of-capability → finding matching `expectedOutOfCapability`) and `INVALID_MANIFEST_FIXTURES` (each → `malformed-manifest`, incl. the L1-missing-core OP-18 case), plus `formatCheckResult` and the build gate; prints the verdict via `console.log` for build visibility.
  - **`check:validation-adherence`** npm script. Toolchain note: Node 22.1 cannot execute a `.ts` CLI and there is no tsx/ts-node, so the command runs the check **via vitest** (`vitest run we:capability-manifest/__tests__/check.test.ts`) — the only TS-executing tool — rather than duplicating the TS model in a `.mjs` (which would fork the contract, against single-source). A red gate fails the build as required.
  - Barrel: re-exported `we:check.js` from `we:capability-manifest/index.ts`.
- **Gate:** `check:validation-adherence` green (8/8, prints verdict); full `capability-manifest` suite 41/41; `we:check.ts` `tsc --noEmit` clean; `check:standards` 0 errors.
