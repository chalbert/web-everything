---
bornAs: x53zzf9
kind: story
size: 5
parent: "2612"
status: open
dateOpened: "2026-07-22"
tags: [conveyor, readiness, script, scope-lease]
---

# Dispatch-plan script + scope frontmatter field

Build `we:scripts/readiness/dispatch-plan.mjs` — the deterministic dispatcher core of the conveyor (#2612): given the build queue, the active scope leases, and the free lane slots, it decides what launches where and what holds, as JSON. Plus the new optional `scope:` frontmatter field on backlog items (predicted path prefixes) that makes overlap decidable by script. Scripted per [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](docs/agent/platform-decisions.md#deterministic-core-thin-judgment); this same script is the future product conveyor's dispatcher.

## The script

`we:scripts/readiness/dispatch-plan.mjs`:

- **Input:** the build queue (`buildQueued` items with zero `openBlockers`, in rank order), the active scope leases (reuse [we:scripts/readiness/scope-lease-collect.mjs](scripts/readiness/scope-lease-collect.mjs)), and the free lane-slot count.
- **Output:** JSON `{launch: [{num, lane}], held: [{num, reason: "overlaps lane-N" | "no free lane" | "blocked" | "needs-probe"}]}`.
- **Vitest coverage** including: scope overlap with an active lease, a rival pair inside the same tick's launch set, the no-free-lane hold, and the needs-probe hold (an item with no `scope:` yet).

## The `scope:` frontmatter field

A new **optional** `scope:` field (array of path prefixes) on backlog items — the predicted touch-set that lets the dispatcher hold overlapping items apart:

- schema addition + a `check:standards` shape rule (array of strings when present);
- a doc note in [we:docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md);
- **predicted by a probe agent** (the /workflow touch-set probe — judgment work), **written back once, script-read forever** (the deterministic half).

## Future-proof by construction

This script is the future product conveyor's dispatcher too — plateau's server shells it exactly like its `/api/scope-lease` endpoint shells [we:scripts/readiness/scope-lease-collect.mjs](scripts/readiness/scope-lease-collect.mjs) today. One implementation, two shells (skill and UI), per the statute's one-source clause.
