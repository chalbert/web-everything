---
type: issue
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
tags: []
---

# Implement the @webeverything/* contract export surface + FUI sibling-alias resolution (per #804 ruling 1a+2a+3a)

Implement the #804 ruling so FUI can import WE-resident contracts. WE side: add a package.json + curated exports map to capability-manifest/ (whole plane) and validation-generation/ (provider, registry, fieldError, cel + service wire-contract types only — crossField, adapters/*, and the service handler excluded by omission so Node exports semantics enforce the #730 split), each scoped @webeverything/* with name == specifier (#239); split service.ts so only the wire-contract types remain WE-exported (handler ports to FUI under #725). FUI side: add tsconfig paths + vite alias mapping the full @webeverything/capability-manifest and @webeverything/validation-generation specifiers to ../webeverything/<dir> (mirrors plateau-app's proven sibling-alias pattern; no registry publish). Unblocks #725.

## Progress

- **Status:** resolved (2026-06-16)
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - **WE export surface (1a+3a).** Added `capability-manifest/package.json`
    (`@webeverything/capability-manifest`, `exports` `.` → `./index.ts`, whole plane) and
    `validation-generation/package.json` (`@webeverything/validation-generation`, curated subpath
    `exports`: `provider`/`registry`/`fieldError`/`cel`/`service` → their `.ts`). `crossField`,
    `adapters/*`, and the service handler are **omitted** — verified present on disk but absent from
    `exports`, so Node exports semantics make them physically unresolvable (#730 split enforced). Both
    scoped, `name == specifier` (#239), `private: true` (no publish yet — 2b deferred).
  - **service.ts split (3a downstream).** `validation-generation/service.ts` now holds **only** the
    wire-contract types (`ValidationServiceRequest`/`ServedArtifact`/`ValidationServiceResponse`); the
    handler (`handleValidationRequest`/`serveValidation` + helpers) moved to a new **non-exported**
    `serviceHandler.ts` (ports to FUI under #725, kept in WE for now so local tests + the
    `webvalidation` plug re-export keep working via relative paths). Updated the 2 importers
    (`__tests__/service.test.ts`, `plugs/webvalidation/index.ts`).
  - **FUI sibling-alias (2a).** Added tsconfig `paths` + vite `alias` (via `weRoot =
    ../webeverything`) for the scoped specifiers. Entries **mirror the WE `exports` maps exactly** —
    only the allowed contract modules are aliased; the omitted modules are deliberately unaliased so
    they stay unresolvable from FUI (the bundler-alias layer can't consult `exports`, so the omission
    is reproduced explicitly — the most faithful read of 2a+3a's combined intent).
  - **Verified.** WE vitest **3129 passed** (incl. the split suites); WE `check:standards` **0
    errors**; vite config loads with all 6 aliases pointing at the right WE files; tsc resolution probe
    confirmed allowed specifiers resolve **and** an omitted (`crossField`) import errors `TS2307`.
- **Note for #725 (the consumer):** `capability-manifest/index.ts` pulls in `guard.ts`, which
  references `process` (dev-mode guard). When FUI compiles the whole-plane import it will need
  `@types/node` (or a `process` shim/`typeof process` guard) — a #725 integration detail, not a #814
  blocker (the contract resolves fine).
- **Next:** none — unblocks #725.
