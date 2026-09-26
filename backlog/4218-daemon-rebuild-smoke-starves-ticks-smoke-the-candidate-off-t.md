---
bornAs: xa4qo7n
kind: story
size: 5
parent: "4075"
status: open
scope: ["we:scripts/lib/daemon-live-smoke.mjs", "we:scripts/lib/daemon-rebuild.mjs", "we:scripts/lib/daemon-self-sync.mjs", "we:scripts/lib/daemon-clone-lock.mjs"]
dateOpened: "2026-09-26"
tags: []
---

# Daemon rebuild smoke starves ticks — smoke the candidate off the writer lock

Live 2026-09-26 09:32 ET (wev-review-daemon smoke-slow ms:64720, reconcile-dry-run 17234ms + dispatch-dry-run 44701ms from #2691): we:scripts/lib/daemon-rebuild.mjs#doRebuild runs the whole live smoke (Step 6, we:scripts/lib/daemon-live-smoke.mjs) inside withWriteLock, AFTER Step 5's reset --hard has already moved the clone onto the candidate code. Every daemon sharing the clone calls acquireRead during that window and is refused writer-active, ticking 0 dispatches — same class as the 209s smoke #2625 fixed, but #2625 only shortened the smoke, it never moved it off the lock. Fix: materialize plan.finalSha into a disposable git worktree off root's object db, run the full smoke there (no lock held), and take the writer lock only for the final fast reset --hard + state write once the smoke has already passed — root's tree, and every reader on it, never sees unverified code and is never starved by a slow smoke.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
