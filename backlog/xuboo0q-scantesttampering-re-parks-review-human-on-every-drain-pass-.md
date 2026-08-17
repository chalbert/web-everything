---
kind: task
status: open
dateOpened: "2026-08-17"
tags: []
---

# scanTestTampering re-parks review:human on every drain pass, no memory of a clear-human clearance

Confirmed live tonight (2026-08-17), a genuine infinite loop on PR #1445: we:scripts/merge-ai-prs.mjs:3290's scanTestTampering gate scans the PR's net diff text for deleted test files and, on a hit, unconditionally re-parks review:human -- with zero memory of a prior clear-human clearance. Unlike #2409's stale-acceptance gate a few lines below it (which reads a reviewed-sha marker stamped by we:scripts/review-set-label.mjs's clear-human target and only re-triggers when the head has genuinely moved past what was reviewed), scanTestTampering has no equivalent check: it re-fires identically on every drain sweep regardless of whether a human already reviewed and explicitly cleared the exact same tampering pattern on the exact same head SHA. #1445 was cleared via the sanctioned clear-human ceremony FOUR separate times in about 50 minutes (22:50:28, 22:59:57, 23:37:22, and again after this filing), each time re-parked by the next drain pass with no new commit in between -- confirmed by diffing the label timeline against the commit history. Any legitimate PR that deletes a test file (a deliberate consolidation, a genuine removal of dead coverage) is permanently unlandable without a human manually re-clearing it forever, once per drain sweep, since the gate has no way to ever remember 'a human already looked at this exact tampering pattern and approved it'.

## Done when

1. **Executable** — a test asserts that once a PR has been `clear-human`'d at head SHA X (stamping the `reviewed-sha` marker specifically via `we:scripts/review-set-label.mjs`'s `clear-human` target), a subsequent `we:scripts/merge-ai-prs.mjs` pass that hits the identical `scanTestTampering` finding on that same unchanged head does NOT re-park `review:human` — fails today (a fixture PR cleared once and re-scanned with no new commit re-parks), passes once the gate checks for that specific clear-human marker. The check must NOT be a bare `reviewed-sha == live-head-sha` comparison — an ordinary agent `review:accepted` also stamps `reviewed-sha` at the same seam, and treating that as equivalent to a clear-human ceremony would silently suppress the anti-test-gaming re-park on a PR nobody with clear-human authority ever looked at, reopening the exact self-clearing hole `#2440` introduced this gate to prevent. A third fixture proves this: a plain `review:accepted` (never `clear-human`'d) at the current head must still re-park on a tampering hit.
2. A second fixture proves the gate still correctly fires on a GENUINELY new tampering instance — a PR whose head advances past the reviewed SHA with a new/different test-deletion diff must still re-park, so this fix narrows the false-positive loop without weakening the actual anti-gaming protection.
3. `npm run check:standards` is 0 errors and the relevant new test file is green; this touches `we:scripts/merge-ai-prs.mjs`, the sole writer to main, so the fix needs the same adversarial review rigor as any change there (this is not a low-risk backlog-only filing).
