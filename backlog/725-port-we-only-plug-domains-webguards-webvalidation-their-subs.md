---
type: issue
workItem: story
size: 8
status: open
locus: frontierui
parent: "170"
blockedBy: ["649", "730", "814", "817", "893"]
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
[we:plugs/webvalidation/index.ts:82](../plugs/webvalidation/index.ts#L82) + `:169`) and
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

**Also owns the `webguards`/`webvalidation` dual-mode (unplugged + plugged) test backfill** — handed off
from [#637](/backlog/637-backfill-the-dual-mode-unplugged-plugged-plug-test-suite-acr/) (which backfilled
the four stable domains). Authoring those tests belongs with the port (verify FUI `vitest` green for the
ported domains), not in WE where the code is about to move. The `PLUG_UNPLUGGED_TEST_ENFORCED` → `true`
gate-promotion (#636) waits until this lands, since `webguards`/`webvalidation` are the last two domains
without an unplugged-mode test.

## Blocked again — the #730 import surface doesn't exist yet (2026-06-16, batch-2026-06-16)

Claimed in a batch after #730 ratified; re-evaluated the closure at claim-time before copying anything.
The #730 ruling (A1+B1+C2) keeps the contract halves in WE and has **FUI import them from `@webeverything`** —
but that consumable surface **does not exist**: the WE package is `web-everything` (unscoped) with **no
`exports` map**, FUI carries **no `@webeverything` dependency**, and `capability-manifest/` +
`validation-generation/` are on no published path. So "copy the impl half + import the WE-resident contract"
can't proceed — there is nothing to import from. Carved the prerequisite to
**[#804](/backlog/804-establish-the-we-contract-export-package-surface-consumable-/)** (decide + build how WE
exposes its standard contracts to FUI as a package, then export the two contracts + add the FUI dep);
`blockedBy: #804` added. Released to the pool unworked; resumes once #804 lands the import surface.

## Blocked again (3rd) — three more subsystems in the closure are unplaced (2026-06-16, batch-2026-06-16)

Claimed in a batch after #804/#814 landed the `@webeverything/*` export surface; re-traced the closure
**from the plug sources** (not the stale #635 audit) before copying. #804/#814 are real and complete — but
they exported only **two** of the closure's **five** subsystems. The plugs also hard-import three more that
#730 never classified and #814 never exported:

- `we:plugs/webguards/index.ts:23-31` → `guard/{provider,registry}` (#288/#289)
- `we:plugs/webvalidation/index.ts` → `validity-merge/{provider,registry}` (#212) +
  `validator-resolution/{provider,registry,index}` (#214)

These three are provider+registry **strategy planes** — and the #730 report itself cites validity-merge /
validator-resolution as *the precedent planes capability-manifest is structured like*, i.e. the very shape
ruled **A1 (stays WE)**. So porting them wholesale into FUI would risk the standard-into-impl leak #730
exists to prevent, yet there is no `@webeverything` export to import them from either — the same wall as
the 2nd block, one layer out. That placement (the same A1/B1 axis, never applied to these three) is not
#725's to decide quietly. Carved to **[#817](/backlog/817-constellation-placement-of-guard-validity-merge-validator-re/)**
(B1-shaped split recommended: provider/registry contract → WE + three new exports; concrete impl → FUI);
`blockedBy: #817` added. Released unworked; resumes once #817 rules and the export delta lands.
