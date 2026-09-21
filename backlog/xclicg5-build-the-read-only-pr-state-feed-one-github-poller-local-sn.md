---
kind: story
size: 5
status: open
scope: ["we:scripts/conveyor/pr-state-feed.mjs", "we:scripts/lib/pr-state-snapshot.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Build the read-only PR state feed (one GitHub poller, local snapshot file)

Ratified in #3699 Fork 1(b): one standalone read-only feed process polls open PRs once per watched repo (a 4-point list) on its own loop and writes an atomic snapshot file (temp file then rename) stamped with its fetch time, so watchers read a local file instead of each polling GitHub. It owns no merge logic, no drain lease and no pause gate. When a watched PR drops off the open list it makes one per-PR view to classify it merged or closed. Default start model is a lazy singleton under a lock, started by the first consumer that finds the snapshot missing or stale and exiting when idle. Ships with a reader helper (we:scripts/lib/pr-state-snapshot.mjs) that returns the snapshot plus its age, so a consumer can apply the fallback rule: older than two poll intervals or missing means poll for itself, with random jitter. Idle backoff toward 60s when nothing changes.

## Done when

1. **Executable** — `npx vitest run` on we:scripts/conveyor/__tests__/pr-state-feed.test.mjs and we:scripts/lib/__tests__/pr-state-snapshot.test.mjs fails before this item lands (the files do not exist) and passes after. The tests cover, against a stubbed `gh`: one list call per watched repo per poll (not one per PR); the snapshot is written atomically and carries its fetch time; a PR that drops off the open list triggers one per-PR view and is recorded as merged or closed; the reader reports a snapshot older than two poll intervals, or a missing one, as stale; two consumers starting at once yield exactly one running feed (the lock); the feed exits after its idle period.
2. **Observable** — with the feed running and 3 PRs watched, the call-volume log that #3670 adds to we:scripts/lib/gh-throttle.mjs shows one list call per poll for those PRs, not one call each.
