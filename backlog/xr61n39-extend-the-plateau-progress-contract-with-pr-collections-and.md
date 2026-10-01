---
kind: story
size: 3
parent: "4623"
status: open
scope: ["we:contracts/plateau-progress-view.schema.json", "we:contracts/plateau-progress-view.examples.json", "we:contracts/plateau-progress-view.test.ts"]
dateOpened: "2026-10-01"
tags: []
---

# Extend the Plateau progress contract with PR collections and waiting chains

Validate author-independent PR collections, evidence-backed waiting chains and snapshot-bound cached pages as a WE-only contract increment. Preserve schema-1 and existing schema-2 examples so Plateau consumers can roll out after the contract.

## Design

Extend the existing schema-2 artifacts after #x9jwbpi; the split investigation found them present, so this is an increment rather than initial schema creation. Placement is governed by we:docs/agent/platform-decisions.md#constellation-placement and we:docs/agent/platform-decisions.md#surface-contract-not-computation, applying #4289's per-repo ruling. Only declarative contracts/examples/conformance belong in this WE slice; Plateau owns computation.

Each PR carries full repo slug/number, URL, full description, nullable author, draft, head SHA, head-bound CI/review evidence, all wait reasons, one primary wait, handler, wait-since and source references. Its waiting chain carries current owner/reason; queue position plus blockers (PR or build/card ref, shared repo-qualified file, observation time); holder kind/identity/claimedAt/liveness; ordered conditional next steps; nullable ETA with sample count/window/method and uncertainty. Unknown data has a reason, not an invented value. A collection records known total, included count and completeness; unknown universe total is null, distinct from known cached membership.

Define page request/response and restart examples bound to snapshot identity, opaque cursor, totals, coverage and next cursor. Preserve the schema-1 fallback and existing schema-2 envelopes with absent new collections. Make staged rollout possible: absent collection is unavailable, never empty; waiting-chain fields can carry explicit unknown evidence until enrichment lands. Head-bound evidence and safe, repo-qualified source references are part of the observable shape.

## Observed seam and scope

The validator in we:contracts/plateau-progress-view.test.ts:1 already compiles the schema with Ajv and validates named snapshots; its existing arithmetic description delegates cross-field checks to consumers. Extend the declarative fixture assertions for included <= known total and source-key consistency without moving the product classifier/ETA algorithm into WE. The schema's existing coverage collections are in we:contracts/plateau-progress-view.schema.json; new PR/page definitions are additions, not existing symbols. The examples file is the shared fixture boundary for successor tests.

Budget: **3 implementation paths, 1 area** (we:contracts/), plus at most this card's close-out path/area. Exact touch set is frontmatter scope.

## Test plan / Done when

- **Capability — Red today expected (not executed during this backlog split):** Run `npx vitest run we:contracts/plateau-progress-view.test.ts` (remove the repo qualifier when executing). Validate complete/partial coverage, unknown totals, cross-repo duplicate numbers, PR/build overlap blockers, expired holder, known/unknown ETA and snapshot/cursor/restart examples.
- **Capability — Red today expected (not executed during this backlog split):** Reject negative durations/counts, malformed refs, absent source freshness, included greater than known total, missing source joins and unknown major versions; preserve legacy schema compatibility. If an invariant needs fixture-level assertions rather than JSON Schema, make that boundary explicit and test it.
- **Capability — Red today expected (not executed during this backlog split):** Add hostile evidence vectors for absolute host paths, home directories and transcript snippets: published examples must redact or reject them. Add valid sanitized repo-qualified file evidence.
- **Capability — Red today expected (not executed during this backlog split):** Prove standalone schema/examples validation with no Plateau process or producer IO. Existing examples stay green, and the increment is usable before any consumer rollout.

## Delivery boundary

This is one story under #4623; its prepared Design, MVP and Proof plan remain the umbrella acceptance. No implementation was performed while splitting. Reconcile predecessor interfaces before build and capture expected failing capabilities before changing code. All tests use sanitized fixtures, injected clock/IO and network/process spies, never live claims. A missing source means unknown with a reason. No new GitHub polling, approval, dispatch or merge behavior is authorized.

Build only the listed scope. Re-probe the touch set if upstream interfaces move; split again before exceeding 20 paths or 4 areas. Run the affected suites and the owning repository gate, recording commands, source identities and limitations on this card. Keep testing lessons in Follow-ups rather than shared agent docs.
