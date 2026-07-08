---
kind: decision
parent: "2275"
status: open
dateOpened: "2026-07-08"
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
