---
bornAs: xsbyo56
kind: story
size: 2
parent: "3383"
status: resolved
scaffoldedBy: "park-reason-file-detail"
dateScaffolded: "2026-09-02"
dateOpened: "2026-09-02"
dateResolved: "2026-09-02"
tags: []
---

# Drain's held-review-hold comment names the specific file(s), not just the label category

PR #1814 touched three files — two backlog cards and the statute file
`we:docs/agent/platform-decisions.md` — but only the statute file is actually gate-self/sensitive.
It got labeled `review:human` correctly, and the drain's park-reason comment on it read:

> held — a review hold (review:human) stands, so the "ready-to-merge" go-ahead is withheld even
> though the required check is green (#2832). Clear the review to release it.

That is generic: it names the *label*, never *which file in the diff* actually forced the hold. A
human clearing the hold has to already know this repo's escalation rules or read the whole diff to
find the one file that matters.

## Root cause (verified against the live PR + the code)

The comment above is built at `we:scripts/merge-ai-prs.mjs:3211`, inside
`reconcileCiLifecycleLabels`'s green-but-held branch (`labelOnGreenVerdict(...).reason === 'held'`).
It is composed **only** from the PR's hold *labels* (`review:human`/`review:pending`/`review:changes`)
— it never reads the PR body or the escalation signals.

The file-level detail already exists, just one hop away: `we:scripts/lib/review-escalation.mjs`'s
`scoreEscalation` produces `reasons` with the specific files per category (e.g. `statute
(we:docs/agent/platform-decisions.md) — human review required`, confirmed verbatim in PR #1814's own
body), and `buildEscalationReasonBlock` appends those reasons to the PR body under the `## Escalation
reason` marker at park time. `we:scripts/review-detail.mjs` already exports a reader for that exact
block, `parseEscalationReason(body)` — but `we:scripts/merge-ai-prs.mjs` never imports it, so the one
comment site that *does* post text on a held-but-green PR (the #2832 reconcile) throws that
file-level detail away and falls back to the bare label name.

(The *original* park comment, posted when `scoreEscalation` first parks the PR, deliberately does
NOT restate the reason for a human-required park — `shouldPostParkReasonComment` skips it because the
PR-body block already has the detail. That design is fine; the bug is specific to the *second*,
CI-green reconcile comment, which posts fresh generic text instead of also reading that block.)

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/merge-ai-prs-ci-lifecycle-and-land-effects.test.mjs`
   passes, including a new case asserting that the held-review comment names the specific file(s)
   from the PR body's `## Escalation reason` block (not just the label) when that block is present,
   and falls back to today's generic wording when it is absent.
2. Live-shape check: feeding PR #1814's actual `labels`/`body` (`review:human`, the escalation-reason
   block quoted above) through the new builder produces a comment mentioning
   `we:docs/agent/platform-decisions.md`, not just `review:human`.
3. `npm run check:standards` passes.
