---
bornAs: xn4c4n0
kind: story
size: 3
parent: "3383"
status: resolved
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
graduatedTo: none
tags: []
---

# A mechanical pass should release orphaned claims — active cards with no lane lease, no open PR, no live session, older than 48 h

Claims go stale with nobody holding them (#3467, #3783: born active via --session and never settled or worked). check:health O1 only reports them. Add a deterministic pass beside we:scripts/conveyor/lease-reaper.mjs (which already knows the owner-gone signals) that settles/releases such a card to open. Reversible and script-decidable, so it acts rather than reports. Must NOT fire on a card whose work already merged (that is the drain-resolve fix, not a release).

## Done when

1. **Executable** — a pure-core unit test for the pass: an `active` card with no lease, no open PR, no live session and a claim/scaffold date over 48 h is planned for release to `open`; the same card with any one of those signals present, or with a merged delivery PR, is left alone.
2. **Wired** — the pass is registered in `we:skills-src/conveyor/daemon-manifest.mjs` so it runs on `we:skills-src/conveyor/pass-daemon.mjs`, not only inside the conveyor runner.

## Delivered

- `we:scripts/conveyor/orphan-claim-release.mjs` — pure core (`classifyOrphan` / `planOrphanRelease`) + IO shell. Default is a report; `--apply` acquires a lane, runs `we:scripts/backlog.mjs settle` (born-active) or `we:scripts/backlog.mjs release` (claimed) per card, commits, verifies the lane, opens ONE parked PR through the `open-pr` operation, then releases the lane. A run that sees its own previous PR still open writes nothing. Fail-closed: any unavailable signal source skips every card.
- Skips: epics, a lease in any pool naming the card, an open PR, a live `claude agents` session, age ≤ 48 h (dateStarted → dateScaffolded → dateOpened; unknown ⇒ skip), a merged delivery PR (matched by `prDeliveredItem` — the #3914 case), and cards older than the merged-PR window when that window is full.
- Registered as `orphan-claim-release` in `we:skills-src/conveyor/daemon-manifest.mjs` (`--apply`, every 6 h). Proof: `we:scripts/conveyor/__tests__/orphan-claim-release.test.mjs`.
- First live run (inside this item's own lane, `--apply --checkout`): released #2415, #2834, #3178, #3182; skipped 21 merged-delivery (the #3914 stranded set), 4 epics, 1 live session, 1 live lease, 2 too young. NOT yet exercised live: the full `--apply` lane → commit → verify → PR path (a second PR from inside this delivery would duplicate these edits) and the `settle` branch (no born-active orphan existed). Both are unit-covered only; the first daemon run is the live test.
