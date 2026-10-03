---
kind: story
size: 3
parent: "4075"
status: open
scope: ["plateau:src/return-to.ts", "plateau:src/return-to.test.ts"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "0f7d4f1b50b82c6845e8008a312e3e3caab780fc"
tags: []
---

# Prevention — A property-based test that feeds valid, non-malicious paths (including unicode and mixed-case encodings) to… (from chalbert/plateau-app#191 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `plateau:src/return-to.ts` — Add a property-based test that feeds canonical, non-malicious product paths (including percent-encoded Unicode and mixed-case percent encodings) through the return destination flow, ensuring legitimate destinations survive unchanged.

Idempotency key (do not edit): approval-prevention-key:chalbert/plateau-app#191@40b136c914961b8f23c37d84deb9cb36527271f1

## Progress

- Original premise/scope: the review debt pointed at `we:src/return-to.ts:24` and `we:src/__tests__/return-to.test.mjs`, describing normalization of valid paths. Neither file exists in WE. The implementation belongs to Plateau App; the matching existing test is `plateau:src/return-to.test.ts`.
- Evidence inspected: Plateau App checkout at `2e9ae55b4460693ff54294cadf958e065de44e7e`; latest change to the source is `40b136c` (PR #191). In `plateau:src/return-to.ts`, `isProductRoute` deliberately performs a fail-closed prefix check for the auth gate; `isCanonicalPath` checks whether URL parsing leaves the pathname unchanged; `takeReturnTo` checks the pathname alone and preserves the original query/hash. It validates rather than normalizes the returned value.
- Corrected premise/scope: protect acceptance of already-canonical product destinations, not acceptance of every harmless raw string. A local URL probe confirmed raw `/wip/café` becomes `/wip/caf%C3%A9`, whereas upper-, lower-, and mixed-case percent-encoded Unicode stays unchanged; encoded dot traversal is rewritten and must remain refused. Raw Unicode acceptance would change the existing contract and is outside this prevention task.
- `plateau:src/return-to.test.ts` already covers route prefixes, canonical ASCII paths, encoded spaces, query/hash preservation, traversal refusal, value consumption, and storage failures. It has no generated acceptance property or encoded-Unicode casing matrix. The goal is not already delivered. Scope now pairs the inspected source with its actual test; implementation work is expected only in that test.

## Design

Add a deterministic generated property to `plateau:src/return-to.test.ts`, using the existing Vitest setup and in-memory storage helper. Build inputs by construction rather than filtering them through `isCanonicalPath` or deriving expected results from the implementation.

Generate bounded product subpaths from each `PRODUCT_ROUTES` prefix, one to three safe segments, and optional trailing slash. Segment ingredients include ASCII letters/digits, hyphen/underscore, and percent-encoded Unicode scalar values (Latin accents, combining marks, non-Latin scripts, and supplementary-plane characters). Encode Unicode with `encodeURIComponent`, then vary only hexadecimal letter casing inside percent triplets: uppercase, lowercase, and alternating mixed case. Exclude raw separators, percent signs, control characters, backslashes, and dot segments from the segment alphabet. Exercise `/` and every exact product prefix separately so root does not become a generator for unknown top-level routes.

Use a small fixed-seed generator local to the test, with a fixed iteration bound and failure messages containing seed, iteration, and destination. Include mandatory Unicode/casing examples alongside generated combinations so coverage cannot depend on chance. No new dependency is needed.

For every constructed pathname, assert canonical acceptance, then remember and take the destination through injected storage. Assert byte-for-byte equality with the original destination, removal of `RETURN_KEY`, and `/` on the second take. Repeat with no suffix, query only, fragment only, and query plus fragment; suffixes include encoded Unicode and percent-triplet casing. Do not decode, recase, or strip the destination in the expected value.

## MVP

1. Extend `plateau:src/return-to.test.ts` with the bounded seeded generator and explicit coverage anchors for each Unicode category and casing mode.
2. Exercise at least 1,000 generated pathname/suffix combinations, covering every product prefix and every suffix mode, plus exact prefixes and root.
3. Keep the existing refusal and fail-closed auth-gate tests. Add explicit boundary examples for raw Unicode refusal by `takeReturnTo` and mixed-case encoded dot traversal refusal, while `isProductRoute` still recognizes their product prefix.
4. Leave `plateau:src/return-to.ts` behavior unchanged. Any unexpected counterexample must be minimized and assessed against the existing canonical-path contract before proposing a separate behavior change.

## Test plan

- Run the focused suite from the Plateau App repository: `npm test -- return-to` (test target: `plateau:src/return-to.test.ts`).
- Positive property: all constructed canonical destinations survive exactly, including Unicode encoding case, query, and fragment, and are consumed once.
- Negative boundary: raw Unicode needing URL serialization and mixed-case encoded traversal return `/`; retain existing absolute/protocol-relative URL, unknown/public path, malformed path, and storage-error cases.
- Generator checks: ensure every route prefix, Unicode category, casing mode, and suffix mode is actually exercised; report the seed and input on failure. Use fixed bounds and seed so CI failures replay exactly.

## Proof plan

- Capture the baseline focused-suite result before adding the property, then the result after adding it. This is missing regression coverage, so the unchanged production implementation should pass both; do not invent a pre-existing runtime failure.
- Demonstrate sensitivity with temporary local mutations to `plateau:src/return-to.ts`: reject percent-encoded pathnames, then separately lowercase returned percent triplets or strip query/hash. The new acceptance property must fail for each mutation and identify a concrete generated destination.
- Restore production source after each mutation and rerun the focused suite. Record commands, seed, failing counterexamples, and final passing output in the delivery evidence. Verify the final implementation diff contains only the intended test additions.

## Done when

1. The focused command in Test plan passes with bounded, reproducible generated coverage for canonical product paths, encoded Unicode, and mixed-case percent triplets.
2. The mutations in Proof plan make the new property fail, demonstrating protection against dropping or rewriting legitimate destinations.
3. Existing refusal behavior and fail-closed auth-gate behavior remain covered and unchanged; accepted destinations are consumed exactly once.

## Follow-ups

- Preserve any minimized future counterexample as an explicit regression case in `plateau:src/return-to.test.ts` alongside the generated property.
- Acceptance of raw Unicode or other noncanonical input would require a separate contract decision; this item neither introduces normalization nor broadens redirect eligibility.
