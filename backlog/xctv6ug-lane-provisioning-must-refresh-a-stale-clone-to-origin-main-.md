---
kind: story
size: 3
parent: "2289"
status: open
dateOpened: "2026-07-07"
tags: []
---

# Lane provisioning must refresh a stale clone to origin/main before scaffold/claim — a behind-main lane mints colliding/low-gap NNNs from a pre-#2288 allocator

Observed 2026-07-07: a pool lane handed out **19 commits behind origin/main** ran its *stale* `we:scripts/backlog.mjs` — the pre-#2288 "next free NNN" allocator — and minted **#119** (a low free-gap) and a **colliding #2259** for two new scaffolds; both were wrong and had to be discarded, and only a manual `git reset --hard origin/main` flipped the lane to the correct #2288 hash-birth (`x1olwvm`, `xgmxxkw`). Root cause: `we:scripts/lane-pool.mjs` can lease a clone whose checkout (and therefore whose `scripts/`) predates a landed change, so an item-mutation runs **old code** against a **stale backlog view**. Fix: provisioning must `fetch` + fast-forward/reset the leased clone to `origin/main` **before** any `scaffold`/`claim` (or the mutation must refuse on a behind-main HEAD and tell the caller to refresh). Distinct root cause from `x1olwvm` (a hash reaching main) and #2267 (don't hard-reset a *dirty* lane) — here the lane is clean but *behind*. A stale-lane guard also protects every other lane-run CLI, not just numbering. relatedTo #2288, #2267, #2275, #2289.
