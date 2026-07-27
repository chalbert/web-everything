---
kind: task
parent: "2410"
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/merge-ai-prs.test.mjs"]
dateOpened: "2026-07-27"
tags: []
---

# anti-test-gaming re-park must exempt a review:accepted PR (else an accepted PR trips it forever)

The drain's scanTestTampering re-park short-circuits before decideReviewGate, so a human-accepted PR whose own test fixtures contain skip/only/.each markers is re-parked every pass and never lands. Exempt review:accepted (accepted-wins-first, as decideReviewGate already does).

## The seam

In `we:scripts/merge-ai-prs.mjs` (~L1836–1856), the anti-test-gaming gate (#2440) runs on the candidate's net
diff text and, on a `scanTestTampering` hit, does `v.decision = 'skip'`, re-adds `review:human`, and
`continue`s — **before** the `decideReviewGate` call (~L1858). `decideReviewGate` is the one place that checks
`review:accepted` **first** and returns `{action:'merge'}` (`we:scripts/lib/review-escalation.mjs` L524).
Because the test-gaming block short-circuits ahead of it, an already-cleared PR never reaches that gate.

## Why it bites

`scanTestTampering` fires on a diff's own **test fixtures**. A PR that legitimately adds `.skip.each` /
`.only.each` / `it.skip` **as test data** (e.g. #2669, which tightens `scanTestTampering` itself and adds those
markers as regression fixtures) trips the detector on **every** drain pass. So after a human clears it via
`/review` (→ `review:accepted`), the daemon re-parks it and re-stamps `review:human` next pass — an infinite
park loop. #791 hit this: it was human-accepted, CI-green, cleanly mergeable, yet the daemon would never land it;
it had to be merged by hand.

## The fix

Before the test-gaming re-park (and the manifest-tamper re-park just above it, ~L1800–1827, which has the same
shape), check for an existing `review:accepted` label and **skip the re-park** when present — the human already
cleared this exact concern, same "accepted wins first" rule `decideReviewGate` encodes. A fresh `review:human`
must never be stamped over a standing `review:accepted`. Add a regression test in
`we:scripts/__tests__/merge-ai-prs.test.mjs`: a candidate carrying `review:accepted` whose diff trips
`scanTestTampering` lands (merge), not parks.

## Safety note

This does **not** weaken the gate for un-cleared PRs — the scan still fires and parks `review:human` on any PR a
human has **not** accepted. It only stops a second, redundant human-gate from being re-applied after a human has
already judged the very same diff. Gate-self file (`we:scripts/merge-ai-prs.mjs`), so the fix itself lands
through a `review:human` cycle.
