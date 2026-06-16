---
type: issue
workItem: story
size: 8
status: open
locus: frontierui
parent: "170"
blockedBy: ["649", "730"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-16"
relatedReport: reports/2026-06-14-plugs-runtime-audit.md
tags: [plugs, dedup, migration, frontierui, webguards, webvalidation]
---

# Port WE-only plug domains (webguards, webvalidation) + their subsystems into Frontier UI

The #649 reconciliation decided the two WE-only plug domains (`webguards`, `webvalidation`) are NOT WE-only by design: per #606 (plugs = implementation owned by Frontier UI) they are plug implementations that must port DOWN to FUI. The port is larger than the #635 audit implied — each drags in a whole sibling subsystem absent from FUI (`guard/`, `validity-merge/`, `validator-resolution/`: ~1900 LOC, 18 non-test files, 3 new FUI top-level dirs) plus bootstrap wiring. This item ports them and verifies FUI build + vitest green. Gates #449 — deleting WE's `plugs/` before this lands would lose both domains.

## Blocked on a placement fork (#730) + resized — found mid-work (2026-06-15, batch-2026-06-15)

Claimed in a batch; traced the real import closure before copying anything. The #635 audit's
*"~1900 LOC, 18 files, 3 new FUI dirs (`guard/`/`validity-merge/`/`validator-resolution/`)"* is about
**half** the graph. `webguards`/`webvalidation` also hard-depend on **two large subsystems FUI lacks and
the audit never named**: `capability-manifest/` (907 LOC — the #266 capability *spec*; imported at
[plugs/webvalidation/index.ts:82](../plugs/webvalidation/index.ts#L82) + `:169`) and
`validation-generation/` (1466 LOC — neutral contract + zod/pydantic/jsonSchema/nativeHtml adapters). Real
closure ≈ **3,400 LOC across 5 absent subsystems**, and it crosses the **standard ↔ implementation
boundary** — a mechanical copy-into-FUI would put a WE *standard* (`capability-manifest`) into the impl
repo, violating the npm-scope-mirrors-layer rule (`@webeverything` = standard artifacts only) and the
impl-is-not-a-standard rule.

That layer call is not #725's to make quietly, so it's carved to a prepared decision
**[#730](/backlog/730-constellation-placement-of-capability-manifest-validation-ge/)** (Fork A:
`capability-manifest` stays a WE standard FUI imports from `@webeverything`; Fork B: split
`validation-generation` contract→WE / adapters→FUI — both bold-defaulted, ready to ratify). `blockedBy:
#730` added and `size` bumped **5 → 8** (the audit under-sized it). Released to the pool unworked; resumes
once #730 ratifies, re-shaped to copy only the impl half + import the WE-resident contract.
