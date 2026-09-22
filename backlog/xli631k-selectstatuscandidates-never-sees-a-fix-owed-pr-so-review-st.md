---
kind: story
size: 3
parent: "3383"
status: resolved
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:skills-src/conveyor/review-daemon.mjs", "we:skills-src/conveyor/__tests__/review-daemon.test.mjs", "we:skills-src/conveyor/runner.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
tags: []
---

# selectStatusCandidates never sees a fix-owed PR, so review-status:reviewing goes stale

Live-caught 2026-09-22: PR #2472 sat labelled review-status:reviewing for ~2 hours after its actual review session had already finished and posted a real review:changes verdict -- the label was stale, not the review itself (confirmed via claude agents --json: the review-2472 session was state:done). Root cause: we:scripts/conveyor/reconcile-core.mjs's selectStatusCandidates(reviewsOwed, refusals) only ever receives review-kind dispatch entries plus non-nothing-owed refusals -- a PR that moved to being owed a FIX (plan.dispatch entries of kind==='fix', e.g. a review:changes bounce) is in neither bucket, so nothing ever re-derives and re-tags its status once it leaves the review-owed state. Confirmed this is not new: we:skills-src/conveyor/runner.mjs's own legacy call site (selectStatusCandidates(reviews, plan.refusals)) has the identical gap -- pre-existing, not introduced by the daemon split, just never noticed because a review that bounces to review:changes usually gets a fix landed and re-armed quickly, and the status tag then gets naturally refreshed by the NEXT dispatched review's own tick rather than by a deliberate re-derivation. Fix: selectStatusCandidates gains a third fixesOwed parameter (fix-kind plan.dispatch entries), included in the returned candidate list exactly like reviewsOwed already is; we:skills-src/conveyor/review-daemon.mjs's runReviewTick and we:skills-src/conveyor/runner.mjs's own call site both pass plan.dispatch.filter(d => d?.kind === 'fix') alongside the existing review-kind filter, so a PR that just moved to fix-owed gets its status label re-derived (correctly cleared, since we:scripts/conveyor/review-status-tag.mjs's own deriveReviewStatus already returns null for a done session with nothing live working it) the very next tick instead of drifting stale indefinitely.

## Progress

Fixed exactly as digested: `selectStatusCandidates(reviewsOwed, refusals, fixesOwed)` gained a third parameter, appended unconditionally like `reviewsOwed` already is (backward compatible -- every existing 2-arg caller unaffected, pinned by a dedicated test). we:skills-src/conveyor/review-daemon.mjs's `runReviewTick` and we:skills-src/conveyor/runner.mjs's own inline call site both now compute `plan.dispatch.filter(d => d?.kind === 'fix')` and pass it through. Confirmed by reintroduction: the new we:scripts/conveyor/__tests__/reconcile-core.test.mjs case fails against the pre-fix two-arg signature and passes with the fix. 118 tests pass across the three touched suites (52 + 22 + 44), no regression.

we:skills-src/conveyor/runner.mjs's own call site was touched -- a content fix to a shared helper's call, not a pass drop, so this does not conflict with the epic's own rolling-cutover discipline (the pass itself keeps running unchanged; only its status-derivation call gets the same fix applied to the standalone daemon).

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/reconcile-core.test.mjs we:skills-src/conveyor/__tests__/review-daemon.test.mjs we:skills-src/conveyor/__tests__/runner.test.mjs` passes (52+22+44=118): `selectStatusCandidates` includes every `fixesOwed` entry exactly like `reviewsOwed` already was, combines all three sources at once, and a bare 2-arg call stays byte-identical to before this fix (confirmed by reintroduction to fail without it); we:skills-src/conveyor/review-daemon.mjs's `runReviewTick` passes fix-kind dispatch entries as `statusCandidates`'s third argument; we:skills-src/conveyor/runner.mjs's own equivalent call site does the same.
