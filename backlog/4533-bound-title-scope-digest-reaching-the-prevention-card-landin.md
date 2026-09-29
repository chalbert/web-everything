---
bornAs: xszsr8e
kind: task
parent: "4075"
status: open
scope: ["we:scripts/operations/land-prevention-card.mjs", "we:scripts/lib/prevention-landing-job.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Bound title/scope/digest reaching the prevention-card landing job's App-authenticated PR against hostile PR-content input

#4493 converge round-1 (security lens): the review-loop's own mechanized prevention filing now spawns `we:scripts/operations/land-prevention-card.mjs` (#4317) with `--title`/`--scope`/`--digest` values derived from PR review-finding text, which a crafted PR can influence, and which the job opens as a PR under the gh App identity. `boundLandPreventionCardInput` already length-caps + neutralizes control chars/HTML-comment markers, and argv is passed as an array (no shell injection) — but nothing constrains `scope` to look like real repo-relative paths, or rejects a hostile `--`-prefixed/newline-bearing value outright. This item pre-existed #4493 (the approval-time caller has had the identical exposure since #4317) — #4493 only adds a second caller through the same seam, it does not widen the boundary. Add an explicit validation step (a safe charset/shape check on scope entries; reject rather than silently truncate a hostile value) plus a test that drives the job with hostile title/scope/digest and pins the safe behavior.

## Done when

1. **Executable** — a new regression in the landing job's own test suite that drives it with a hostile
   `--title`/`--scope`/`--digest` (a `--`-prefixed value, an embedded newline, a non-path-shaped scope entry)
   and asserts the job rejects or safely neutralizes it, rather than opening a PR carrying it — red before this
   item (no such assertion exists), green after:
   ```
   npx vitest run scripts/operations/__tests__/land-prevention-card.test.mjs
   ```
