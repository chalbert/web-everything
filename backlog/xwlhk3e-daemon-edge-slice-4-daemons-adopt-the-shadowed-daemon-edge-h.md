---
kind: story
size: 5
parent: "x59tqsg"
status: open
blockedBy: ["xni0dwx", "xkyto3n"]
scope: ["we:scripts/lib/daemon-rebuild.mjs", "we:scripts/daemon-overlay.mjs", "we:scripts/lib/daemon-overlays.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# daemon-edge slice 4: daemons adopt the shadowed daemon-edge head instead of main plus overlays, and the overlay list migrates

Behind WE_DAEMON_EDGE: run the edge tick (slice 1) at each rebuild tick, and build the clone from the latest shadowed edge head (slice 3) instead of main plus overlays; keep the live smoke and fallback to last-good. Migrate each clone's overlay list into the edge ledger once, then daemon-overlay add routes to edge registration. Flip the flag default only after a soak.

## Done when

1. **Executable** — a rebuild test: with `WE_DAEMON_EDGE=1` the clone builds from the latest shadowed edge head
   (not main + overlays); a failed smoke falls back to last-good; an owed main-merge older than the max age falls
   back to main + last-good; with the flag off the rebuild is unchanged.
2. **Migration** — a one-shot command imports each clone's overlay list into the edge ledger (one `register` per
   overlay with a PR) and is idempotent.

## Scope

- Call the edge tick (slice 1) from the rebuild tick when the flag is on.
- Build source switch in `we:scripts/lib/daemon-rebuild.mjs`; keep the live smoke, ready-candidate adoption, last-good fallback.
- `daemon-overlay add` routes to edge registration only (today it does both when the flag is on).
- Flip the flag default only after a soak; retiring the overlay list code is a later card.
