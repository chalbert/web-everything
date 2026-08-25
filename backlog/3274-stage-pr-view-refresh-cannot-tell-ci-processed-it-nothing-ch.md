---
bornAs: xrqut4u
kind: task
status: open
dateOpened: "2026-08-25"
tags: []
---

# stage-pr-view --refresh cannot tell "CI processed it, nothing changed" from "CI has not run yet"

The `--fromTransport --refresh` poll detects completion only by the view blob's sha changing. But `we:scripts/produce-pr-view.mjs` deliberately emits byte-identical output when the PR has not changed (no timestamp), so `we:.github/workflows/stage-pr-view.yml`'s `git diff --cached --quiet` commits nothing and the poller never sees a new sha. A defensive refresh of an already-current view therefore burns the full attempt/timeout budget and throws "gave up waiting for CI" even though CI ran and confirmed the view is correct — a false negative that teaches operators to distrust the transport. Fix shape: a per-request acknowledgement (CI marks or removes the request file it processed, or writes a request-id-keyed marker) so "processed, no change" is distinguishable from "not processed yet" without content diffing. Found by the round-6 correctness juror on PR #1548; dispositioned carve-out there because it degrades rather than breaks.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
