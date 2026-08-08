---
description: Cluster already-filed backlog items that are really one job into logical work sets — an umbrella epic or a batch pack (routes to the consolidate-backlog-items skill)
---

Invoke the `consolidate-backlog-items` skill to sweep the **open** backlog, cluster items that are really
**one job**, and group each surviving cluster into a logical set — **only when it's provably one job and the
grouping doesn't cost batchability**. The inverse of `/split`, with the conservative instinct pointing the
other way: a needless consolidation buries independently-deliverable work under an umbrella nobody can
batch, so when the cluster isn't obvious, leave the items apart.

Build candidate clusters from the machine signals first (overlapping `scope:` touch-sets, shared
`parent`/`relatedProject`/`tags`, title+digest term overlap, same-sweep provenance), then **investigate the
code** — sameness must be `file:line`-citable (the same function/registry/fixture, not merely the same
subsystem). Apply the consolidation-safety rubric (one job not one topic · no decision merged away · every
member stays independently claimable · no size laundering · nothing loses its home or its CTA). Pick the
outcome per cluster: **umbrella** (one epic, members re-parented) · **pack** (`blockedBy` edges + a named
pack for `/batch`, no epic) · **fold** (a true near-duplicate — **report only, no mutation**, pending the
folded-duplicate retirement decision).

Always write the report `reports/<date>-backlog-consolidation-analysis.md` listing **could consolidate**
(members, outcome, what changes on each) and **left apart** (which rubric condition failed + the action that
would unblock a future grouping) — even when nothing groups. Present the clusters and get **one "go"** before
mutating the backlog; never auto-group. On approval, scaffold the umbrella epic (`node scripts/backlog.mjs
scaffold --kind=epic --title="…" --digest="…"`, no `--size`, no `--scope`), set `parent:` on each member, lay
the pack's `blockedBy` edges, and gate on `npm run check:standards`. A consolidation never renumbers,
deletes, or `resolve`s a member.

A bare `/consolidate` sweeps the whole board and reports. A `NNN` or `NNN-slug` clusters around one item.

$ARGUMENTS
