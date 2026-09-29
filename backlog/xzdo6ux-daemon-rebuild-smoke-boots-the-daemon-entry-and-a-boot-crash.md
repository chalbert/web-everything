---
kind: story
size: 3
tier: pinned
status: open
scope: ["we:scripts/lib/daemon-rebuild.mjs", "we:scripts/lib/daemon-last-good.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Daemon rebuild smoke boots the daemon entry, and a boot crash rolls back to last-good by itself

Live 2026-09-29 ~10:45 AM ET: overlay PR #2921 introduced an ESM circular-import TDZ (ReferenceError: Cannot access 'DELIVER_ITEM_RUN_SCRIPT' before initialization in we:scripts/operations/dispatch-provider-registry.mjs). The rebuild's live smoke passed and adopted the tree, then the build daemon crash-looped at startup: the rollback logic lives inside the daemon process that can no longer start, so it could never roll itself back. The builder was down until the operator removed the overlay and ran we:scripts/lib/daemon-load-overlay.mjs by hand (labelled emergency). MVP: (1) the rebuild smoke (we:scripts/lib/daemon-rebuild.mjs live-smoke set) imports/boots each daemon's actual entry module in a child process on the candidate tree and rejects the candidate on a boot error; (2) a supervisor-side guard: when a daemon exits within N seconds of start K times in a row after a rebuild, revert the clone to daemon-last-good (we:scripts/lib/daemon-last-good.mjs) before the next start, without the daemon's own code. Must: tests; soak break reproducing today's boot crash, RED before / GREEN after; live proof via a deliberately broken overlay on a scratch clone.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
