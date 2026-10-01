---
kind: story
size: 1
status: open
scope: ["we:scripts/conveyor/health-watch-core.mjs", "we:scripts/conveyor/__tests__/health-watch-core.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Stuck-PR health episodes (draft-not-promoted, red-pr-unattended) notify even in shadow mode

Live case 2026-10-01: the health watch opened draft-not-promoted for PR #3336 at 3:25 PM ET and red-pr-unattended for #3336 and #3373, but the watch runs in shadow mode and these smells are not in NOTIFY_EVEN_IN_SHADOW (we:scripts/conveyor/health-watch-core.mjs), so nobody was told; the operator noticed the PRs were not moving hours later. Fix: add the stuck-PR smells (draft-not-promoted, red-pr-unattended, repeated-pr-attempts) to the notify-even-in-shadow set, with a test that each one notifies in shadow mode.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
