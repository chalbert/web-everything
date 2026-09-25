---
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:scripts/conveyor/session-reaper.mjs", "we:scripts/conveyor/__tests__/session-reaper.test.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# Session-reaper chat-spawn ceiling is defeated by a future-dated recordedAtMs

PR #2678 merged with its review's CONFIRMED security finding unfixed: we:scripts/conveyor/session-reaper.mjs classifyChatSpawnGuard checks nowMs - link.recordedAtMs >= ceilingMs, so a link file whose recordedAt is in the future yields a negative elapsed time that never reaches the ceiling and restores permanent reap-immunity - the exact bug the ceiling exists to close, contradicting its own comment that the ceiling holds regardless of what a link file claims. Fix: treat recordedAtMs greater than nowMs plus a small clock-skew tolerance as invalid (expired, not blocked), in tryReadChatSpawnLink or the guard. Math.max(0, nowMs - recordedAtMs), the review's suggested prevention, does NOT fix it (elapsed stays 0 forever). Add a ceiling test with a future-dated recordedAt. Done when that test fails on main and passes after.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
