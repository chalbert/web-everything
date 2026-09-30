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
