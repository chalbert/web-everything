---
kind: task
status: active
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
tags: []
---

# check:readiness --select surfaces blockedBy-open items as batchable

The `--select` packer surfaced #2031 (`blockedBy: ["2017"]`, with #2017 **open**) as a Tier-A batchable item,
violating the documented "only blockedBy-resolved items appear" invariant the batch pre-flight relies on — a
batch would have claimed a genuinely-blocked item; it was caught only by a manual pre-flight cross-check of
every picked item's blockers. Resolved #2014 fixed *priority-low* inclusion but not *blockedBy-open* inclusion.
Fix: make `batch.picked` (and the batchable predicate) exclude any item with an unresolved `blockedBy` target,
and add a regression asserting a blockedBy-open item never appears in `batch.picked`.

## Evidence
- `npm run check:readiness -- --select --json` on 2026-07-01 returned #2031 in `batch.picked` although
  `we:backlog/2031-*.md` declares `blockedBy: ["2017"]` and `we:backlog/2017-*.md` is `status: open`.
- The batch pre-flight re-grepped every picked item's blockers and dropped #2031 as `blocked-in-fact` — the
  packer should have excluded it upstream so no session relies on the manual catch.

## Likely locus
The eligible/batchable derivation is duplicated (loader `we:src/_data/backlog.js` vs the readiness engine under
`we:scripts/`) — the two derive batchability independently, so the blockedBy gate is likely live in one path but
not the other (or skips `size ≥ 5` stories). Fix both derivations or unify them.

## Acceptance
- No item with an unresolved `blockedBy` target appears in `check:readiness --select` `batch.picked`.
- A regression test asserts it (a `blockedBy`-open story is excluded; the same item becomes eligible once the
  blocker resolves).

## Lineage
Surfaced 2026-07-01 during the `/workflow` parallel batch pre-flight (batch-2026-07-01) — #2031 packed despite
its open blocker #2017; dropped manually as `blocked-in-fact`.
