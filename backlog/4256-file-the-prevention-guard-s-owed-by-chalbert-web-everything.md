---
bornAs: xndsozk
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/main-red-recovery.mjs", "we:scripts/conveyor/ci-red-recovery-watch.mjs", "we:scripts/conveyor/__tests__/main-red-recovery.test.mjs", "we:scripts/conveyor/__tests__/ci-red-recovery-watch.test.mjs"]
dateOpened: "2026-09-26"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2740's independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#2740's review to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:scripts/conveyor/main-red-recovery.mjs:850` — Add a test that simulates two consecutive daemon ticks (now advancing by DEFAULT_INTERVAL_MS) against the same head sha with incrementing triggerAttemptsForSha and assert the second attempt is refused as too-soon-since-last-attempt; gate the missing-run cap on a real inter-attempt cooldown (e.g. derived from the most recent trusted marker comment's timestamp) rather than attempt count alone.
2. `we:scripts/conveyor/ci-red-recovery-watch.mjs` — A deterministic gate: require sweepMissingRunRecovery (and any future automated `gh workflow run`/workflow_dispatch caller) to only dispatch CI for a PR that already carries the repo's `review:accepted` label (or an equivalent explicit certification), enforced as a single shared helper (e.g. `assertPrIsReviewAccepted`) that this pass and any future one must call — ideally backed by a check:standards rule that flags a new raw `gh workflow run`/`workflow_dispatch` call added outside that helper.
3. `we:scripts/conveyor/ci-red-recovery-watch.mjs` — Add a deterministic fault-injection test across repeated sweeps with both trigger and marker-write failures, requiring bounded attempts and continued processing of other candidates; persist an attempt reservation before triggering or provide durable fallback accounting.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
