---
kind: task
status: open
dateOpened: "2026-08-17"
tags: []
---

# Declare a kill-and-redispatch operation for stuck background builds

Surfaced by tonight's (2026-08-17) operations audit. #3149 and #3162 target DETECTING that a dispatched background session is genuinely stuck (permission-prompt-blocked or otherwise dead) rather than merely present in claude agents --json -- but even with detection, the actual remediation is still a manual, multi-step ceremony run by hand tonight roughly 3 times: identify the stuck pid, kill it, release its lane via we:scripts/lane-pool.mjs release, then redispatch fresh via we:scripts/operations/run.mjs dispatch-lane --num=<item>. A declared operation (naturally composing on dispatch-lane's existing effect machinery, the same way #3150's explore reuses it) that takes an item number, verifies it's genuinely stuck (once #3149/#3162 land), and performs kill+release+redispatch as one call would close the loop detection alone doesn't.

## Done when

1. **Executable** — a callable command (`node we:scripts/recover-stuck-dispatch.mjs --num=<item>` or a registered operation composing on `dispatch-lane`'s effect machinery) takes an item number, confirms it's genuinely stuck via #3149/#3162's liveness check (not just present in `claude agents --json`), and performs kill+lane-release+redispatch as one call — a test with a fixture "genuinely stuck" session asserts kill+release+redispatch happens, and a fixture "healthy, just slow" session asserts the command refuses to touch it.
2. Depends on #3149 or #3162 landing first for the liveness check — this item is explicitly the remediation half, not a second liveness detector.
3. `npm run check:standards` is 0 errors and the relevant new test file is green.
