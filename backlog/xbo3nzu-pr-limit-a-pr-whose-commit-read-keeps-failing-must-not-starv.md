---
kind: story
size: 2
status: open
scope: ["we:scripts/lib/pr-limit.mjs", "we:scripts/lib/__tests__/pr-limit.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "8ea8162831244061921931ff25ea3bfaafbd67c4"
tags: []
---

# pr-limit: a PR whose commit read keeps failing must not starve later PRs of authorship resolution

Follow-up from the #3215 advisory (2026-10-02, accepted by the operator). Persistently failing leading PRs consume the dispatcher's commit-read allowance every round, preventing later PRs from resolving authorship. Preserve bounded reads and conservative unresolved accounting while making progress across rounds.

## Design

Implement the original rotation option in we:scripts/lib/pr-limit.mjs. This is a scheduling repair within the existing policy: no new exemption, cap, retry duration, or authorship rule.

- Persist a per-repository last-attempted PR number alongside the existing authorship verdict cache. Use a reserved metadata field, validate it separately, and continue accepting existing flat boolean cache files. Keep metadata separate from verdict lookup and live-key pruning; retain other repositories' cursors when flushing one repository. Cache read/write failures remain fail-soft.
- For a bounded networked pass, order eligible, non-accepted PRs by numeric PR number and start after that repository's cursor, wrapping at the end. If the cursor PR has disappeared, start with the next larger number, or wrap. Iterate every eligible row so cached and git-resolvable PRs still resolve even after the API allowance is spent. Preserve the original snapshot ordering in returned `prNumbers`.
- Advance the cursor only from the existing `onApi` callback, including attempts that subsequently throw or return unusable data. Local-only passes, boolean cache hits, git successes, and budget-skipped rows must not advance it. Persist the final cursor even if no boolean verdict changed. A failed commit read stays unresolved; it must never be cached as `false` or treated as an empty commit list.
- Keep the three-attempt dispatch cap, git-first behavior, head-OID verdict invalidation, accepted-label exclusion, and unlimited direct counting behavior. PRs without a head OID participate in rotation by PR number but still receive no reusable boolean verdict. Fresh cache instances on subsequent sequential rounds must retain rotation.
- For a stable finite eligible set of N PRs with a readable/writable cache, each API-dependent PR gets an attempt within at most ceil(N / 3) bounded rounds, despite failures ahead of it. Persistent failures remain retryable on later sweeps. Concurrent cache writers retain the existing best-effort semantics; this item does not promise a transactional global scheduler.

Update the stale counting comments in we:scripts/lib/pr-limit.mjs: unknown reads are returned in `unresolved`, and the dispatch cap bounds metered commit-read invocations, not individual paginated HTTP requests. The transport in we:scripts/lib/gh-metered-reads.mjs is evidence only, with no change required.

## MVP

1. Extend the existing cache implementation in we:scripts/lib/pr-limit.mjs with validated per-repository cursor access and persistence while preserving old boolean entries and fail-soft I/O.
2. Apply rotation to finite-budget networked counting and record actual API attempts through `onApi`. Leave the local-only pass and the unlimited CLI count behavior unchanged.
3. Extend we:scripts/lib/__tests__/pr-limit.test.mjs with repeated-round failure, reload, recovery, and cache-compatibility regressions. No dispatcher or transport changes are needed.

## Test plan

Use the existing injected executor, snapshot, git seam, and temporary cache fixtures in we:scripts/lib/__tests__/pr-limit.test.mjs; no live GitHub calls or sleeps.

- Seven stable PRs: the first three API reads always fail; the trailing four return a mixture of AI and human commits. Run three rounds, recreating the cache object from the same temporary file each round. Assert at most three commit-read invocations per round, all four trailing PRs resolved by round three, and exactly three unresolved failures remaining. Record attempted PR numbers, not just total calls.
- Recover a formerly failing PR on a later sweep and assert its correct boolean verdict is cached. Cover malformed responses as well as thrown errors; neither is a negative authorship verdict.
- Assert local-only reads and spent-budget skips do not move the cursor, git success spends no API allowance, accepted PRs are not fetched, and a warm fully resolved cache spends zero API calls.
- Cover cursor wraparound, removal of the cursor PR, changed snapshot ordering, missing head OIDs, and moved heads. A moved head invalidates its verdict without breaking scheduling.
- Load legacy boolean files, reload new metadata, prune closed/moved verdict keys without deleting valid cursor metadata, and isolate two repositories' cursors. Corrupt metadata and failed writes must not throw or invent resolved authorship.
- Preserve the existing all-success convergence regression and exemption/override/counting tests. The fairness guarantee assumes successful persistence across sequential rounds; test graceful degradation separately from that guarantee.

## Proof plan

The preparation probe called the real `countOpenPrsForDispatch` from we:scripts/lib/pr-limit.mjs with injected reads, seven PRs, and failures for PRs 1–3. Three consecutive rounds each attempted `[1,2,3]`, returned `apiFetches: 3`, `count: 0`, and `unresolved: 7`. The trailing success responses were never requested. This confirms the current defect without accessing GitHub or modifying the host cache.

At implementation time, add the seven-PR regression to we:scripts/lib/__tests__/pr-limit.test.mjs first and capture its failure against the old implementation. After the fix, capture the passing run and its per-round attempt trace, including a cache reload between rounds. Run the affected Vitest file and `npm run check:standards`; preserve their exit statuses. The runner owns preparation stamping and checks; this preparation does not claim implementation proof.

## Done when

- **Executable:** the affected Vitest file, we:scripts/lib/__tests__/pr-limit.test.mjs, includes a regression named `persistent leading failures do not starve trailing PRs`; it fails before the change and passes afterward. From the WE root, run `npx vitest run` with that repository-relative file path.
- **Must:** no round exceeds three metered commit-read invocations; every resolvable trailing PR in the stable seven-PR fixture resolves within three rounds across cache reloads.
- **Must:** failed reads stay unresolved and continue contributing to the dispatcher's existing upper bound. Preserve the existing unavailable-list behavior, exemptions, and overrides; this is not a refusal-policy change.
- **Must:** scheduling and unresolved accounting apply equally to source, docs, config, and data PRs; changed-file type creates no new bypass.

## Follow-ups

No prerequisite policy decision remains. Atomic multi-writer cursor coordination and cross-repository verdict-pruning improvements are separate work if required by observed concurrent use; neither is necessary to establish sequential-round fairness here. Bounding git-fetch cost or paginated transport requests is also outside this commit-read scheduling repair.

## Progress

- **Premise and scope checked (2026-10-03):** the original premise cited we:scripts/lib/pr-limit.mjs:232 and we:scripts/lib/pr-limit.mjs:202 as the failure/cache locations and proposed cooldown or rotation. The original scope was we:scripts/lib/pr-limit.mjs plus we:scripts/lib/__tests__/pr-limit.test.mjs.
- **Corrected evidence:** we:scripts/lib/pr-limit.mjs:195–206 caches only boolean successes and traverses snapshot order; we:scripts/lib/pr-limit.mjs:218 sets the cap to three; we:scripts/lib/pr-limit.mjs:227–253 persists and prunes the cache; we:scripts/lib/pr-limit.mjs:264–268 performs the local pass then bounded fallback. The old line 232 is now cache-file parsing. we:scripts/readiness/dispatch-plan.mjs:283–285 adds unresolved PRs to the count; the counting function itself returns them separately. we:scripts/lib/gh-metered-reads.mjs:5–16 uses paginated GraphQL, so three attempts is not necessarily three HTTP requests.
- **Corrected scope:** retain the original source and matching existing test file. The defect is bounded dispatch scheduling, not all commit reads, the transport, or the dispatcher's refusal policy. The existing bounded-round tests at we:scripts/lib/__tests__/pr-limit.test.mjs:278 onward cover successful convergence but not persistent leading failures. The injected three-round probe above reproduced starvation, so this goal is not already delivered.
