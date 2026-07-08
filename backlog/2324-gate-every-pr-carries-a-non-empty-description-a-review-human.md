---
kind: story
size: 2
parent: "2285"
status: resolved
dateOpened: "2026-07-07"
dateStarted: "2026-07-08"
dateResolved: "2026-07-08"
graduatedTo: none
tags: [review, drain, pr, gate]
---

# Gate: every PR carries a non-empty description; a review:human PR embeds the escalation reason

PR #206 landed with an **empty body** — even though `we:skills-src/pr/SKILL.md` already says a `--body-file` is
*required* and `we:scripts/pr-land.mjs` never drops a body. So the rule exists as a skill instruction but is
**not enforced**: a bodyless PR still landed. Make it a gate, not prose.

## Two guarantees

1. **Non-empty description on every PR.** On the land path (`we:scripts/pr-land.mjs` / the label lander in
   `we:scripts/merge-ai-prs.mjs`), refuse to land a PR whose description is empty/whitespace. A PR with no
   summary of *what changed and why* is a review + audit-trail gap, not a stylistic one.
2. **A `review:human` PR states its reason.** When the drain parks a PR as `review:human`, the **escalation
   reason** (the `parked` array's `reasons` — why a human is required) must be present in the PR body, so the
   operator opening it sees *why* it needs them without re-deriving it. Ideally the drain writes/augments the
   body with the reason at park time; the gate then verifies it is there.

## Notes

- Some of this is partly captured: `/pr` mandates a body and `pr-land` plumbs `--body-file`; the lane review
  (#2170) composes a body. The missing piece is **enforcement** (a bodyless PR slipped through) + the
  **review:human reason** specifically.
- Keep the check cheap and on the land path so it can never be skipped by a producer that forgot the body.

## Acceptance

- A PR with an empty/whitespace description is refused at land (loud, not silent).
- A `review:human` PR's body contains the escalation reason; verified by the gate.
- Re-landing #206's class of change (bodyless) now fails fast instead of merging.
