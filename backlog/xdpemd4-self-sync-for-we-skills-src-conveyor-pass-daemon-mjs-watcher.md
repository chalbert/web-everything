---
kind: story
size: 3
parent: "xii6vye"
status: resolved
scope: ["we:skills-src/conveyor/pass-daemon.mjs", "we:skills-src/conveyor/__tests__/pass-daemon.test.mjs", "we:scripts/lib/daemon-self-sync.mjs"]
dateOpened: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# Self-sync for we:skills-src/conveyor/pass-daemon.mjs watchers

we:skills-src/conveyor/pass-daemon.mjs-driven watchers (review/fix-dispatch etc.) never self-sync their clone today -- only the bespoke daemons wired to we:scripts/lib/daemon-self-sync.mjs do. Reuse withSelfSync (or an equivalent thin wrapper) between pass runs in we:skills-src/conveyor/pass-daemon.mjs, opt-in via the same env convention as the other daemons (unset = byte-identical default). On new commits the pass loop restarts instead of ticking, exactly like the existing self-sync contract. Unit tests alongside we:skills-src/conveyor/pass-daemon.mjs's existing pure-core suite.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
