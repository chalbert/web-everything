---
bornAs: xnbbd6d
kind: story
size: 2
parent: "2606"
status: resolved
scope: ["we:scripts/review-core-cli.mjs", "we:scripts/workflows/review-parked-prs.mjs"]
dateOpened: "2026-07-23"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
tags: []
---

# Guard deriveReviewDisposition call sites against the retired sampling reason

Surfaced by the `/review` of #2631 (PR #697, which removed the 1-in-N review-sampling floor). That PR's description claims `deriveReviewDisposition` is "guarded at every call site" against the now-retired `sampling floor (1-in-10)` reason string. It is not: `we:scripts/review-core-cli.mjs:142,213` call `deriveReviewDisposition` unguarded, and `we:scripts/workflows/review-parked-prs.mjs` feeds a PR's body escalation reasons straight into that CLI. So a legacy PR whose escalation block still lists `sampling floor (1-in-10)` throws `unknown reason` when reviewed through that workflow (once #2631 lands). Live exposure today is exactly one PR — **#700** (WE #2629, `review:pending`) — still clearable via the `/review` skill, which does not hit that path. The autonomous drain is unaffected (it re-scores via `scoreEscalation`, never calls `deriveReviewDisposition`).

Fix: either make the two `we:scripts/review-core-cli.mjs` call sites tolerate an unknown/retired reason token (drop it, the same lenient way `careLevelFromReasons` already does — the safer general fix), or scrub #700's stale escalation reason. Prefer the lenient-CLI fix so no future retired token can throw through the review workflow.

## Second unknown-reason source — the #2635 roster-expansion reason (surfaced by the `/review` of PR #732)

The all-or-nothing throw is not specific to the retired sampling token — it fires on **any** reason string `deriveReviewDisposition` can't canonicalize. #2635 (bind + reconcile the jury roster at PR-open) introduces a **second** such source: `reconcileRoster` in `we:scripts/lib/review-escalation.mjs` stamps a free-text `jury roster expanded past pre-registration (added …) — re-triggering human alignment (up-front)` line into the shared `## Escalation reason` block. Once a PR carries a canonical reason (e.g. `blast-radius (…)`) **and** a roster-expansion reason together, `deriveReviewDisposition` throws on the roster string; `we:scripts/lib/review-detail.mjs` `assembleReviewDetail` catches it and degrades `disposition` to `null` (no crash; `reviewClass` still reads `human` from the label), losing the converge-vs-human routing. This is a **third** call site beyond the two in `we:scripts/review-core-cli.mjs`.

Dormant today: `preRegisteredLenses` is always `null` until the prepare-time carrier (#2638) records a charter roster on the manifest, so `roster.reasons` is always empty and no roster string is ever stamped. It activates when #2638 lands.

This argues for the **lenient-core** variant of the fix over per-call-site guards: make `deriveReviewDisposition` itself drop / partially-canonicalize unknown reason tokens (keep the disposition from the reasons it *does* recognize) so every call site — the two CLI ones **and** `we:scripts/lib/review-detail.mjs` — is covered at once, and no future stamped reason (retired or newly-introduced) can null a whole disposition.
