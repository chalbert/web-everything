---
name: monolith-split-vs-partition-capacity
description: "To raise parallel-batch capacity, don't reflexively split a monolith per-entry — only true entry-COLLECTIONS split; for singular docs/matrices/sweeps the lever is a precise pairwise partition + optimistic merge, not splitting"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6c8e983e-0ad5-473f-81e6-2920c02b7005
---

When someone asks to **split a registry per-entry "for parallelism"** (the #1145/#1938 move), first
classify the file: is it an **entry-COLLECTION** (a map/array of N independent peer entries, like
blocks/plugs/adapters/intents) or a **single structured document**? Per-entry splitting only frees
parallelism for the former — and in this repo every real collection *already* split (it has a
`src/_data/<reg>/` dir). The files left on the merge-risk blacklist are exactly the non-collections:
a **concept/spec doc** (WE `traits.json` = mission/pillars/decision-record — NOT a list of traits; the
trait impls live in frontierui), a **matrix** (`capabilityMatrix.json` — relational, cells cross-ref),
**landing docs** (`docs/webhandlers/webportals.json` — one object each), and **curated-sweep docs**
(`benchmark*/workbench*.json` — a metadata wrapper + an inner array). None have peer entries to split.

**Why:** splitting a non-collection is impossible (no entries) or pointless (a wrapper-doc's metadata is
genuinely shared). The thing that actually caps concurrency is **how the partition treats a shared file**,
not the file's granularity. So the lever is a *precise pairwise partition*: serialize ONLY the contending
pair on a file where a conflict-FREE git merge can still be wrong (an ordered/relational registry), and let
the optimistic floor (rebase-retry → serial-replay → post-hoc `multiLaneFiles`) arbitrate everything else.
A wrong "these are independent" call then costs a replay, never correctness — so you can be aggressive about
running disjoint work concurrently without splitting anything. (#1949 A/B/C: the real batch collapse was an
over-conservative partition, not too-coarse files; fixing the predicate gave 4 concurrent lanes, splitting
nothing.)

**How to apply:** Challenge "split it for parallelism" on the **collection-vs-document** test. If it's a
document/matrix/sweep, say so and redirect to the partition predicate (`we:scripts/readiness/lane-partition.mjs`)
+ the per-repo merge-risk blacklist — keep that blacklist **minimal** (more entries = less parallelism; it is
only for clean-but-wrong-merge files). Build config and line-structured singletons are NOT merge-risk (#1952):
distinct-line edits merge clean and a real same-line clash is a git conflict the floor catches. Only file a
split (or a runtime cross-repo lock) when a **real batch is observed to collide** on the file — park the
speculative optimization until then. Relates to [[parallel-workflow-blocked-by-git-guard]] (whose "don't
pursue parallel" stance the #1933 clone model + #1949 partition work have since reopened — reconcile it).
