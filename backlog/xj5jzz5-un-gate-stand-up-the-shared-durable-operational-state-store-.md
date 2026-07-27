---
kind: story
size: 5
parent: "2527"
status: open
blockedBy: ["2703"]
scope: ["we:scripts/conveyor/"]
dateOpened: "2026-07-27"
tags: []
---

# Un-gate: stand up the shared durable operational-state store (DO/D1) when the product's session-free runner needs cross-session state

The tracked un-gate trigger for decision #2626. FIRES when the first session-free product surface — the #2527 console build endpoint or the #2703 retirement of the main-session loop — must read/write conveyor operational state with NO main session present, so a machine-local sidecar written by one process can no longer be read by the UI or another actor.

On fire: stand up the shared durable store behind the existing store seam (the [`we:scripts/conveyor/queue-store.mjs`](../scripts/conveyor/queue-store.mjs) precedent — a DO swap touches only the io-shell, never the pure core) and migrate ONLY the shared-truth artifacts #2626 classifies as such (the cleared-for-build queue #2613, the jury ledger #2641, infra-blocked #2659) — Durable Objects for single-writer lease/lane-arbitration, D1 for the queryable queue/history.

**Runner-lease split (Fork 1(b) of #2626).** The runner lease [`we:skills-src/conveyor/runner-lock.mjs`](../skills-src/conveyor/runner-lock.mjs) (#2702) is NOT a blind stay-local: split it. Its machine-local process singleton ("two runners on my laptop") stays a local lock forever; its cross-actor single-writer arbitration ("who may write the shared operational state") becomes a DO lease **iff and when** the product runs runners on more than one host. Single-host product keeps it fully local.

The other machine-local artifacts (advisory `we:.conveyor/*.lock`, `we:.claude/lane-ports.json`, the learnings drop-box) STAY local by nature and are out of scope. blockedBy #2703 so this cannot start until the session-free runner exists — until then the trigger has not fired and sidecars keep running. Ratifying #2626 makes this the tracked mechanism that un-defers the store build; nobody has to remember to look — the `blockedBy` edge is the tripwire.
