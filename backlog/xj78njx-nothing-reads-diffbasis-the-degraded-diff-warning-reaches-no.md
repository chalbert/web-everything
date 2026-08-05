---
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
---

# Nothing reads diffBasis — the degraded-diff warning reaches no reviewer

PR #1031 review, non-blocking. we:scripts/fetch-parked.mjs now emits diffBasis ('net' vs the degraded 'three-dot') on every bundle, and a repo-wide grep finds ZERO consumers: not the converge harness, not the review core, not the console. So when the bundle degrades — a foreign clone without the head ref, a failed fetch, a file list that disagrees with gh's — the panel is handed an inflated three-dot file list and told nothing. The field is the honest half of the plumbing; this is the half that acts on it. Smallest useful consumer: the juror mandate states the basis, and a 'three-dot' basis suppresses scope-creep findings entirely, since on that basis a sibling-lane file legitimately appears in the list. Relates to #2904.
