---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/jury-core.mjs", "we:scripts/operations/review-pr.mjs", "we:scripts/review-set-label.mjs", "we:scripts/operations/review-pr-io.mjs", "we:scripts/lib/__tests__/jury-core.test.mjs", "we:scripts/operations/__tests__/review-pr.test.mjs", "we:scripts/__tests__/review-set-label.test.mjs", "we:scripts/operations/__tests__/review-pr-io.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "1d1011cd7913cf06a4a87fed6764c83095d65801"
tags: []
---

# Prevention — Add a fixture-driven test (and ideally a lint on marker constants) asserting that comments mentioning t… (from chalbert/web-everything#3328 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/jury-core.mjs:2368` — Add a fixture-driven test (and ideally a lint on marker constants) asserting that comments mentioning the marker name in prose parse as 'no record', distinct from a truncated opening delimiter.
2. `we:scripts/operations/review-pr.mjs:1614` — Test matrix over every confirm option (accept/changes/abstain) × pending/blocked referral state asserting only accept is refused.
3. `we:scripts/lib/jury-core.mjs:2370` — Filter referral records by comment author (the daemon/reviewer actor), or sign the record with a harness-held secret/session stamp. Add a forged-comment regression test. A lint cannot decide this, so a review lens on 'trust read from user-writable surfaces' is the cheapest guard.
4. `we:scripts/lib/jury-core.mjs:2354` — Author-filter comments before parsing (same guard as the finding above), plus a test with a foreign-author malformed marker.
5. `we:scripts/review-set-label.mjs:1894` — Require the card to reference the finding key/PR, read it from the base branch (git show origin/main:path), and add a negative test with an unrelated card.
6. `we:scripts/operations/review-pr-io.mjs:528` — Add a deterministic concurrency regression that interleaves two runs before persistence and asserts exactly one dispatch, backed by an atomic claim keyed to repository, PR, head, and referral set.
7. `we:scripts/operations/review-pr.mjs:1614` — A test in `we:review-pr.test.mjs` verifying that resuming with `{ value: 'changes' }` succeeds and records the rejection despite pending referrals.
8. `we:scripts/lib/jury-core.mjs:2390` — A test in `we:jury-core.test.mjs` where a PR has an unresolved referral on commit A, then commit B is pushed fixing the defect, asserting that `mandatoryReferralState` returns no pending referrals.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3328@211e1cc8f9316bc6495d8f936e5cab0e884757c5

## Design

Premise checked against `main` (`1d1011cd7`): the goal is NOT delivered. Only the card-filing commit (`af3fa6310`) mentions `xubpa5a`; none of the 8 guards exist as named. Partly delivered: the #3507 marker-prose fixture (`we:scripts/lib/__tests__/fixtures/referral-marker-discussion-3507.json`, replayed at `we:scripts/lib/__tests__/jury-core.test.mjs:1657`) already covers prose-mentions-marker → `{records: [], malformed: false}`, and `we:scripts/lib/__tests__/jury-core.test.mjs:1686` covers the truncated delimiter → malformed.

All work is tests plus three small hardenings, in the existing files:

1. **Marker constant ↔ reader sync (item 1).** `readReferralRecords` hardcodes `mandatory-referrals-v1` in two regex literals (`we:scripts/lib/jury-core.mjs:2360`, `:2362`; the card-body refs 2354/2368/2370/2390 are stale, `readReferralRecords` is at `:2347`) while `REFERRAL_RECORD_MARKER` (`:2333`) is a separate constant, and `we:scripts/operations/review-pr.mjs:1063` hardcodes it a third time. Build the regexes from the constant via an exported `referralMarkerPatterns(marker = REFERRAL_RECORD_MARKER)` (the parameter is how a test injects a different marker; an exported `const` cannot be patched), and use the constant at `we:scripts/operations/review-pr.mjs:1063`, where `hasReferralRecord` must also read only trusted-author comments so it agrees with the reader. Add a test that renders a record via `renderReferralRecord`, asserts it parses, and asserts a prose line mentioning the constant parses as no-record. This is the "lint on marker constants" in executable form (a test, not a new lint).
2. **Author trust (items 3, 4).** `readReferralRecords` (`we:scripts/lib/jury-core.mjs:2354`) reads every comment, including ones from any GitHub login. Filter object comments through the existing `isTrustedMarkerAuthor` (`we:scripts/lib/marker-authorship.mjs`, already used at `we:scripts/review-set-label.mjs:642`, `we:scripts/lib/review-escalation.mjs:1099`) before parsing. A comment that carries no `author`/`viewerDidAuthor` field at all (bare string or bare `{body}`: the unit-test fixture shape; production `gh --json comments` always carries `author.login`) is kept as-is, so existing fixtures stay valid; a comment that names an author is kept only if trusted. Ruling snapshots are posted by the harness under the automation login (trusted), so legitimate flows are unaffected; an untrusted-login ruling is dropped, which fails closed. This deliberately reverses the pinned test "preserves the existing treatment of record lines from untrusted authors" (`we:scripts/lib/__tests__/jury-core.test.mjs:1640`), which is rewritten to assert the new behaviour. Effect: a foreign-author forged ruling cannot clear a hold, and a foreign-author malformed marker cannot create one.
3. **Card-reference check (item 5).** `referralCardReadable` (`we:scripts/review-set-label.mjs:1948`) accepts any `we:backlog/*.md` with frontmatter. Add an injectable reader that reads from `origin/main` (`git show origin/main:<path>`) and require the card text to contain the finding key or `#<pr>`; default reader keeps the fs path when git is unavailable only in tests (injectable).
4. **Concurrent dispatch (item 6).** In `we:scripts/operations/review-pr-io.mjs` `persist` (`:520`) two runs can both pass `fresh()`/`prior` and each post a record for the same finding key. After posting, re-read and, if an earlier comment (lower position) already carries a record covering the same key at the same head with a different `runId`, treat this run as the loser: `persist` returns the fresh state with no `mirrorReferral` call and no dispatch (instead of throwing read-back failed). Comment order is the deterministic tiebreak.
5. **Decision matrix + head test (items 2, 7, 8).** Item 7 needs ONE production change, as the card itself asks: the throw at `we:scripts/operations/review-pr.mjs:1614` becomes `to === 'accepted' && (pending || blocked)`, so a `changes` bounce (fail-safe direction: it only blocks merge) is recorded despite pending referrals; acceptance stays refused. Item 2's matrix and item 8's head test (`mandatoryReferralState`) are test-only.

Drift note on item 8: the card expects "no pending" after a fixing commit B, but the shipped, tested contract (`we:scripts/lib/__tests__/jury-core.test.mjs:1695`, comment at `we:scripts/lib/jury-core.mjs:2395`) is deliberately stricter: an unresolved referral from head A stays pending on head B until B's own review records the finding again. The test pins that real contract (A-only → pending; B-record present and ruled → A's obsolete pending dropped). It does not weaken the gate.

## MVP

Musts:
1. Regexes and `we:scripts/operations/review-pr.mjs:1063` derive from `REFERRAL_RECORD_MARKER`; round-trip + prose-mention test.
2. Author filter in `readReferralRecords` with forged-ruling and foreign-author-malformed regression tests.
3. `planRecordDecision` matrix: answer {accept, changes, abstain} × referral state {none, pending, blocked}; only `accept` is refused (when pending or blocked); `changes` and `abstain` succeed in every state (item 7; RED today for `changes`+pending).
4. Head-change test (item 8, real contract).
5. Card-reference check reads base branch and requires key/PR; negative test with unrelated card.
6. Interleaved-run regression: exactly one dispatch for one repo/PR/head/finding set.

Out of scope (Follow-ups): a real lint rule for marker constants; HMAC/session-stamp signing of records; a durable atomic claim store beyond comment-order tiebreak; a "trust read from user-writable surfaces" review lens.

## Test plan

- `we:scripts/lib/__tests__/jury-core.test.mjs` "marker constant sync": changing the constant string without the regex fails (RED today: regex is a literal, so a record rendered with a patched constant is not parsed). Prose mention parses as no-record, distinct from truncated opener (malformed).
- `we:scripts/lib/__tests__/jury-core.test.mjs` "forged ruling by foreign author": a record plus a ruling snapshot posted by `author.login: 'stranger'` leaves the referral pending (RED: today it clears). "Foreign malformed marker": stranger's truncated marker → `malformed: false` (RED: today holds). Trusted-author counterparts keep behavior.
- `we:scripts/operations/__tests__/review-pr.test.mjs` `planRecordDecision` matrix (RED only where a cell is wrong today; the matrix pins the refusal table so a regression flips a cell). Includes `resume {value:'changes'}` with pending referral records the rejection.
- `we:scripts/lib/__tests__/jury-core.test.mjs` head change: A-only pending on B; B recorded + ruled → empty.
- `we:scripts/__tests__/review-set-label.test.mjs` card check: card without key/PR → not readable (RED today: any card passes); card present only on a branch, absent on `origin/main` → not readable.
- `we:scripts/operations/__tests__/review-pr-io.test.mjs` interleave: two runs share a stale `fresh()`, both post; assert one dispatch (RED today: two).

## Proof plan

Run the six new suites RED against `main` code (stash production changes) and GREEN after, capturing both outputs. Live probe: run `readReferralRecords` over the real #3507 fixture and a synthetic foreign-author forged ruling via a one-line `node -e` against the lane, showing hold retained before/after. `npm run check:standards` green.

## Follow-ups

- Real lint for hardcoded marker strings across `scripts/`.
- Signed/session-stamped referral records (stronger than author filter).
- Durable atomic dispatch claim keyed repo/PR/head/referral-set.
- Review lens: "trust read from user-writable surfaces".

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/jury-core.test.mjs we:scripts/operations/__tests__/review-pr.test.mjs we:scripts/__tests__/review-set-label.test.mjs we:scripts/operations/__tests__/review-pr-io.test.mjs` (drop the `we:` prefixes when typing the command) fails before this item lands (forged-ruling, interleave and card cases) and passes after.
2. **Refusal on error** — an unreadable author, unreadable base-branch card, or malformed record keeps the hold (fail closed); a foreign author's comment is ignored, never trusted.
3. **Non-code inputs** — comment bodies, PR bodies and card text are untrusted data: parsed only after author filtering, never executed.

## Progress

- 2026-10-03 prepare: premise verified not delivered (only #3507 fixture partly covers item 1). Item 8's "no pending after fix commit" corrected to the deliberate stricter contract at `we:scripts/lib/jury-core.mjs:2395`. Scope unchanged.
