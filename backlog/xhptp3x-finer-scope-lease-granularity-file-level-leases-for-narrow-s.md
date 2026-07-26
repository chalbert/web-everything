---
kind: story
size: 5
parent: "2606"
status: open
dateOpened: "2026-07-26"
relatedTo: ["xgb22vy", "2619", "2560", "2592", "2594"]
scope:
  - we:scripts/readiness/scope-lease.mjs
  - we:scripts/readiness/scope-lease-collect.mjs
tags: [scope-lease, granularity, throughput, parallelism, lane]
---

# Finer scope-lease granularity: file-level leases for narrow scopes

The scope-lease is coarse and prefix-based today, so a broad declared scope serializes ALL work touching that directory even when there is zero real file overlap. Make narrow scopes lease at **file** granularity (not prefix), and improve scope prediction to be as narrow as correctness allows. This is a direct parallelism lever under the throughput program (#2606): more lanes run at once when their leases stop colliding on a shared prefix they don't actually both write.

## The problem — prefix leases over-serialize

A declared scope like `we:scripts`, `we:scripts/lib/`, or `plateau-app:src/backlog-view/` is a **prefix**: it holds the whole subtree, so two items that touch different files under it are held apart at launch as if they conflicted. Observed this session (2026-07-26):

- **#2673** declared the broad prefix `we:scripts` for work that only touches one guard-hook file (`we:scripts/guard-backward-edge.mjs`). Its advisory launch lease therefore collides with any other lane working elsewhere under `we:scripts` — e.g. the `we:scripts/lib/` cluster around **#2440** — despite zero real file overlap. That is the false positive this story targets. (A genuine same-file dependency like **#2440 ↔ #2669**, both editing `we:scripts/lib/pr-merge-gate.mjs`, is a real conflict — #2669 is correctly `blockedBy` #2440 — and would still serialize under file-level leases, which is right.)
- The **console-board cluster** all declared `plateau-app:src/backlog-view/` and serialized on that one prefix.

## What to build

- **File-granularity leases for narrow scopes.** When a scope names specific files (not a whole subtree), lease at file granularity so two lanes touching disjoint files under a shared directory run in parallel. Extend the existing lease shape in `we:scripts/readiness/scope-lease.mjs` (`breachOf` / `overlapAtLaunch`) and the collector `we:scripts/readiness/scope-lease-collect.mjs` — do NOT reinvent leasing (the §3i-A4 whole-clone lease stays the real lock; this layer stays advisory).
- **Narrower scope prediction.** Improve the touch-set prediction so authored `scope:` is as narrow as correctness allows — file-level where the work is file-level, prefix only where the work genuinely spans a subtree.

## Why the god-files matter first

Finer leases only pay off if the files are small. The six god-files named in the small-files decision (#xgb22vy) — `we:scripts/merge-ai-prs.mjs` (2242), `we:scripts/check-standards-rules.mjs` (2194), `we:scripts/check-standards.mjs` (1675), `we:scripts/lib/review-core.mjs` (1252), `we:scripts/backlog.mjs` (1058), `we:scripts/lane-pool.mjs` (1001) — are the first split targets that make file-level leases effective: a file-level lease on a 2000-line file everyone edits still serializes everyone. This story pairs with #xgb22vy (split the god-files) and with upstream scope authoring #2619 (predict the narrow `scope:` at readiness).

## Relationships

- **Parent #2606** — the delivery-throughput program (north star: maximize safe parallelism); this is a parallelism lever within it.
- **#2560 / #2592 / #2594** — the scope-lease engine (resolved data-model slice #2592 and observer slice #2594); this extends that engine to file granularity, it does not replace it.
- **#2619** — author predicted scope in the readiness flow; narrower prediction there is the upstream half of this story.
- **#xgb22vy** — the small-files decision; its god-file splits are what make finer leases actually parallelize.
