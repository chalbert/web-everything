---
kind: story
size: 2
parent: "2606"
status: open
scope: ["we:scripts/review-core-cli.mjs", "we:scripts/workflows/review-parked-prs.mjs"]
dateOpened: "2026-07-23"
tags: []
---

# Guard deriveReviewDisposition call sites against the retired sampling reason

Surfaced by the `/review` of #2631 (PR #697, which removed the 1-in-N review-sampling floor). That PR's description claims `deriveReviewDisposition` is "guarded at every call site" against the now-retired `sampling floor (1-in-10)` reason string. It is not: `we:scripts/review-core-cli.mjs:142,213` call `deriveReviewDisposition` unguarded, and `we:scripts/workflows/review-parked-prs.mjs` feeds a PR's body escalation reasons straight into that CLI. So a legacy PR whose escalation block still lists `sampling floor (1-in-10)` throws `unknown reason` when reviewed through that workflow (once #2631 lands). Live exposure today is exactly one PR — **#700** (WE #2629, `review:pending`) — still clearable via the `/review` skill, which does not hit that path. The autonomous drain is unaffected (it re-scores via `scoreEscalation`, never calls `deriveReviewDisposition`).

Fix: either make the two `we:scripts/review-core-cli.mjs` call sites tolerate an unknown/retired reason token (drop it, the same lenient way `careLevelFromReasons` already does — the safer general fix), or scrub #700's stale escalation reason. Prefer the lenient-CLI fix so no future retired token can throw through the review workflow.
