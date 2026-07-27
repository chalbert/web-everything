---
bornAs: xhptp3x
kind: story
size: 5
parent: "2606"
status: resolved
dateOpened: "2026-07-26"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
relatedTo: ["2678", "2619", "2560", "2592", "2594"]
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

Finer leases only pay off if the files are small. The six god-files named in the small-files decision (#2678) — `we:scripts/merge-ai-prs.mjs` (2242), `we:scripts/check-standards-rules.mjs` (2194), `we:scripts/check-standards.mjs` (1675), `we:scripts/lib/review-core.mjs` (1252), `we:scripts/backlog.mjs` (1058), `we:scripts/lane-pool.mjs` (1001) — are the first split targets that make file-level leases effective: a file-level lease on a 2000-line file everyone edits still serializes everyone. This story pairs with #2678 (split the god-files) and with upstream scope authoring #2619 (predict the narrow `scope:` at readiness).

## Progress

- **File-granularity lease matchers (done).** `we:scripts/readiness/scope-lease.mjs` now classifies each scope
  entry by granularity (`isSubtreeEntry`): a SUBTREE (glob, or a trailing-slash / bare directory) leases the
  whole tree, a FILE (an extension-bearing path) leases only that one path. `coversFile` and
  `scopeEntriesOverlap` are granularity-aware: two DISJOINT files sharing a directory no longer contend
  (the #2673 / console-board false positive), while a glob/directory declaration — and a genuine same-file
  dependency like #2440↔#2669 — still serializes. The classifier is conservative (a directory-ancestor
  fallback) so finer granularity never MISSES a real overlap; it can only err toward over-serializing. This
  also fixes a latent breach over-match where a file entry wrongly "covered" a synthetic subtree beneath it.
- **Advisory, not a new lock.** This refines the resolution of the SAME §3i-A4 Fork 1 advisory signal — the
  whole-clone lease stays the only real lock; per-file *locks* remain rejected.
- **Collector (done).** `we:scripts/readiness/scope-lease-collect.mjs` passes each lane's declared scope through
  at its authored granularity, so narrow file scopes flow into breach/overlap at file granularity end-to-end
  (proven by new collector tests through the real observer).
- **Tests (done).** Extended `we:scripts/readiness/__tests__/scope-lease.test.mjs` (classifier +
  file-granularity overlap/coverage/breach, the named #2673 / #2440↔#2669 cases, the safety fallback) and
  `we:scripts/readiness/__tests__/scope-lease-collect.test.mjs` (file-granular declared scopes don't
  false-serialize; broad declarations still do).
- **Deferred (out of scope):** narrower scope AUTHORING in the readiness flow is #2619 (the upstream half);
  splitting the god-files that make finer leases pay off is #2678.

## Relationships

- **Parent #2606** — the delivery-throughput program (north star: maximize safe parallelism); this is a parallelism lever within it.
- **#2560 / #2592 / #2594** — the scope-lease engine (resolved data-model slice #2592 and observer slice #2594); this extends that engine to file granularity, it does not replace it.
- **#2619** — author predicted scope in the readiness flow; narrower prediction there is the upstream half of this story.
- **#2678** — the small-files decision; its god-file splits are what make finer leases actually parallelize.
