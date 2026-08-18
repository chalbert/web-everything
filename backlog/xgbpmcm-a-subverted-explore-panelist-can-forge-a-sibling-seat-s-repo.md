---
kind: task
status: open
dateOpened: "2026-08-17"
tags: []
---

# A subverted explore panelist can forge a sibling seat's report via the run-store or agent listing

Surfaced by an independent security-lens review of PR #1457/#3150 (2026-08-17), verdict CONFIRMED, category committee-blindness-residual, but reduced to accept (not blocking) since it's a pre-existing residual the same PR's own we:scripts/operations/explore-io.mjs docstring already discloses under a 'WHAT IT DOES NOT CLOSE' heading, not something newly introduced. A subverted committee panelist (one whose WebFetch/Bash tool ingests adversarial content that subverts its instructions) can read we:.operations/runs/<runId>.json in its own cwd -- which carries every seat's minted session handle in plain JSON -- or set-difference the claude agents --json listing before/after the next seat is dispatched (seats run serially, so exactly one new session appears between checks) to derive a sibling panelist's handle. panelistReportPath(runId, panelist, handle) is then a pure, public derivation of that sibling's report path, letting the subverted panelist write a fabricated report there before the real one finishes; the observer resolves that seat succeeded on the forged text with nothing checking authorship. Because the synthesis mandate calls cross-lens agreement 'the strongest signal this shape produces', a forged agreement can drive the reduced verdict, and on file-stories/publish-research becomes a filed backlog item or published /research/ topic once a human approves at confirm. Currently closed only by PROMPT-LEVEL instruction ('do not read this operation's run records... do not list or inspect other agent sessions'), not by mechanical isolation -- the operation relies on the panelist's own good behavior under adversarial pressure, which is exactly the class of trust this repo does not otherwise extend to agent output (see #2440's whole anti-test-gaming rationale: 'an agent panel can be fooled'). No test in we:scripts/operations/__tests__/explore.test.mjs exercises either channel -- the existing forgery test only proves the observer resists the OLD derivable-path scheme, not that a panelist is mechanically unable to reach the run-store file or the agent listing.

## Done when

1. **Executable** — a test proves a panelist process cannot derive a sibling seat's report path through either
   disclosed channel: (a) the run-store JSON at its own cwd no longer carries other seats' handles in a form a
   panelist can read (moved out of the panelist's cwd, redacted, or handle-scoped per-seat), and (b) a panelist
   cannot distinguish a sibling's `claude agents --json` entry from its own well enough to derive a usable
   handle — fails today (both channels are open, per the reviewer's confirmed reproduction), passes once at
   least one channel is mechanically closed (closing one is enough to break the derivation chain; closing both
   is the fuller fix).
2. The observer gains a way to detect a report written before its owning seat's session actually completed
   (a timing/provenance check), as defense in depth beyond closing the two read channels — a test asserts a
   report arriving before its seat is observed complete is rejected or flagged, not silently accepted.
3. A regression test in we:scripts/operations/__tests__/explore.test.mjs exercises at least one of the two
   channels directly (read the run-store from a simulated panelist cwd; diff agent listings around a
   dispatch) and asserts the derived handle either doesn't work or isn't reachable — closing the gap the
   review found: "no named test reddens if that isolation is removed, because none currently asserts it
   exists."
4. `npm run check:standards` is 0 errors and the relevant test files are green.
