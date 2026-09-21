---
bornAs: xdf9fw9
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/verify-lane.mjs", "we:scripts/lib/__tests__/container-exec.test.mjs", "we:scripts/lib/__tests__/gh-throttle.fidelity.test.mjs", "we:scripts/__tests__/review-set-label.gh-throttle-fidelity.test.mjs", "we:scripts/operations/__tests__/stale-state-io.test.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# verify-lane: a terminal red record blocks any second verify in the checkout, and environment-only test failures turn docs-only changes red

FOUND 2026-09-20. (1) After a red run for one commit, verify-lane refuses to start for a new commit in the same checkout (superseded: the on-disk marker holds a terminal red record for the earlier sha and overwriting it would destroy that result), with no documented recovery, so a throwaway clone was needed for every re-verify. (2) Environment-only tests fail on this machine and make markdown-only changes red: the container-exec test pulls an image from a registry (401 unauthorized), two gh-throttle fidelity tests call the real gh binary in a clone whose remote is a local path, and stale-state-io reads real lease files (not root-caused). The finish-guard then refuses to land until green. DESIGN TO SETTLE: whether a new sha may supersede a terminal record (archive the old one), and whether tests with an unmet precondition skip with a stated reason instead of failing, keeping a hard fail for a real regression. ACCEPTANCE: a second verify for a new sha starts and keeps the old record; each environment-dependent test skips with a reason when its precondition is absent and runs when present; a docs-only change is green on a clean machine.

ADDED 2026-09-20 (container-exec half root-caused and fixed). The two `we:scripts/lib/__tests__/container-exec.test.mjs` failures were the `REAL test:unit node_modules-volume integration` block: its skip guard probed the `container` CLI and the `we-test-unit-node-modules` volume only, but its tests also run `container run ... we-heavy-admission:poc`, a LOCAL image built on the machine, never pulled. With the volume present and the image absent, `container run` tried to pull the bare name from `registry-1.docker.io` and got a 401. No registry login is involved. Fix: one probed decision, `realContainerProofPlan` in `we:scripts/lib/container-exec.mjs`, requires the image for every real block and the volume only for the block that mounts it; a missing prerequisite now skips. The other environment-only failures named above (gh-throttle fidelity, stale-state-io) and the terminal-record supersede question are untouched.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
