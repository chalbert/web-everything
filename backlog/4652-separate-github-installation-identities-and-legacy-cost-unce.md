---
bornAs: x3u395z
kind: story
size: 5
status: open
scope: ["we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/gh-spend.mjs", "we:scripts/lib/github-app-auth-env.mjs", "we:scripts/lib/__tests__/gh-spend.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Separate GitHub installation identities and legacy cost uncertainty in the spend ledger

All ghs-prefixed tokens collapse to app, including different installation buckets. The incident ledger mixes 6100 and 5000 limits; shared counter deltas also credit unmetered traffic to the next measured caller. Preserve installation provenance and report unknown cost honestly.

## Evidence and fix design

See we:reports/2026-09-30-unmetered-app-graphql-spend.md. we:scripts/lib/gh-throttle.mjs:1208 classifies every ghs-prefixed credential as app. The cache at we:scripts/lib/github-app-auth-env.mjs:114 carries no installation identity. The exact incident ledger contains both 6100- and 5000-limit observations under app. we:scripts/lib/gh-spend.mjs:181 assigns a legacy response up to 50 points of shared counter movement, which can credit an invisible concurrent caller to an unrelated visible caller.

Carry a non-secret installation ID and auth provenance from mint/cache through child transports into the ledger. Distinguish personal fallback and Actions tokens; an unknown installation stays unknown. Preserve bucket counter movement separately from per-query cost. Nested groups must preserve each response identity: 498 incident-hour invocation groups mix identities, and the current grouping assigns every response to the first identity. Missing in-band cost must remain estimated/unknown, never imply exclusive ownership of the preceding gap. Migrate old rows without inventing identities. Coordinate with #4639, which already requests caller/gap reconciliation tests; this story owns installation provenance and the explicit legacy-cost semantics.

## Done when

1. Two installations with the same token prefix and overlapping reset windows produce separate buckets; rotation of one installation token preserves its identity, and fallback changes provenance correctly.
2. Interleaved invisible spend and legacy responses cannot be presented as measured per-caller costs or proof of zero missing spend.
3. Tests cover absent provenance, old caches/rows, nested wrapper deduplication, stale response observations, and secret redaction. An authenticated installation-labelled probe verifies the real limit before applying a 5000-point budget assumption.

## Follow-ups

Run we:scripts/lib/__tests__/gh-spend.test.mjs, relevant auth/throttle tests, and we:scripts/verify-lane.mjs. Test fixtures must use synthetic credentials. Retain the pre-fix raw ledger for comparison; do not rewrite history into asserted installation IDs. Filed unqueued for review.


Implementation evidence (2026-09-30): we:scripts/lib/github-app-auth-env.mjs now validates the cache App/installation pair and binds inherited provenance to the applied credential. we:scripts/lib/gh-throttle.mjs records installation, Actions, personal-token, or unknown provenance for the effective child credential. we:scripts/lib/gh-spend.mjs preserves response identities within nested calls, retains shared counter movement separately, rejects regressing observations, and treats legacy caller costs as unknown. Old hourly rows are migrated on read without rewriting the raw ledger. Synthetic tests cover rotation, fallback, old caches/rows, mixed nested identities, conservation, and secret redaction. Matching integration fixtures in we:skills-src/conveyor/__tests__/runner.test.mjs and we:scripts/conveyor/__tests__/health-watch.test.mjs now supply cache provenance and assert unknown legacy costs.

Outstanding proof: the read-only environment probe found no configured App credentials and only a version-2 cache with neither installation ID nor App ID. No installation identity was inferred from that cache, no private key was read, and no 5000-point budget assumption was applied. The authenticated installation-labelled limit probe remains required on a configured host before this card can be considered fully proved.

Validation: the affected spend/auth/throttle/runner/health-watch suites pass (413 tests, six existing skips); the additional CLI provenance regression and all 11 budget-smell tests also pass. The full `npm run check:standards` passes with zero errors and 4542 warnings. `node we:scripts/verify-lane.mjs` cannot create its marker under we:.git in this sandbox (EPERM); its supported `run` mode executes the wider selection. Ten unrelated failures reproduce on an unchanged HEAD snapshot: two caller-detection cases in we:scripts/lib/__tests__/gh-app-shim.test.mjs, one scorecard case in we:scripts/lib/__tests__/antigravity-judge-spawn.test.mjs, the socket case in we:scripts/operations/__tests__/http-adapter.test.mjs, and six process-table cases in we:scripts/operations/__tests__/restart-runner-io-real.test.mjs and we:scripts/operations/__tests__/clear-stuck-session-io-real.test.mjs. A separate local-listen probe confirms EPERM. No gate or unrelated test was weakened.

The wider selection completed: 304 files passed, eight failed, one skipped. Its eight in-scope assertion failures were corrected through provenance-bearing fixtures or the new legacy-cost contract and passed focused reruns; the ten remaining failures reproduced on unchanged HEAD. The final changed-file standards check also passed with zero errors.
