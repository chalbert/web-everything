---
bornAs: xwjs942
kind: story
size: 3
parent: "2445"
status: resolved
dateOpened: "2026-07-14"
dateResolved: "2026-07-14"
graduatedTo: none
tags: [plateau-loop, drain-daemon, infra]
---

# Drain daemon — bounded journal reads + size-capped history.jsonl rotation (weeks-long residency)

Bounds the drain daemon's journal cost so the loop can run itself for weeks — the premise #2456's evidence
gate requires — answering the #2489 slice-E2 safety-review finding that the daemon's `history.jsonl` journal
grew UNBOUNDED and that `status` / `evidence` read the whole file every pass. Three parts, all in
`plateau:tools/drain-daemon/lib.mjs`: (1) `readHistoryTail` / `readIncidentsTail` now read only the last 64KB
of the journal (stat / open / read / close) via a pure `tailRows` helper instead of the whole file;
(2) `appendHistory` rotates the journal to a `.1` archive once it passes ~2MB (`shouldRotateHistory`, ~9 days
at 60s/pass) and keeps one archive generation, so journal disk stays bounded at ~4MB — the whole append body
is wrapped so a write / rotate / disk-full failure can never break the drain loop; (3) `readFullHistory`
stitches the archive ahead of the live file so `evidence` and the health tail survive one rotation, while the
`lifetime` counters in state stay authoritative. Impl lives in plateau-app (this card is the tracker; WE
holds zero impl) — landed as plateau-app PR #40 (merged 2026-07-14), reviewed by a fresh-context correctness
+ safety panel (both PASS, the two should-fixes — health-tail stitch + wrapped append — folded in), with new
unit tests and the suite green (894); the daemon was restarted (starts=5) so the resident loop runs the
rotation code. Live.
