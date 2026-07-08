---
kind: story
size: 3
parent: "2289"
status: resolved
blockedBy: ["2288"]
dateOpened: "2026-07-07"
dateStarted: "2026-07-08"
dateResolved: "2026-07-08"
graduatedTo: none
tags: []
---

# Number the stranded hash id(s) already on main + add a hash-on-main invariant gate (a lone un-numbered id, not just a duplicate)

Under JIT numbering (#2288) a new item is born with a hash id and the drain mints its real NNN **at land** (we:scripts/lane-drain.mjs `numberPendingHashes`). But `we:backlog/2322-*.md` is currently on origin/main **still hashed** — a land route bypassed numbering (per 2322's own note, the `we:scripts/pr-land.mjs --fallback-git` local-merge degrade never numbers). Two parts. **(1) Fix the bad id:** a one-shot sweep that numbers every hash-id file already on main (re-run `numberPendingHashes` over the landed tree, or a `we:scripts/backlog.mjs number-stranded` verb), rewriting inbound `blockedBy`/`parent`/short-refs — so `2322` and any sibling get real NNNs. **(2) Stop it recurring:** add a deterministic **hash-on-main invariant gate** — check:standards errors (and the drain post-land asserts) if any `we:backlog/NNN-*.md` on main has a non-numeric leading id, naming the file. This is DISTINCT from the duplicate-NNN detectors (#2318/#2291/#2248): a *lone unique* hash is not a collision, so those miss it entirely. Complements 2322 (which closes the one known bypass route) by asserting the invariant regardless of *which* route strands a hash. relatedTo #2288, #2289, #2318, #2291, #2314.
