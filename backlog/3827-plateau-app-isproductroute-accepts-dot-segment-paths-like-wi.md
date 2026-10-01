---
bornAs: x8i1gsp
kind: story
size: 1
tier: pinned
status: open
scope: ["plateau:src/return-to.ts", "plateau:src/return-to.test.ts"]
dateOpened: "2026-09-21"
preparedDate: "2026-10-01"
preparedAgainstSha: "1252cb3ff1cbec896c6b8c147fe5f95b0701d531"
tags: []
deliveryAgent: codex
deliveryAgentReason: "astra graduation trial (epic #3383/#4034/#3906): non-critical per the #4034/#2752 critical-work rule — a tiny (size 1) plateau:src/return-to.ts bugfix with a fully specified Done-when, no daemon/conveyor/gate/statute path; scope narrowed to the two files the card's own Done-when actually touches now that PR #158 (which created plateau:src/return-to.ts) is merged, dropping the abandoned-PR fallback path (plateau:src/main.ts); operator-directed, 2026-09-26"
---

# plateau-app isProductRoute accepts dot-segment paths like /wip/../x, so the sign-in return target can leave the product routes

The SPA must consume only canonical same-origin product return targets, otherwise fall back to `/`. The current helper accepts `/wip/../x` and returns it unchanged, although URL parsing resolves that pathname to `/x`. This violates its documented guarantee (we:../plateau-app/src/return-to.ts:8-10, :22-24, :36-43). References beginning `we:../plateau-app/` below denote the Plateau sibling repository; the existing machine-readable scope retains its Plateau locus.

## Progress

Preparation checked Plateau HEAD `105ad0050967c7ba48f284fa4fce13a2d5ecdc57` on 2026-10-01, plus the WE lane's preparation brief from `main` (we:skills-src/conveyor/prepare-item-worker-brief.md:5-18).

- **Old premise / scope:** implementation still cited the pre-extraction main module and retained an abandoned-PR #158 fallback. **Correction:** the helper and its test already exist; retain exactly the two existing Plateau scope entries, including the test. No main-module fallback is needed (we:../plateau-app/src/return-to.ts:22-43; we:../plateau-app/src/return-to.test.ts:1-26; we:../plateau-app/src/main.ts:63).
- **Observed defect:** a read-only Node probe transpiled and imported the actual helper, then called both exports using in-memory storage. `/wip/../x`, `/wip/./a`, and `/wip/%2e%2e/x` were accepted and returned unchanged; their URL pathnames were `/x`, `/wip/a`, and `/x`. The stored key was consumed in each case. These are observations of the prefix-only predicate and consume-before-validation flow (we:../plateau-app/src/return-to.ts:22-24, :36-43), not a claim that the future fix has passed.
- **Factual drift:** the original canonicalization claim said it catches “a double slash.” An internal `/wip//x` survives URL parsing unchanged and is currently accepted; keep that behavior. Leading `//wip` is already refused by the return-target guard. Also, `/wip\..\x` and `/wip x` are already rejected by the prefix match, so those original examples alone cannot demonstrate the new clause works (we:../plateau-app/src/return-to.ts:23, :41; same Node probe). Add slash-prefixed descendants with backslashes/spaces to make those regressions meaningful.
- **Exposure correction:** do not assert storage tampering is the only possible entry. Initial startup passes `location.pathname`, but the helper itself concatenates caller arguments without validation and the auth shell accepts a `path` argument (we:../plateau-app/src/main.ts:289-297, :1113; we:../plateau-app/src/return-to.ts:32-34). A seeded session value is a reproducible input; this preparation does not establish an external exploit or its severity.
- **Delivery shape:** this is Plateau-only implementation and tests; WE holds the tracking card, with no WE contract/runtime change required. The one-backlog rule is we:docs/agent/platform-decisions.md:5521-5526 (`#conveyor-multi-repo-model`). Under the requested #4289 ruling, no per-repo implementation split is needed; bookkeeping is distinct from mixed implementation scope (we:backlog/4289-design-multi-repo-couple-locus-delivery-e-g-we-plateau-app-2.md:18-20, :51-53).

## Design

At the start of `isProductRoute`, reject a path when `new URL(path, 'https://x').pathname !== path`, then retain the existing root/product-prefix predicate. Return `false` if parsing throws, keeping the boolean predicate total for malformed string inputs. The fixed base is only a parsing base, not a network request. This implements the card's existing canonical-path goal in the existing predicate (we:../plateau-app/src/return-to.ts:22-24).

Reject noncanonical input rather than normalizing and admitting it. Preserve `/`, every configured product root and descendant, trailing slashes, and canonical internal double slashes. Keep the leading-slash and protocol-relative guards in `takeReturnTo`, its pathname-before-`?` check, its unchanged accepted query string, consume-once behavior, and storage-error fallback (we:../plateau-app/src/return-to.ts:14-20, :36-43; we:../plateau-app/src/return-to.test.ts:16-25, :29-34, :46-76).

Document canonical input in the helper's own guarantee comment (we:../plateau-app/src/return-to.ts:8-10). No export/signature, route-list, auth-shell, or deployment-gate redesign is required. The separate gate decision's default keeps that check local and permits public same-origin targets; this card does not settle or implement it (we:backlog/3826-decision-how-a-wip-deep-link-survives-the-plateau-app-deploy.md:90-101).

## MVP

1. Extend the existing predicate tests and in-memory storage tests in we:../plateau-app/src/return-to.test.ts:4-26, :28-78 with the cases below; first demonstrate the new defect cases fail against the current helper.
2. Add the canonical-form rejection and its comment in we:../plateau-app/src/return-to.ts:8-10, :22-24. Leave the return consumer's existing guards in place (same file, :36-43).
3. Deliver only the helper and its existing test file. The current `scope` already includes both, so no wider scope or WE predecessor is proposed.

## Test plan

Extend we:../plateau-app/src/return-to.test.ts:15-26 with a table asserting `false` for `/wip/../x`, `/wip/./a`, `/wip/%2e%2e/x`, `/wip\..\x`, `/wip x`, plus `/wip/..\x` and `/wip/a b` (currently admitted descendants). Include malformed `//[` to verify parsing failure yields `false`, not an exception. Retain the existing public/unknown/prefix-lookalike coverage.

Assert `true` for `/`, `/wip`, `/wip/`, `/backlog/3383`, `/wip//x`, and canonical encoded `/wip/a%20b`; keep the existing loop over every product root and descendant (we:../plateau-app/src/return-to.test.ts:16-18).

Extend the consumer tests using the existing storage helpers (we:../plateau-app/src/return-to.test.ts:4-13): stored `/wip/../x` and `/wip/../x?epic=3383` must yield `/`, remove `RETURN_KEY`, and yield `/` on a second read. Keep valid `/wip?epic=3383` byte-for-byte and consumed once, alongside all existing absolute/protocol-relative/public-path and storage-exception tests (same file, :29-76).

Run `npx vitest run return-to` from a Plateau implementation lane. Mutation proof: temporarily remove only the new canonical rejection, rerun the targeted suite, and require failure on the dot-segment regression; restore the clause and require green. No implementation or mutation is performed during this card-only preparation.

## Proof plan

- Capture the Plateau revision and red/green targeted-suite outputs. The existing traversal tests cover only inputs starting outside product space (we:../plateau-app/src/return-to.test.ts:23-25, :41-44); new assertions must exercise traversal starting inside it.
- Record direct calls showing `/wip/../x` is rejected and its stored form produces `/` with the key removed. Also record `new URL('/wip/../x', 'https://x').pathname` as `/x` to demonstrate why the old accepted string breaks the product-path guarantee. This is helper/URL proof, not an unperformed browser navigation claim.
- Save the failing mutation output and restored green run, then run the Plateau repository's required delivery gate. WE preparation verification does not substitute for Plateau implementation verification (we:docs/agent/platform-decisions.md:5525-5526).
- For this preparation, run the `prepare-stamp 3827` command and lane verification in WE (we:scripts/backlog.mjs:584-600; we:scripts/verify-lane.mjs:28-30). Review that the diff changes only this card; do not mark the defect fixed on the strength of a preparation gate.

## Follow-ups

- Keep the deployment gate deep-link work on #3826; its local same-origin policy is a separate concern (we:backlog/3826-decision-how-a-wip-deep-link-survives-the-plateau-app-deploy.md:90-101).
- Testing lesson for implementation review: retain a regression starting with an allowed product prefix; `/../x` alone cannot expose this defect (we:../plateau-app/src/return-to.test.ts:23-25, :41-44). Canonicalization is not a blanket double-slash prohibition.
- If implementation discovers a necessary WE contract change, re-prepare the actual combined scope and propose independently useful WE/Plateau deliveries before dispatch, following the #4289 ruling; do not invent an empty WE story for this card (we:backlog/4289-design-multi-repo-couple-locus-delivery-e-g-we-plateau-app-2.md:18-20, :51-53).
