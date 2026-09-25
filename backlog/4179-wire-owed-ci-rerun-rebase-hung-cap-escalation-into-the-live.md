---
bornAs: xv3iegl
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/main-red-recovery.mjs", "we:scripts/conveyor/ci-red-recovery-watch.mjs", "we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# wire owed-ci-rerun rebase + hung-cap escalation into the live fix-dispatch daemon

LIVE 2026-09-25 ~18:52 ET: PR #2685 logged owed-ci-rerun every tick with nothing performing the mechanical rebase (we:scripts/conveyor/ci-red-recovery-watch.mjs#sweepCiRedRecovery existed but had no live caller — its we:skills-src/conveyor/daemon-manifest.mjs entry has no launchd job installed). PR #2636's hung-run cap-exhausted branch only refused and waited on GitHub's job timeout-minutes, which its own stale branch never had set, so it logged nothing-owed forever. Wire sweepCiRedRecovery (apply:true) and escalate hung-cap-exhausted into a cancel-only ci-heal handoff, both inside we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs (the one daemon already confirmed live), mirroring how the hung-CI pass already rides it. Add a durable per-head-sha rebase-attempt cap in we:scripts/conveyor/main-red-recovery.mjs so a repeatedly-failing non-conflict rebase falls through to ci-heal via we:scripts/conveyor/reconcile-core.mjs instead of refusing forever. Also resolve the correct sibling checkout root for frontierui/plateau-app in we:scripts/conveyor/ci-red-recovery-watch.mjs.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
