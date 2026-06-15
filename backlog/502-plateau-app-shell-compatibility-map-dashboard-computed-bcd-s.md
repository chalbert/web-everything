---
type: issue
workItem: story
size: 5
parent: "099"
status: resolved
blockedBy: ["501", "092"]
dateOpened: "2026-06-13"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: plateau-app/src/compatibility-map/
tags: []
---

# Plateau app-shell compatibility-map dashboard — computed BCD-style matrix over the #092 graph

Build the live compatibility map ruled by #104 (Fork 1's product leg): a Plateau dashboard that COMPUTES a browser-compat-data-style support matrix from the declared app-shell-compatibility manifests (#501) and renders it as a view over the #092 provider/consumer graph. Carries three states (supported / flagged-degraded / unsupported) and an asymmetric skew window (shell-newer = forward-compat; shell-older = fail) per Kubernetes version-skew; singleton providers force a range intersection across active apps (OSGi uses), isolatables resolve per-app via import-map scopes. Surfaces apps pinned to deprecated providers (BCD status/Baseline) and the apps worth converting. Zero project-facing lock — devtooling view only. Blocked by #501 (the declared protocol) and #092 (the graph it renders on).

## Progress — resolved 2026-06-13

Built in **plateau-app** (`src/compatibility-map/`), locus plateau-app:

- **`semver.ts`** — minimal caret semver (plateau-app has no semver dep): `parse` / `cmp` / `satisfies`
  (npm caret incl. the 0.x window) / `intersectCaret` (the singleton constraint, null when majors differ).
- **`types.ts`** — mirrors the #501 `AppShellCompatibilityManifest` (the declared lock) + the computed
  matrix shapes (`MatrixCell`, `AppSkew`, `CompatibilityMatrix`).
- **`compute.ts`** — the pure engine: three-state cells (supported / flagged-degraded / unsupported),
  **asymmetric shell skew** (newer shell = forward-compat flag, older = hard fail), **singleton**
  range-intersection across active apps (empty ⇒ conflict taints every participant), **isolatable**
  per-app resolution, optional-provider graceful degrade, deprecated-pin (BCD/Baseline) flagging, and
  the conversion-candidate rollup.
- **`seed.ts`** — 4 active manifests + a provider catalog shaped to exhibit every state (clean
  singletons, a real `state-lib` major conflict, deprecated `legacy-grid` pins, an unshipped mandatory
  `telemetry`, an optional satisfied `chart-lib`, and a shell-older skew fail on `patient-intake`).
- **`dashboard.ts` / `dashboard.css`** — `mountCompatibilityMap()`: the apps × providers matrix
  (three-state cells + a shell-skew column) + rollups (deprecated pins, singleton conflicts, worth
  converting). Wired into `main.ts` (import + route + breadcrumb + `tryMountCompatibilityMap` + initial
  mount) and `index.html` (nav link + `/compatibility-map` route template).
- **`compute.test.ts`** — vitest over every state + the asymmetric skew + caret intersection.

**Verification:** the plateau-app `npm test` gate (`vitest run`) is **not runnable in this environment —
vitest is not installed** (pre-existing: the repo ships test files but no vitest dependency; absent before
this work). Correctness was instead verified by (a) **`tsc --noEmit`** — all new source files type-clean
(the only tsc errors are pre-existing: the absent-vitest import on every `*.test.ts`, and a prior
`main.ts` user-display union error that predates this change), and (b) an **esbuild-bundled run** of the
compute engine asserting every matrix state, the singleton conflict, deprecated pins, asymmetric skew,
and the conversion-candidate set. Installing `vitest` in plateau-app (so its declared gate runs) is a
separate, repo-level dependency decision — left for the repo owner, not bundled into this build.

**Graduated to** `plateau-app/src/compatibility-map/` — caret semver + computeCompatibilityMatrix (3-state, asymmetric skew, singleton intersection, deprecated pins) + mountCompatibilityMap dashboard wired into main.ts/index.html.
