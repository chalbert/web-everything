---
kind: task
status: resolved
blockedBy: ["767"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
tags: []
---

# Build: GPU-tier capacity adapter over detect-gpu (the one delegated dependency)

Implements the GPU-tier signal for the #729 CapacityProvider by delegating to detect-gpu (pmndrs) — the single device axis the #729 survey found warranting a dependency (CPU/RAM/network are native reads; battery excluded as broken). Registers as a capacity resolver impl (impl-is-not-a-standard) answering the GPU dimension with its raw fps-derived tier (0-3) and the coarse bucket per Fork 2. Carries the dependency-addition risk in isolation so it can be prioritized separately from the native-reads contract. Blocked by #767 (implements a dimension of the CapacityProvider contract).

## Progress (2026-06-16, batch-2026-06-16) — built

- **Dep:** added `detect-gpu` (pmndrs) — the one #729-sanctioned device dependency (CPU/RAM/network are native reads). Lazily `import()`ed so it never loads in SSR/build venues.
- **Source/adapter:** [we:capabilities/capacity-gpu.ts](../capabilities/capacity-gpu.ts) — `GPU_CAPACITY_ADAPTER` (id `gpu`, dimensions `['gpuTier']`, non-native), `createGpuCapacitySource(probe?)` and `createGpuCapacityProvider(probe?)`. Registers as a **capacity resolver impl** (impl-is-not-a-standard) answering only `gpuTier` of the #767 contract.
- **Async-over-sync:** `getGPUTier()` is async but `CapacitySource` is sync — the probe runs once at construction and caches its tier; the source returns the cached scalar or `undefined` until ready / on failure (the `undefined`-degrade contract). `probe` is injectable so tests never run real WebGL; consumers `await provider … ready`.
- **Bucketing reconciled (#729 Fork 2):** the source emits the **raw tier 0–3** as scalar; `deriveBucket('gpuTier', …)` in we:capacity.ts now maps it centrally (3→high, 2→mid, 1/0→low), replacing the placeholder bucket-string branch (kept as back-compat). Scalar = tier, bucket = derived — consistent with every other dimension.
- **Tests:** [we:capabilities/__tests__/capacity-gpu.test.ts](../capabilities/__tests__/capacity-gpu.test.ts) — 7 cases (tier→bucket map, undefined-before-ready, gpuTier-only, probe-failure-stays-unknown, provider/adapter shape). Existing capacity suite still 15/15.
- **Verified:** vitest 7/7 (+15/15), `check:standards` green, capabilities/ typechecks clean.
- Composing the GPU source with native (route per dimension) is the sibling #768 CompositeProvider, not this item.
