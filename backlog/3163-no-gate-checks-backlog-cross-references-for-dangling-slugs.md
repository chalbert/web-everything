---
bornAs: xcgy9sx
kind: task
status: open
scope: ["we:scripts/check-standards.mjs", "we:scripts/check-standards-rules.mjs"]
dateOpened: "2026-08-17"
tags: [gate-gap, backlog, links]
---

# No gate checks backlog cross-references for dangling slugs

A fabricated backlog slug in a prepared item's own citations produced six dead links, and
`check:standards` did not catch any of them — nothing in the gate validates that a `#NNNN` reference or
hash-slug link inside backlog prose actually resolves to a real file. The independent PR review that
caught this did so by hand, reading each link, not via any automated check.

## Why this is a real gap, not a nicety

Surfaced 2026-08-17 during the prep pass on `#3128`: a genuinely independent review found the dangling
slug as one of five findings, but only because a human-style read caught it — the same class of defect
`we:scripts/lib/citation-check.mjs` already partially guards for other artifact types (report/researchTopic
cross-references), per the existing `HASH_REWRITE_DIRS` machinery referenced elsewhere in tonight's work.
Backlog-to-backlog prose links apparently sit outside that existing coverage.

## Done when

1. **Executable** — a check scans backlog item bodies for `#NNNN` and hash-slug references, resolves each
   against the real set of backlog files, and errors on any that don't resolve; a test with a
   deliberately-dangling reference in a fixture item asserts it's caught, and a fixture with only valid
   references asserts it's clean.
