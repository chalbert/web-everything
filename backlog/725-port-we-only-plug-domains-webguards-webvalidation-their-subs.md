---
type: issue
workItem: story
size: 13
status: resolved
locus: frontierui
parent: "170"
blockedBy: ["649", "730", "814", "817", "893"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: none
relatedReport: reports/2026-06-14-plugs-runtime-audit.md
tags: [plugs, dedup, migration, frontierui, webguards, webvalidation]
---

# Port the `webvalidation` plug domain + its subsystems into Frontier UI

> **Pre-flighted in batch-2026-06-18 — re-sized 5 → 13 (drops from the batch pool); NOT a clean batch
> seam.** The FUI aliases ARE wired (`fui:vite.config.mts` carries `@webeverything/{capability-manifest,
> validation-generation/*,contracts/*}`), so the carve landed — but the actual port is a **#170-class
> migration of ~22 runtime files**: `plugs/webvalidation/*` (6), `validation-generation/` runtime
> (`cel`/`fieldError`/`serviceHandler`/`crossField`/`registry`/`provider`/`service`), `validity-merge` +
> `validator-resolution` runtime (`registry`/`provider` each), `capability-manifest` consumption
> (`provider`/`report`/`guard`/`check`/`fixtures`), plus bootstrap wiring — each faithfully ported with
> FUI build + vitest green. That is well past a `story·5`; it wants its own focused migration pass (and a
> per-subsystem sub-slice would batch better). Parent #170 is also a D3-held plugs-platform migration.
Re-scoped via `/slice` (batch-2026-06-18, see we:reports/2026-06-18-backlog-split-analysis.md): this item now
ports **only the `webvalidation` domain** into FUI — the runtime halves of `validity-merge/`,
`validator-resolution/`, `validation-generation/` (incl. the impl-only `we:validation-generation/crossField.ts`/`adapters/*`/
`we:validation-generation/serviceHandler.ts`), the `capability-manifest` consumption, `plugs/webvalidation/*`, and its bootstrap
wiring — all cross-imports resolving through the **already-wired** `@webeverything/{contracts/{validity-merge,
validator-resolution},validation-generation/*,capability-manifest}` FUI vite aliases (fui:vite.config.mts).
**Purely additive on the FUI side** — the WE-side contract carve already landed in #814/#893, and deleting
WE's copies is #449's job (which #725 gates). Done when FUI build + vitest are green for the ported domain.
The sibling `webguards` port and the dual-mode test backfill (with the #636 gate flip) were sliced out as
separate items under #170. Historical blocking trail (now all resolved) preserved below.

## Progress — RESOLVED (2026-06-18)

The `webvalidation` domain is ported into FUI, purely additive, with the contract/impl split honoured per
#730/#817. Ported (impl halves, runtime-only — contract halves stay WE, reached via the `@webeverything/*`
aliases): `fui:validity-merge/{provider,registry,index}.ts`,
`fui:validator-resolution/{provider,registry,index}.ts`,
`fui:validation-generation/{crossField,serviceHandler,adapters/{index,zod,pydantic,jsonSchema,nativeHtml}}.ts`,
and `fui:plugs/webvalidation/{index,CustomValidityMergeRegistry,CustomValidatorResolutionRegistry,ValidityMergeField,AsyncValidatorField,applyMergedValidity}.ts`.

- **Import rewiring:** the plug barrel + each impl file resolve their WE-resident halves through aliases —
  `@webeverything/contracts/{validity-merge,validator-resolution}` (the type-only contract),
  `@webeverything/validation-generation/{provider,registry,fieldError,cel,service}` (Mode-1/2 generation),
  `@webeverything/capability-manifest` (whole plane). FUI-local impl (`crossField`, `adapters/*`,
  `serviceHandler`, the two strategy planes' provider/registry) imported relatively.
- **vitest wiring:** `fui:vitest.config.ts` carries a separate alias map from `fui:vite.config.mts`
  (it had only `trait-manifest-contract`); added the 8 `@webeverything/{capability-manifest,
  validation-generation/*,contracts/*}` aliases webvalidation needs so vitest resolves the ported tree.
- **Bootstrap:** `fui:plugs/bootstrap.ts` now creates `customValidityMerge` +
  `customValidatorResolution` registries and defines `<validity-merge-field>` / `<async-validator-field>`,
  mirroring WE (webguards left to #950).
- **Gates:** FUI `vitest run` green (1974 pass / 8 skip, no regression); a transient resolution+runtime
  smoke over the ported barrel passed (deleted — the real dual-mode suite is #951); `npm run build:demo`
  built clean.
- **Known carry (filed #965):** `tsc --noEmit` over `fui:tsconfig.json` reports 4 errors on the ported
  registries (`CustomValidityMergeRegistry`/`CustomValidatorResolutionRegistry` `define(strategy,…)`
  override is structurally incompatible with the base `CustomRegistry.define(name:string,…)`, + 2 cascades
  in bootstrap). **Latent in WE too** — WE's `we:tsconfig.json` only includes `src/**`, never `plugs/`, so it
  never surfaces there; FUI's plugs tree is tsc-clean at baseline, so the port carries it in faithfully
  rather than diverging the copy (which would reintroduce the #170 drift this whole chain fights). Not
  gated by FUI `check:standards`/vitest/`build:demo`. Filed as a registry-base reconciliation follow-up.

Unblocks #449 (delete WE's `plugs/webvalidation` + subsystem copies). Sibling `webguards` port = #950
(active); dual-mode test backfill + #636 gate flip = #951.

---

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

## Re-sized 8 → 13 (batch-2026-06-18 — not a batchable slice)

Claimed in a batch; with #730 now resolved (A1+B1+C2), traced the post-ratification shape. This is
**not a batchable story·8** — it is a two-repo, contract-splitting port whose closure the body itself
flags as ~3,400 LOC across 5 subsystems:

- It **modifies WE standard files** (per #730 C2: split `we:validation-generation/service.ts` into
  wire-contract types staying WE + handler moving to FUI; per B1: `we:crossField.ts` + `adapters/*` move
  to FUI while `provider`/`registry`/`fieldError`/`cel` stay WE) — high blast radius across **both**
  repos' gates, unlike the self-contained single-repo FUI block builds the rest of this batch did.
- It ports `webguards`/`webvalidation` + `guard/`/`validity-merge/`/`validator-resolution/` into FUI,
  wiring each cross-import through the `@webeverything/*` sibling-aliases (already present in
  `fui:vite.config.mts`), plus bootstrap wiring.
- It **also owns** the `webguards`/`webvalidation` dual-mode (unplugged + plugged) test backfill
  (handed off from #637).

**Action:** resized to **13** (drops from the batch pool — a story·≥13 is never packed; encodes the
documented reality, not a new design call). Released `active → open`. Should be worked in a **focused
single-item session**, ideally `/slice`d into the contract-split (WE-side) and the impl-port (FUI-side)
as separately-gateable pieces. Blockers all resolved; ready to work, just not as a batch tail.
