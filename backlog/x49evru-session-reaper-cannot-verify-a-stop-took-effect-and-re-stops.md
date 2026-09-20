---
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/conveyor/session-reaper.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Session reaper cannot verify a stop took effect and re-stops about 570 finished sessions per run

FOUND 2026-09-20. The reaper reports stopped for dead-process sessions but 28 old sessions (13 to 19 days) still list as working with no pid after the call; claude stop reports success while the listing lags (upstream issues named in the reaper header). It also re-stops every already-terminal session on each run (571 stopped of 704 listed), so the stopped count is meaningless and the run is slow (one call per session). FIX: after a stop, re-read the registry once per pass and report confirmed, unconfirmed and already-terminal separately; never re-stop a done or stopped session; keep unconfirmed ones on a bounded retry list and surface them as one line. DEPENDS ON the file split in flight (the reaper-split brief) because it lands in the stop module. DESIGN TO SETTLE: what confirmation means when the listing lags (time bound), and whether a stop that stays unconfirmed needs an operator-visible record. ACCEPTANCE: a fixture with a lagging listing reports unconfirmed, not stopped; a run over 700 sessions makes stop calls only for live ones; the summary line separates the three counts.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
