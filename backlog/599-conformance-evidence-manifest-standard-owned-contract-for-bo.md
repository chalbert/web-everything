---
type: issue
workItem: story
size: 5
status: resolved
blockedBy: ["575"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: conformance-evidence/provider.ts
tags: []
---

# Conformance-evidence manifest — standard-owned contract for bot-PR evidence (app-emits)

Mint the standard-owned conformance-evidence manifest ruled by #578 (Fork 2-A): a WE-standard contract emitted by the app's introspectable self-description / trace substrate (reusing the capabilityMatrix vocabulary), carrying which-gates-ran + the verify before/after + the autonomy level. Same app-emits / tool-consumes shape as #575's source-anchor contract; classified a self-description extension CONTRACT, not a Protocol (no swappable-vendor interop — minimize lock-in). Built as a SIBLING extension reusing #410-4A's audit-record substrate (separation bias), not a field-set on it. Runtime-agnostic → a polyglot .NET/Java fix-loop emits the same manifest (forward-adapter reach). Gated on #575's self-description substrate.

## Progress

- **Resolved 2026-06-14.** Minted the standard-owned conformance-evidence manifest (#578 Fork 2-A) as a
  new `conformance-evidence/` model dir — a self-description extension **contract** (app-emits /
  tool-consumes), the **same shape #575's source-anchor contract took**, deliberately **not a Protocol**
  (no swappable-vendor interop — minimize lock-in). Dependency-free + PURE (no `Date`; caller stamps
  `emittedAt`), so a polyglot .NET/Java fix-loop emits the same shape (forward-adapter reach).
  - **`ConformanceEvidenceManifest`** carries the three facts the audit record (#410-4A) doesn't:
    **which gates ran** (`GateRun[]`), the **verify before/after** (`VerifyEvidence` — the
    propose-and-verify edge), and the **autonomy level** (`AutonomyLevel` — the #141 ladder
    suggest/open-pr/auto-merge). `specVersion` reuses the capability-manifest semver scheme.
  - `buildConformanceEvidence` assembles + stamps the spec version; `isConformanceImproved` is the
    propose-and-verify success signal (before-failing → after-green — the verify moat); 
    `validateConformanceEvidence` is the structural check a consuming tool runs before trusting it.
  - Built as a **sibling** of #410-4A's audit-record substrate (separation bias), not a field-set on it.
    Constellation: the manifest contract → WE standard; the PR rendering + attach → Plateau dev-browser.
  - **Verified:** wired into `we:vitest.config.ts`; 9 tests pass; `tsc --noEmit --strict` clean;
    `check:standards` green.

**Graduated to** `conformance-evidence/` — ConformanceEvidenceManifest contract (we:provider.ts + we:index.ts).
