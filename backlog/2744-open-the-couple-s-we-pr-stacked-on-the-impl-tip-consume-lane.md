---
bornAs: xsk6c44
kind: story
size: 3
parent: "2612"
status: open
blockedBy: ["2684"]
dateOpened: "2026-07-27"
tags: []
---

# Open the couple's WE PR stacked on the impl tip (consume lane-stack couple-open in pr-land)

Wire the couple opener (we:scripts/pr-land.mjs) to shell the lane-stack couple-open command (#2684) so the WE PR opens STACKED on the impl lane's pinned tip sha, not off origin/main. That is what makes the FF-skip guard (decideWeReCi, already consumed by the drain in #2684) actually fire: with the WE half stacked, a clean impl fast-forward leaves it already on main so the drain skips the re-CI. pr-land was out of #2684's file-scope. Scope: we:scripts/pr-land.mjs plus its test. Acceptance: a cross-locus couple opens its WE PR based on the impl tip; on a clean impl land the WE half needs no rebuild or re-CI; on squash/bounce it falls back to rebase (the guard already enforces this drain-side).
