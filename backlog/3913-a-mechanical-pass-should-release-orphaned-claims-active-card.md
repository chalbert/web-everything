---
bornAs: xn4c4n0
kind: story
size: 3
parent: "3383"
status: open
dateOpened: "2026-09-22"
tags: []
---

# A mechanical pass should release orphaned claims — active cards with no lane lease, no open PR, no live session, older than 48 h

Claims go stale with nobody holding them (#3467, #3783: born active via --session and never settled or worked). check:health O1 only reports them. Add a deterministic pass beside we:scripts/conveyor/lease-reaper.mjs (which already knows the owner-gone signals) that settles/releases such a card to open. Reversible and script-decidable, so it acts rather than reports. Must NOT fire on a card whose work already merged (that is the drain-resolve fix, not a release).

## Done when

1. **Executable** — a pure-core unit test for the pass: an `active` card with no lease, no open PR, no live session and a claim/scaffold date over 48 h is planned for release to `open`; the same card with any one of those signals present, or with a merged delivery PR, is left alone.
2. **Wired** — the pass is registered in `we:skills-src/conveyor/daemon-manifest.mjs` so it runs on `we:skills-src/conveyor/pass-daemon.mjs`, not only inside the conveyor runner.
