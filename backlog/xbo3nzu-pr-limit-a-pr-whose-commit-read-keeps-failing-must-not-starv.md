---
kind: story
size: 2
status: open
scope: ["we:scripts/lib/pr-limit.mjs", "we:scripts/lib/__tests__/pr-limit.test.mjs"]
scopeRationale: "we:scripts/readiness/dispatch-plan.mjs is cited only as evidence of the harm and named as an explicit no-change file."
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "e1f0523e0881357fc863f3e88da72e0164eb7091"
tags: []
---

# pr-limit: a PR whose commit read keeps failing must not starve later PRs of authorship resolution

Follow-up from the #3215 advisory (2026-10-02, accepted by the operator). we:scripts/lib/pr-limit.mjs:232 and :202: a PR whose commits read fails persistently is never cached, so it burns the per-round GitHub budget every round; if the first three uncached PRs keep failing, every later PR is starved and counted toward the limit as unresolved. Fix: negative-cache a failed read with a cooldown, or rotate the order across rounds. Test: three persistently failing leading PRs and resolvable trailing ones; calls stay bounded and every trailing PR is eventually resolved.

## Progress

- Old premise: the bug lives at `we:scripts/lib/pr-limit.mjs:232` and `:202`.
- Corrected: the lines moved. `:232` is now inside `createAuthorshipCache`'s `load`. The real spots are `we:scripts/lib/pr-limit.mjs:199` (`allowApi: apiFetches < maxApiFetches, onApi: ...` in `countOpenPrsForRepo`) and `we:scripts/lib/pr-limit.mjs:201` (`if (!Array.isArray(commits)) return { pr, ai: null };` — a failed read is never cached).
- Premise still holds. `onApi` fires before the metered read (`we:scripts/lib/pr-limit.mjs:161`, `fetchPrCommits`), so a read that then throws still spends one unit of `DISPATCH_PR_COUNT_API_CAP` = 3 (`we:scripts/lib/pr-limit.mjs:218`). PRs are walked in list order every round, so three leading failures eat the whole budget each round.
- The harm is real: `we:scripts/readiness/dispatch-plan.mjs:285` adds `counted.unresolved` to the open count, so starved PRs count toward the limit forever.

## Design

Tactic choice (not a policy fork): **negative-cache with a cooldown**, not rotate order.
- Negative-caching stops the waste. Rotation still spends budget on the failing PRs every round; it only spreads it.
- Rotation needs a new persisted round offset. The authorship cache file already exists, is shared machine-wide, and is pruned to live keys (`we:scripts/lib/pr-limit.mjs:242`, `flush`), so a failure marker fits there with no new state.
- The key is `(repo, PR, head oid)`. A pushed head is a new key, so a fixed PR is re-read at once.

Changes, all in `we:scripts/lib/pr-limit.mjs`:
1. New export `AUTHORSHIP_FAILURE_COOLDOWN_MS = 15 * 60 * 1000`.
2. `countOpenPrsForRepo` gains an option `now = Date.now()` (injected clock, so tests stay deterministic). `countOpenPrsForDispatch` passes it through via `...o` already.
3. In the per-PR map:
   - Track whether this PR spent an API read: `let spent = false; onApi: () => { apiFetches++; spent = true; }`.
   - Cache hit handling: a boolean hit returns as today. A hit shaped `{ failedAt: number }` with `now - failedAt < AUTHORSHIP_FAILURE_COOLDOWN_MS` calls `fetchPrCommits` with `allowApi: false` (local git is free and may now succeed) and returns `{ pr, ai: null }` if that still fails.
   - After a failed read (`commits` not an array): only if `spent` is true, write `authorshipCache.set(key, { failedAt: now })`. A PR left unresolved because the budget ran out or because of `localOnly` is NOT negative-cached (nothing was tried).
   - Expired marker: treat as a miss and read again.
4. `createAuthorshipCache().set`: the `load()[key] !== ai` check already marks dirty for objects. No change needed. `get` already returns whatever is stored.
5. A cooled-down PR stays `ai: null`, so it still counts in `unresolved`. The count stays honest (unknown is never assumed AI or non-AI). Only the budget is freed.

## MVP

Steps 1–3 above. No change to `we:scripts/readiness/dispatch-plan.mjs`.

## Test plan

Add to the `bounded networked count (dispatch round)` describe in `we:scripts/lib/__tests__/pr-limit.test.mjs` (vitest). Extend `harness` with an optional `failing` set of PR numbers: the `api graphql` branch throws when the `number=<n>` arg names a failing PR.

1. `countOpenPrsForDispatch: persistently failing leading PRs do not starve trailing PRs` — 3 failing PRs (1–3) then 4 resolvable ones (4–7), shared tmp cache, fixed `now`. Run 4 rounds. Expect: every round spends `<= DISPATCH_PR_COUNT_API_CAP` GraphQL reads; by round 3 the result is `{ count: 4, unresolved: 3 }`; PRs 1–3 are read once each in total. Fails today (each round re-reads PRs 1–3 and `unresolved` stays 7).
2. `a failed read is retried after the cooldown expires` — 1 failing PR. Round 1 at `now = T` reads it. Round 2 at `T + 1000` makes zero GraphQL calls. Round 3 at `T + AUTHORSHIP_FAILURE_COOLDOWN_MS` reads it again.
3. `a PR left unresolved by the spent budget is not negative-cached` — 6 resolvable rows, `maxApiFetches: 2`, then a second call with `maxApiFetches: Infinity` reads the 4 others (4 GraphQL calls).
4. `a new head oid clears a failure marker` — failing PR at oid A; move head to oid B within the cooldown; the next round reads it again.

Existing tests must keep passing unchanged.

## Proof plan

Live case: the dispatcher's per-round count, replayed against the live open-PR list.
- Before: point `WE_PR_AUTHORSHIP_CACHE_FILE` at a temp file. Run `countOpenPrsForDispatch('we', { exec })` 3 times with a stub `exec` that returns the live `gh pr list` output and throws for the first three PR numbers' GraphQL read. Log `apiFetches` and `unresolved` per round. Show on main: the same three PRs are hit every round and the trailing PRs never resolve.
- After: same replay on the branch. Show the failing PRs read once, then the trailing PRs resolve across rounds, and the temp cache file holds `{ failedAt }` entries for the three.
- Also run one real `countOpenPrsForDispatch('we')` call against the real machine cache (path from `resolveAuthorshipCachePath`, `we:scripts/lib/pr-limit.mjs:221`) and confirm no error and the cache file still parses.

## Done when

1. **Executable** — `npx vitest run pr-limit.test` passes, and the new test `countOpenPrsForDispatch: persistently failing leading PRs do not starve trailing PRs` in `we:scripts/lib/__tests__/pr-limit.test.mjs` fails on main before the change.
2. A failed API read is negative-cached for `AUTHORSHIP_FAILURE_COOLDOWN_MS` per `(repo, PR, head oid)`; within the cooldown that PR spends no GitHub call.
3. A PR unresolved for any reason other than a failed API read (budget spent, `localOnly`) is not negative-cached.
4. A cooled-down PR still counts in `unresolved` (never assumed AI or non-AI).
5. All four new tests pass; all existing tests in the file pass unchanged.
6. The proof-plan before/after replay output is attached to the PR.

## Follow-ups

- None required. If failures persist for hours, a later card could surface long-lived `failedAt` markers in `pr-limit status`.
