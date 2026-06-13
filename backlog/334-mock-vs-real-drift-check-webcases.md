---
type: idea
workItem: story
size: 5
status: resolved
blockedBy: ["331", "332"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
tags: [mock, proxy, contract, drift, webcases, verification]
---

# Mock-vs-real drift check in webcases

Add a mock-vs-real drift check in `webcases`: verify the same interaction-bearing mock/contract artifact (#331) against the live service so a mock that has drifted from reality is caught. Reuses the dev-server provider (#332) to record/replay real responses. Ratified in #107 (Fork 3): one contract, two uses — the artifact that mocks an endpoint is the same one verified against the real service, with `webcases` as the verification home, because schema-validation is not contract-verification. Blocked on both the schema (#331, the artifact) and the dev-server provider (#332, the real-traffic source).

## Progress (2026-06-13) — resolved

Both blockers resolved (#331 → `protocol:mock-contract` owned by the `webcases` project; #332 → `frontierui/tools/mock-server`). New [webcases/driftCheck.ts](../webcases/driftCheck.ts) — `webcases`' first code home, wired into the vitest include ([vitest.config.ts](../vitest.config.ts)):

- **`detectDrift(expected, actual) → DriftReport`** compares the contract's **declared** response (what the mock returns) against the **recorded real** response, reporting every divergence with a JSON-Pointer: `status`, body **shape** (`missing-field` / `extra-field` / `type-mismatch`, walking nested objects + arrays against the contract's first exemplar element), and `content-type` (charset params ignored).
- **Structural, not value-level** — a real API legitimately returns different *values*; what must not silently change is the *shape*. That distinction is exactly "schema-validation ≠ contract-verification" the #107 Fork-3 ruling names. **One contract, two uses**: the same artifact that mocks an endpoint is the one verified here.
- **Locus = webeverything** (the `mock-contract` protocol is owned by the WE `webcases` project). The recorded real response comes from #332's `record` mode in **Frontier UI** — the transport is **injected** (passed in), never imported, so `@webeverything` keeps its no-FU-dependency rule. (Contrast #333, the console UI *over* that FU server, which I reclassified `locus: frontierui`.)

8 unit tests (no-drift on value changes; status / missing / extra / type / nested / content-type drift; no false content-type flag when the contract declares none); typecheck clean; gate green.
