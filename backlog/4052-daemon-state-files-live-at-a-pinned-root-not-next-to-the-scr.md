---
bornAs: xvxs2u3
kind: story
size: 3
parent: "3383"
status: active
scope: ["we:scripts/conveyor/queue-store.mjs", "we:scripts/conveyor/run-scorecard-store.mjs", "we:scripts/review-set-label.mjs", "we:skills-src/conveyor/launchd/"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-25"
tags: []
---

# Daemon state files live at a pinned root, not next to the script

Ruling #3681 Fork 4 condition (iii), we:docs/agent/platform-decisions.md#resident-daemon-reload-lifecycle clause 3; see also #state-lives-where-its-nature-dictates. State a daemon finds by script location moves to a root given by env or flag: the .conveyor/ queue (we:scripts/conveyor/queue-store.mjs) and the tracked scorecard file (SCORECARD_STORE_PATH in we:scripts/conveyor/run-scorecard-store.mjs, committed locally by we:scripts/review-set-label.mjs). Without this a rebuilt clone can wipe or fork state, and the staged dispatcher plist would read the daemon clone's queue instead of the operator's. The dispatcher plist is not installed until this lands. The per-clone overlay list lives under the same root.

## Done when

1. **Executable** — `npm run test:unit -- we:scripts/conveyor/__tests__/queue-store.test.mjs we:scripts/conveyor/__tests__/run-scorecard-store.test.mjs && npm run test:unit -- we:scripts/__tests__/review-set-label.test.mjs` — fails before this item lands (`pinnedStateRoot`/`resolveScorecardStorePath` don't exist yet, and `publishDelegationTrialCommit` has no `CONVEYOR_STATE_ROOT` skip), passes after. Live proof beyond the unit suite: from a throwaway clone, running `we:scripts/conveyor/queue.mjs add 1` with `CONVEYOR_STATE_ROOT` set to a pinned root writes that root's queue file (under its own `.conveyor` subdir), never the clone's own, and the same env pins `we:scripts/conveyor/run-scorecard-store.mjs`'s store under that same pinned root instead of next to the script (see PR for the before/after transcript).
