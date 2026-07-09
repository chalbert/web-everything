---
kind: decision
parent: "2275"
status: resolved
dateOpened: "2026-07-08"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: none
codifiedIn: one-off
tags: []
---

# Should lane-pool --force silently eat a live-leased lane's untracked work? (gate the forced path for a live lease)

The residual policy fork surfaced by #2329's verification. That task PROVED the #2267 un-forced dirty-or-ahead
guard genuinely protects untracked-only work, and that `acquire` leaves a live lease a non-forced `refresh`
honors. The one remaining data-loss path is `we:scripts/lane-pool.mjs`'s `--force`: it overrides BOTH the
#2275 lease skip AND the dirty/ahead skip, so a concurrent `refresh --force` / `provision --force` (or a
`--force` acquire of the same lane) silently discards a **live-leased** lane's untracked, never-pushed work.
Decide whether that is intended, or whether the porcelain/lease skip should also gate the forced path when the
lane carries a **live lease** (a distinct, deliberate hold), while still letting `--force` recycle a free-but-
dirty lane. Characterized by the "--force DOES eat a leased lane's untracked work" test in
`we:scripts/__tests__/lane-pool-refresh-guard.test.mjs`.

## Forks

- **(a) Keep `--force` fully unconditional (status quo).** `--force` means "reset no matter what". Simple, one
  meaning; operator/drain must never `--force` a lane someone holds. Loss stays possible on misuse.
- **(b) `--force` still overrides dirty/ahead, but NOT a LIVE lease (bold default).** A live lease is an
  explicit "someone is using this" hold; `--force` should override the *staleness* protections, not stomp an
  active consumer. Refuse (or require a second `--force-lease`) when a live lease is present; a free-but-dirty
  lane still resets. Closes the observed loss with the least surprise.
- **(c) Never silently discard untracked work on any path.** Even `--force` stashes/aborts on untracked files.
  Safest, but changes `--force`'s contract broadly and complicates legitimate recycles.

Recommended: **(b)** — it targets exactly the observed failure (a forced recycle stomping a live-leased
consumer) without weakening `--force`'s recycle role for genuinely free lanes.

## Ruling (2026-07-09) — (b)

`--force` overrides the **staleness** protections (dirty/ahead) but must **not** silently stomp a **live
lease**. Rationale: dirty/ahead is a property of the *tree* — possibly abandoned residue from a dead
session, which is exactly what `--force` exists to recycle. A live lease is a property of *ownership* — a
process stamped it within TTL and is presumed alive; it is the exclusive-hold primitive the whole
concurrency model is built on. Blowing past that primitive via a flag meant to clear *residue* is the bug
(the 2026-07-07 loss). (a) leaves a silent data-loss path open on a routine command; (c) over-corrects and
neuters `--force`'s legitimate free-but-dirty recycle role.

**Contract (the spec the follow-up build implements):**

1. **Cover all three forced entry points consistently**, not just `refresh`/`provision`. `acquire --lane=N
   --force` also reclaims another session's live lease (`we:scripts/lane-pool.mjs:462`) then resets —
   fixing only refresh/provision leaves the hole open via acquire.
2. **Batch ops skip-loud; targeted ops hard-fail.** `refresh --force` / `provision --force` sweep all lanes
   → a live-leased lane is **skipped with a loud log** (mirroring the un-forced skip), never stomped; a
   free-but-dirty lane still force-recycles as today. `acquire --lane=N --force` on a live-leased lane →
   **hard-fail** with a message pointing at the deliberate override.
3. **No new flag.** The deliberate dead-owner-but-TTL-not-expired override reuses the *existing*
   `release --force` (drop the lease, then re-run) — no `--force-lease` surface area added.

Blast radius is low: no script in the repo passes `--force` to lane-pool — it is an operator-only escape
hatch, so no automated flow regresses. Implementation tracked as a follow-up build item.
