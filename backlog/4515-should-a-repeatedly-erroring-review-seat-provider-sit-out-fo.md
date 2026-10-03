---
bornAs: x0tjpbx
kind: story
size: 3
status: open
scope: ["we:scripts/lib/provider-routing.mjs", "we:scripts/lib/__tests__/provider-routing.test.mjs", "we:scripts/operations/review-extra-seats.mjs", "we:scripts/operations/__tests__/review-extra-seats.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "007f69ee090e641e9fbbd1bb7f08b711f761c2cb"
tags: []
---

# Should a repeatedly-erroring review-seat provider sit out for a cooldown instead of burning calls

A review-seat provider whose recent calls keep erroring still gets dispatched every review (we:scripts/lib/provider-routing.mjs's selectReviewSeatProvider only re-ranks a provider after a recent failure, it never skips it outright). Worth a small addition -- a per-provider/lens cooldown after N consecutive errors -- once fixing the underlying agy-claude --effort argv bug (this item's sibling) is not enough on its own for some future erroring provider. Needs its own PREPARE: how many consecutive errors, what cooldown length, per-lens or per-provider scope.

## Done when

1. **Executable** — `node --test we:scripts/operations/__tests__/review-extra-seats.test.mjs` (new cooldown cases) fails before this item lands and passes after.

## Progress

- Premise check (2026-10-02, `main` @ 007f69ee0): not delivered. `git log` shows only the JIT-number commit for `4515`; `selectReviewSeatProvider` (`we:scripts/lib/provider-routing.mjs:1221`) still only sorts by `recentFailure` (last row not `ok`, `:1242`) and never excludes a provider. Citations in the card hold; scope (`we:scripts/lib/provider-routing.mjs`, `we:scripts/operations/review-extra-seats.mjs`) is right, plus the sibling caller `we:scripts/operations/review-dispatch.mjs:247` which must pass `now`. Sibling #4516 (agy-claude `--effort` argv bug) is the concrete trigger, tracked separately.

## Design

Add a cooldown filter inside `selectReviewSeatProvider` (`we:scripts/lib/provider-routing.mjs:1221`), right after the `available` filter (`:1225`). The function stays pure: it takes a `now` option (ms epoch) and never reads a clock; if `now` is omitted no cooldown applies. `reviewSeatRoutes` (`we:scripts/operations/review-dispatch.mjs:247`) gains a `now` option and forwards it; its callers in `we:scripts/operations/review-extra-seats.mjs` (`:573` and the re-plan at `:601`) pass the injected `io.now()` already available at `:553`, and the red-team site (`:1267`) passes the `io.now()` from `:1238`. No `Date.now()` is added. Shape follows the existing `quotaHold`/`probeDue` logic (~`:255-290`: a `scoredAt` window plus one probe after it); it differs only in being lens-scoped and keyed on a consecutive-failure count, so the constants live beside `REVIEW_SEAT_PROVIDERS` in the lib (the quota probe interval stays env-tunable where it is).

Rule, scope **per provider × lens** (the same grouping `rowsFor` already uses at `:1234`, `taskType = review-lens:<lens>`; one call writes one row per lens, so 3 errors means 3 failed calls on that lens, and a provider failing on every lens as in #4516 needs 3 failures per lens): take that pair's rows newest-first by PARSED `scoredAt` (`Date.parse`, so mixed `Z`/`+00:00` formats order correctly; a tie keeps store order; an unparseable row is treated as unknown and disables the cooldown); count the leading run of consecutive rows whose `status` is not `ok` and not `quota-exhausted` (quota is already handled by `available`; any other or unknown status counts as a failure, fail-closed like the file's header note). If the run is >= `REVIEW_SEAT_COOLDOWN_AFTER = 3` and `now - newestMs < REVIEW_SEAT_COOLDOWN_MS = 6h`, the provider is excluded for this lens and an audit-trail entry `cooldown:<provider>` records the run length and time left. A clean row ends the streak; after the window expires one probe call is allowed, and a failure re-arms the cooldown (the run is still >= 3, newest row fresh). Unparseable `scoredAt` → no cooldown (fail-open on bad data, since a seat is advisory). If every candidate is cooling, return `provider: null` with a reasoning naming the cooldown, which `reviewSeatRoutes` turns into a skipped seat and the red-team loop into `skipped`; accepted, because seats are advisory and Claude's mandatory seats still cover the PR. A provider chosen by a configured routing-policy route (`resolveOperationRoute`) bypasses `selectReviewSeatProvider` at both sites and is therefore NOT cooled — accepted for the MVP (Follow-up). Constants are exported next to `REVIEW_SEAT_PROVIDERS` (`:1196`).

## MVP

Musts only: the two exported constants; the cooldown filter + audit entry; `now` threaded through `reviewSeatRoutes` and its callers at `:573`/`:601` plus the red-team site; header comment criterion list (`:1176-1189`) updated; unit tests. OUT of scope (Follow-ups): operator-tunable N/duration via routing policy, surfacing cooldowns in the review report/board, cooldown for work-cascade `selectProvider`.

## Test plan

In `we:scripts/operations/__tests__/review-extra-seats.test.mjs` next to the existing `selectReviewSeatProvider` tests (~`:135`), reusing its `row()` helper and `TWO` fixture. RED today: cases 1, 6, 8 (and a `reviewSeatRoutes` case with `now` showing a cooled provider's seat is routed elsewhere/skipped). Guards that pass today and pin the boundaries: 2, 3, 4, 5, 7.
1. RED. 3 consecutive `error` rows for provider A within 6h, `now` given, `available` pinned to A alone → `provider: null` (today A is still picked, since failing providers are only ranked last, never excluded).
2. 2 consecutive errors → A still eligible (below N).
3. 3 errors but newest older than 6h → A eligible again (window expiry).
4. error, error, ok, error, error → no cooldown (a clean row breaks the streak).
5. Errors for lens X do not cool the same provider for lens Y.
6. All candidates cooling → `provider: null`, reasoning mentions cooldown.
7. `now` omitted → behaves exactly as before (regression guard); `quota-exhausted` rows do not count.
8. Audit trail contains `cooldown:<provider>` with the run length.

## Proof plan

Live before/after on a real surface: load the real `review-seat` rows from the store path that `readSeatCapUsage` resolves (`we:scripts/operations/review-extra-seats.mjs:726`; the probe reuses that resolver) holding the agy-claude 100%-error history from #4516, and replay them through `selectReviewSeatProvider` for the `red-team` lens via a short `node -e` probe at current `main` (agy-claude still returned/ranked) and on the branch (agy-claude excluded with a `cooldown:agy-claude` audit line, another provider picked). The "before" run uses `main` (where `now` is ignored). If the live store is absent or has aged out, replay a fixture of 3 recent `error` rows instead and say so. Paste both outputs in the PR body. Plus `npm run test:unit -- provider-routing`.

## Follow-ups

- Make N and cooldown length configurable through the routing policy.
- Apply the cooldown to provider routes chosen by `resolveOperationRoute` (currently bypass it).
- Show active seat cooldowns in the review report / board.
- Consider the same cooldown for the work-cascade `selectProvider`.
