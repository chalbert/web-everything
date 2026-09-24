---
bornAs: x2h4jmq
kind: story
size: 3
parent: "3383"
status: active
scaffoldedBy: "close-3784"
dateScaffolded: "2026-09-23"
scope: ["we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/operations/fix-dispatch-wrapper.mjs", "we:scripts/operations/ci-heal-dispatch-wrapper.mjs", "we:scripts/conveyor/ci-heal-mark.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-24"
tags: []
---

# Build #3850 Fork 2: force review:pending / a merge hold on delegated routes at the land seam

#3850's Fork 2 was ratified 2026-09-22 (every route whose executed vendor is not Claude gets a dispatch-time hold, then a merge hold at the land seam requiring independent review before landing) but only Fork 1 (naming a supervisor so a well-formed dispatch is never held at spawn) was ever built, as part of #3784's own scope. Fork 2 -- forcing review:pending or an equivalent merge hold on a delegated route at the land seam -- has no code and no tracking item. Needed before #3443 graduates the branch to main, since without it a delegated (non-Claude) dispatch that clears spot-check has no independent look before landing.

## Done when

Fork 1 (already built, #3784) is the DISPATCH-TIME pass-through: a Claude-executed `full` route is never held
at spawn. Fork 2 is what this item builds — the hold that binds once the REAL `executed` vendor is known,
covering all three dispatch kinds (`build`/`fix`/`ci-heal`), each closed the way its own mechanics require:

1. **`build` — LIVE, enforced.** `we:scripts/operations/deliver-item-wrapper.mjs`'s `decideParkMode` takes a
   new `executedVendor` parameter (default `'claude'`, additive-only). When the route's real `provider.vendor`
   (read off the provider object that actually spawned the turn, never `routed`/a prediction) is not
   `'claude'`, and no stronger park reason already applies (statute path / needs-human-judgment / converge
   escalate / the real `scoreEscalation` rubric), the PR is forced to `park`/`review:pending` instead of
   `label-on-green`.
   **Executable:**
   `node we:scripts/readiness/heavy-admission.mjs run -- npx vitest run we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs -t "3850 Fork 2"`
   — 9 tests, all passing on this diff (would not exist / would fail on the pre-#4021 tree: `decideParkMode`
   had no `executedVendor` param and no provider carried a `vendor` field).
2. **`fix` — LIVE, enforced, with NO new logic needed.** `resolveFixTarget` only ever resolves a `fix`
   dispatch against a PR that ALREADY carries `review:changes` or `review:human`, so `rearmReview`'s existing,
   vendor-agnostic `review:changes → review:pending` swap already gives every fix push — Claude-executed or
   delegated — Fork 2's land-seam hold by construction. Documented at the `rearmReview` call site in
   `we:scripts/operations/fix-dispatch-wrapper.mjs` and proven both directions.
   **Executable:**
   `node we:scripts/readiness/heavy-admission.mjs run -- npx vitest run we:scripts/operations/__tests__/fix-dispatch-wrapper.test.mjs -t "3850 Fork 2"`
   — 3 tests (both vendors resolve to the same `review:pending` re-arm; provider vendor parity).
3. **`ci-heal` — DATA recorded live; the land-time READ is deliberately deferred (a fast-follow, not a silent
   gap).** `ci-heal` can never write a review label on any path (this repo's own hardest rule on that axis,
   unchanged, per the ratified text). Since it cannot self-enforce a hold, this item builds the evidence half:
   `we:scripts/conveyor/ci-heal-mark.mjs`'s `buildCiHealComment` stamps the real executed vendor into its
   durable comment (an `Executed by: <vendor>` line, omitted entirely for `'claude'` so every existing comment
   shape is byte-identical), and its new `parseCiHealExecutedVendor` reads it back. `ciHealMark` in
   `we:scripts/operations/ci-heal-dispatch-wrapper.mjs` threads `provider.vendor` through. The actual land-time
   REFUSAL (reading this marker inside `we:scripts/merge-ai-prs.mjs`'s `decideReviewGate` call and holding a
   `label-on-green` PR whose last push was delegated) is NOT wired in this diff — mirroring this repo's own
   existing `#3493` precedent in `we:scripts/lib/review-escalation.mjs` (`engineTier`: a new gate predicate
   built and tested, its call-site value deliberately held back until a real, live-reachable writer exists)
   rather than wiring a new predicate blind into a ~4,000-line production merge gate this item did not audit
   end-to-end. **Residual gap this leaves open:** a PR built by Claude (legitimately `label-on-green`, no hold)
   that is later CI-healed by a delegated vendor can still land unreviewed until the follow-up wiring lands.
   **Executable:**
   `node we:scripts/readiness/heavy-admission.mjs run -- npx vitest run we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs we:scripts/operations/__tests__/ci-heal-dispatch-wrapper.test.mjs -t "3850 Fork 2"`
   — 12 tests (comment build/parse round-trip, latest-wins across repeat heals, pre-#4021 comments read safe
   as `'claude'`, end-to-end `dispatchCiHeal` threading, provider vendor parity).
4. **Both directions, confirmed together.** A Claude-executed route (dispatch-time pass-through, Fork 1) never
   trips any Fork-2 hold on any of the three kinds (tests above, "claude" cases). A route whose ACTUAL executed
   vendor is non-Claude — including a `deliveryAgent:` marker forcing a vendor the criteria routed elsewhere —
   is held: `review:pending` for `build`, the existing re-arm for `fix`, and a durable, machine-readable record
   for `ci-heal` pending the land-time wiring noted above.
