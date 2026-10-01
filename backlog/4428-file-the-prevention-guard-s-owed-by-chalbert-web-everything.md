---
bornAs: xkq7e0a
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/gh-spend.mjs", "we:scripts/lib/__tests__/gh-throttle.test.mjs", "we:scripts/lib/__tests__/gh-spend.test.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-30"
dateResolved: "2026-10-01"
preparedDate: "2026-09-30"
preparedAgainstSha: "59f603470d049093b7c0fcae1a2f00bda7cd41ba"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2851's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/gh-throttle.mjs:560` — On an unclosed block, drop everything from `* Request at` up to the first line that is not part of the trace. Alternatively, strip nothing and fail closed by suppressing stderr except lines gh itself printed. Add a fidelity test that puts a sentinel string in the request body of a cut trace and asserts it is absent from relayed stderr.
2. `we:scripts/lib/gh-throttle.mjs:575` — Only accept `< ` header lines between `< HTTP/…` and the first blank line. Once the header section ends, treat everything as body until a `* Request took` that follows a blank line, and ignore all other markers. Add a fixture with a non-JSON body containing marker-shaped lines.
3. `we:scripts/lib/gh-spend.mjs` — Extend the mixed-resource unit test to assert per-bucket response counts, including a resource with only a baseline observation, and gate changes on that test.
4. `we:scripts/lib/gh-spend.mjs` — Add a deterministic two-tick persistence test with a shared invocation ID across the hour boundary, asserting one total invocation and preservation of all responses and points.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2851@d0d4fc364740e098692f211a4f8befd83af767ff

## Design

Premise check (2026-09-30, `origin/main` 59f603470): all four guards are still owed. `git log -S` finds no sentinel/marker test in `we:gh-throttle.test.mjs`, and the flagged code is unchanged in shape; the cited line numbers have drifted (file is 1848 lines) but the functions are the same.

- **Guards 1 + 2 — `stripGhDebug` (`we:scripts/lib/gh-throttle.mjs:~772-846`).**
  - *Unclosed block (guard 1).* When no `* Request took` is found (`end === -1`, line ~785), the code strips only through `lastHeaderLine` plus one blank line, then keeps the rest (`i = lastHeaderLine + 1`, end of the loop). If gh dies after the `> ` request headers but before any `< HTTP/` line, `lastHeaderLine` is the last `> ` line, so the request body (the GraphQL query and variables, which can hold a PR body or token-bearing text) is kept and relayed as real stderr. **Chosen rule (one, fail closed):** an unclosed block consumes everything from its `* Request at` line to end of input, and only `[git …]` lines are still removed. Nothing after an unclosed block start is relayed. Tradeoff accepted: gh's own error text that follows a cut trace is lost from the relayed stderr (today it is kept); a leaked request body is worse than a missing error line, and the call's exit status and `ok` flag still carry the failure. Before building, the builder must check who surfaces gh's error on a cut trace: `spawnWithGhDebugCapture` returns `rawStderrText`, but it also holds the leaked body, so no caller may relay it. The `stripGhDebug` doc comment ("everything after that is kept, so a partial error is never lost") must be rewritten to match.
  - *Header scan (guard 2).* The loop at `~796` accepts any `< `/`> ` line anywhere in the block and any `< HTTP/…` line as a new status. A non-JSON response body containing marker-shaped lines (`< HTTP/1.1 500`, `< x-ratelimit-used: 1`, `* Request took`) therefore rewrites status/headers or closes the block early. Fix: parse states. Request-side `> ` lines until the first blank; then request body until `< HTTP/`; then `< ` header lines until the first blank line; everything after that is body until a `* Request took` that follows a blank line. Only the header section may set `headers`; only one status per response section; `lastHeaderLine` is the end of the header section (the blank line), not the last marker-shaped line. The existing cost/shape parsing reads the body from `lastHeaderLine + 1`, so that slice must start after the blank line that ends the headers.
- **Guard 3 — `we:scripts/lib/gh-spend.mjs` (`rollupSpendDetailed`, `~261-310`).** `own.responses += inv.responses.length` and `bump(... responses ...)` count responses per invocation row, but the existing mixed-resource test (`we:gh-spend.test.mjs:118`) asserts only `attributed`. Current behavior (the pinned contract): ALL of an invocation's responses count on the row of `inv.resource` (the head record's resource); a row for another bucket exists only via `attributedByRes` or a gap and carries `responses: 0`; a resource seen only as a baseline observation with no gap and no attributed points produces no row. Add assertions for exactly those numbers: a `pr create` with one graphql and one core response gives graphql row `responses: 2`, core row `responses: 0` (attributed still 2 on core); a core-only baseline adds no row. The test is the guard and is expected GREEN today (it locks the contract); a change to "each response counts on its own bucket" is a separate design call, out of scope.
- **Guard 4 — persistence across the hour boundary (`persistSpendHours`, `we:gh-spend.mjs:~413-447`).** `groupInvocations` keys by `inv` within ONE pass; `persistSpendHours` consumes lines only while `ts < cutoff`, so one `inv` whose records straddle the cutoff is grouped twice (once per tick). Add a two-tick test with a shared `inv` across the boundary and assert the summed `requests` across both ticks' rows is 1 and every response and point is preserved. It is red today by trace (one row per tick, each `requests: 1`, sum 2). The fix is to keep an invocation's records together: stop consuming at the first line whose grouping key (the same as `groupInvocations`: `outer` first, then `inv`) also has a line at or past the cutoff. No row-schema change.

## MVP

Musts only:
1. Fail-closed unclosed-block stripping plus its sentinel fidelity test (`we:gh-throttle.mjs`, `we:gh-throttle.test.mjs`).
2. Section-aware header/body parsing plus a fixture/test with a non-JSON body containing marker-shaped lines.
3. Per-bucket `responses` assertions in the mixed-resource test, including a baseline-only resource (`we:gh-spend.test.mjs`).
4. Two-tick persistence test with a shared `inv` across the hour boundary; fix `persistSpendHours` only if it is red.

OUT (Follow-ups): anything touching the admission/throttle logic, new fixtures captured from a real gh binary, rollup schema changes.

## Test plan

- `we:gh-throttle.test.mjs` — *unclosed block leaks no request body*: input is `* Request at`, `* Request to`, `> ` headers, blank, a body line containing `SENTINEL-…`, then EOF. Asserts `stripGhDebug(...).stderr` does not contain the sentinel. RED today: `i = lastHeaderLine + 1` keeps the body.
- `we:gh-throttle.test.mjs` — *gh's own stderr survives a CLOSED block* (regression guard, GREEN today, not counted among the RED tests), so fail-closed did not swallow real errors after a complete block.
- `we:gh-throttle.test.mjs` — *marker-shaped body lines are inert*: a closed block whose response body is non-JSON text containing `< HTTP/1.1 500`, `< x-ratelimit-used: 999` and `* Request took 1ms`. Asserts the returned `responses` has the real status and headers only and that the block is not ended early. RED today: the scan overwrites `status`/`headers` from body lines.
- `we:gh-spend.test.mjs` — *mixed-resource per-bucket responses*: graphql and core in one invocation plus a core-only baseline. Asserts the exact per-row `responses` numbers pinned in Design (graphql 2, core 0, no baseline-only row). Green today by design (contract lock).
- `we:gh-spend.test.mjs` — *two-tick shared inv*: one `inv` with records at 10:59 and 11:01; tick 1 persists at `now` = 11:10 with the log holding both lines, tick 2 at `now` = 12:10 after a further line, sharing one cursor. Asserts the total invocation count is 1 and responses/points are preserved. Expected RED today; proves the fix.

## Proof plan

- `npm run test:unit -- we:scripts/lib/__tests__/gh-throttle.test.mjs we:scripts/lib/__tests__/gh-spend.test.mjs` (via the heavy-admission wrapper), pasted before (new tests red on `main`) and after (green).
- Live probe: run `stripGhDebug` over a truncated copy of `we:scripts/lib/__tests__/fixtures/gh-debug/pr-view-success.debug.stderr` (cut after the request headers, with a sentinel in the request body) on `main` vs the branch and show the sentinel present before, absent after. Cut the fixture after line 13 (the blank line ending the request headers) and append the sentinel as the first request-body line; also show the branch's output for the cut input is empty of request-body text.

## Follow-ups

- A real-binary truncation fixture (kill gh mid-request) once a stable way to produce one exists.
- Surface dropped-trace byte count in `calls.jsonl` so fail-closed stripping is observable.
- Per-invocation `inv` grouping audit for other rollup paths (`collectSpendRows` live tail vs persisted rows).

## Done when

1. **Executable** — `npm run test:unit -- we:scripts/lib/__tests__/gh-throttle.test.mjs we:scripts/lib/__tests__/gh-spend.test.mjs` fails before this item lands (the unclosed-block, marker-body and two-tick cases are red) and passes after; the guard-3 and closed-block tests pass both before and after and lock the pinned contract.
