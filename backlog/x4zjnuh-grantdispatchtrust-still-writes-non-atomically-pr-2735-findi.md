---
kind: story
size: 1
parent: "4075"
status: open
scope: ["we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/__tests__/dispatch-lane.test.mjs"]
dateOpened: "2026-09-26"
tags: []
---

# grantDispatchTrust still writes non-atomically (PR #2735 finding 5, deferred from #4188 follow-up)

Post-accept red team (PR #2735) on merged PR #2726 (#4188/x5qketq) found grantDispatchTrust in we:scripts/operations/dispatch-lane-io.mjs still writes we:scripts/operations/dispatch-lane-io.mjs's per-project CLI trust file with a plain writeFileSync (backup-first, but not temp-plus-rename), unlike its sibling revokeDispatchTrust which already went through we:scripts/lib/atomic-json-file.mjs's writeJsonAtomic plus withFileLock. Deferred out of the sibling follow-up card (x16br9j) because open PR #2732 also edits we:scripts/operations/dispatch-lane-io.mjs and had not merged when x16br9j was filed (2026-09-26); do this once #2732 has merged and we:scripts/operations/dispatch-lane-io.mjs is stable again, to avoid a conflicting concurrent edit. Fix: route grantDispatchTrust's write through writeJsonAtomic the same way revokeDispatchTrust already does, keeping the existing withFileLock section and the backup-first discipline.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
