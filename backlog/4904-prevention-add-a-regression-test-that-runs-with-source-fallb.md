---
bornAs: xs52q1p
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/__tests__/reconcile-pass.test.mjs", "we:scripts/conveyor/__tests__/reconcile-pass-required-checks.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "58807e33cb917f1130816723c975a71129d52af5"
tags: []
---

# Prevention — Bound repeated fallback-check hydration across reconcile ticks

Filed mechanically on approval of chalbert/web-everything#3432. The original requests were a fallback-required-check regression with bounded REST reads, a cross-tick negative TTL cache for incomplete heads, and an explicit heal-or-hold invariant when hydration fails despite known failing snapshot evidence.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3432@2498e55c6b57f30b629e1477e55366138ef724d6

## Progress

- **Old premise/scope:** both prevention requests were outstanding in `we:scripts/conveyor/reconcile-pass.mjs:985` and `we:scripts/conveyor/reconcile-pass.mjs:1005`, with only `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs` named for tests. Those historical line numbers no longer locate the requested boundaries.
- **Corrected premise:** `hydrateChecks` now starts at `we:scripts/conveyor/reconcile-pass.mjs:990`. Its cache is a new Map per invocation (line 991), keyed by repository/head; it deduplicates within a pass but cannot suppress reads across ticks. The one-shot process contract at the file header means a module-global Map would not solve the production problem. `runReconcilePass` reads the required names at line 1094 and does not branch on the returned source: the regression must explicitly return `source: 'fallback'` without redefining fallback policy.
- **Already delivered portion:** commit `8b48b47dd` preserves known red/pending evidence on refused hydration. The current implementation at `we:scripts/conveyor/reconcile-pass.mjs:1034` documents that rule, and `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs:1039` covers a cancelled required check plus a throwing read, expecting `ci-heal` and a visible refusal. This is settled behavior, not an unresolved heal-or-hold policy choice. The short hydrateChecks header still needs to state the exception clearly.
- **Corrected scope:** retain the source and existing regression suite; add the existing `we:scripts/conveyor/__tests__/reconcile-pass-required-checks.test.mjs` for the fallback, multi-head, cross-tick cases. Its existing Plateau fallback test only checks a single pass and a successful hydration. The outstanding work is a persistent negative cache and its read-budget regression, not a new CI eligibility policy. `we:scripts/lib/required-status-checks.mjs` is evidence only: it already owns repository-specific fallback names and a disk-cache convention; do not change it for this story.
- **Preparation probe:** the existing suite in `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs` passed all 114 tests. The initial combined run passed 118/119 tests, with the non-hydrating Plateau fallback case timing out at 5 seconds. Rerunning `we:scripts/conveyor/__tests__/reconcile-pass-required-checks.test.mjs` with `--testTimeout=20000` passed all five tests. This establishes existing behavior coverage, not proof of the proposed cross-tick cache.
- The original filing says a post-deployment cost review was already filed, but provides no identifier. Do not treat that statement as verified delivery evidence.

## Design

Keep hydration and the implementation-local cache helpers in `we:scripts/conveyor/reconcile-pass.mjs`; leave the planner and required-check provider unchanged. Cache only a successful, validated REST response classified as incomplete (required names absent, no observed required red/pending evidence). Never persist errors, malformed responses, positive/complete results, or a negative result when the current snapshot already says red/pending.

Use a versioned disk sidecar, proposed `we:reports/.reconcile-check-hydration-cache.json`, so sequential one-shot ticks can reuse it. Add optional `hydrationCachePath` and `hydrationCacheTtlMs` inputs to `runReconcilePass`, forwarding the existing injected `now`. Default TTL: 60,000 ms, measured from the successful read, never extended on hits. An explicit null path disables persistence. With a custom `readChecks` and no explicit path, disable persistence to isolate existing injected readers; the production default reader uses the sidecar. New tests explicitly supply temporary paths. No migration is needed: absent, malformed, or unknown-version sidecars are cache misses.

Each entry contains normalized rows, the incomplete reason, and observation time. Key by canonical repository slug, exact head SHA, sorted unique required names, and a stable fingerprint of snapshot check evidence (name, run ID where present, status, conclusion, completion timestamp). Reordered equivalent evidence should not invalidate; changed evidence, head, repository, or required set must miss. Bypass the negative cache for current red/pending evidence; complete short snapshots continue to bypass REST as today. Expired or future-dated entries miss. Revalidate persisted rows before using them, and only reuse entries that still classify as incomplete under the current required set.

On a hit, retain the same visible per-PR `check-read-failed` refusal and unchecked CI outcome as the original incomplete read. Never turn a cache hit into green or erase newer snapshot evidence. Preserve the existing per-pass Map for same-head deduplication. Read once per pass, prune expired entries, cap storage at 512 entries by oldest observation, and write through a unique temporary file plus atomic rename. Cache read/write failures are best-effort misses or lost savings, never CI evidence. Concurrent writers may lose cache entries; the read bound applies to sequential ticks sharing a writable sidecar, not a distributed single-flight guarantee.

Update the hydrateChecks header to distinguish unknown evidence (withhold from heal/promotion) from known red/pending snapshot evidence (preserve existing planner behavior even when hydration refuses). This documents the already-shipped invariant.

## MVP

1. **Must 1 — Bounded reads:** for N distinct unchanged incomplete heads with fallback requirements, the first pass performs N hydration reads, further sequential passes before TTL expiry perform zero, and the first pass at expiry performs N. Multiple PRs sharing a head still need only one read per pass. The bound counts injected hydration calls, not required-policy reads or paginated HTTP requests inside one hydration call.
2. **Must 2 — Evidence safety:** negative cache reuse never promotes or heals unknown/incomplete evidence; current red/pending snapshot evidence bypasses it. A throwing hydration read preserves known required red evidence and its existing recovery outcome, with a visible refusal. Unknown evidence still refuses CI actions while unrelated planning continues.
3. **Must 3 — Real tick lifetime:** persist across separate cache-reader/process lifetimes, with exact key isolation, a non-sliding expiry, bounded storage, and safe corruption/I/O degradation. Do not cache read failures as successful negative observations.
4. **Must 4 — Input independence:** apply the same read bound and conservative evidence rules to source, documentation, configuration, and data changes; file category must not become an exemption.

Build in one source-plus-tests delivery: first add failing cache regressions, then implement the sidecar and injectables, then clarify the header and rerun the existing recovery tests. This is a local IO optimization with no new standard API or runtime demo.

## Test plan

- In `we:scripts/conveyor/__tests__/reconcile-pass-required-checks.test.mjs`, use at least three distinct valid heads and a duplicate-head PR, `source: 'fallback'`, a required name missing from both snapshot and valid REST rows, injected enrichment readers, fake numeric time, and a fresh temporary sidecar. Assert counts N, 0, 0, N at initial time, a later pre-expiry tick, TTL minus one, and exact expiry. Assert visible refusal for every affected PR and no CI heal/promotion. Repeat over the four file categories from Must 4.
- Reopen the persisted cache in a fresh module/process context using injected fixtures; prove the warm tick makes zero hydration reads. Do not rely solely on repeated calls sharing one Map. Inspect persisted observation times to prove hits do not renew the TTL.
- Exercise repository/head/required-set/snapshot changes, reordered equivalent evidence, current red and pending evidence, complete snapshots, empty REST rows, malformed sidecars/rows, unsupported versions, future timestamps, expiry, and storage pruning. A thrown REST read must retry next tick; a failed sidecar write must leave the planner's result intact and permit a later REST retry. Use temporary directories and clean them up.
- In `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs`, retain the existing cancelled-check/throwing-read recovery case and pending/truncated-green cases. Add an explicit `FAILURE` conclusion variant and run it after a negative cache has been seeded, proving the new optimization cannot suppress recovery.

## Proof plan

Run the two scoped suites with Vitest from the WE checkout (pass the paths `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs` and `we:scripts/conveyor/__tests__/reconcile-pass-required-checks.test.mjs` with the repository prefix removed for CLI invocation). Save before/after counts from the new fallback regression: before implementation each sequential tick reads N heads; after implementation only the first and expired ticks do. Temporarily bypass persistent-cache lookup during implementation verification and confirm the warm-tick assertion fails; restore it before delivery. This distinguishes a useful guard from a same-pass-only test.

Use a child-process fixture with the same temporary sidecar to prove restart persistence without credentials or network. Record explicit dispatch/refusal assertions for known red versus unknown evidence, rather than inferring safety from read counts. Run `npm run check:standards` after implementation. A production savings claim additionally needs the follow-up observation below; fixture counts alone prove only the deterministic bound.

## Done when

- **Musts 1 and 3:** the scoped fallback tests fail against the pre-cache implementation and pass with the implementation, including independent-process persistence, exact-expiry refresh, invalidation, and degraded cache IO.
- **Must 2:** the existing hydration/refusal suite and the new seeded-cache failure case pass; the hydrateChecks header states the observed red/pending exception explicitly.
- **Must 4:** all four change categories pass the same fallback read-bound and refusal assertions.
- The source and both scoped test files pass the standards gate; the review includes the read-count and dispatch/refusal evidence.

## Follow-ups

Locate the original post-deployment cost-review item before claiming it exists; if none exists, track that observation separately at implementation handoff. After deployment, compare hydration reads across repeated ticks with stable missing-name heads and record TTL refreshes, cache misses, and refusal/recovery outcomes. Tune the TTL only from that evidence. Global rate limiting, cross-host locking, changing repository fallback requirements, and caching positive CI results are outside this story.
