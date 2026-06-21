---
kind: decision
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:src/_data/projects/webplugs.json"
codifiedIn: "docs/agent/platform-decisions.md#constellation-placement"
preparedDate: "2026-06-20"
relatedProject: webplugs
relatedReport: reports/2026-06-20-webplugs-standard-vs-runtime-disposition.md
tags: [webplugs, project-disposition, constellation, drift, frontierui]
---

# Disposition of the webplugs WE project entity after #606 moved the plugs runtime to Frontier UI

**Prepared** — ratify-existing-architecture (no new design), grounded in the prior-art/internal survey published at `/research/webplugs-standard-vs-runtime-split/` (report linked via `relatedReport`). The question: after [#606](/backlog/606-where-does-the-plugs-platform-layer-runtime-live-web-everyth/) moved the plugs *runtime* to FUI, does the WE `webplugs` project survive? It does — WE owns the plugs **interface/contract** standard (the plugged/unplugged dual-mode spec + 51 `active` plug defs); #606 split only the runtime, the normal standard/impl seam. The single fork below carries a recommended default in **bold**: **keep `webplugs` as a WE standards project and reconcile its drifted `concept` status**; *retire* is the excluded branch (it would delete a shipped WE standard).

## The axis — one disposition, grounded in the real surface

The decision turns on a single, verifiable question: **does WE own a `webplugs` standard surface distinct from the now-FUI runtime?** The tree answers *yes*, concretely:

- **The plug-layer spec** — `we:src/_includes/project-webplugs.njk` defines Web Plugs as the *"foundational layer"*, the plug **types** (`Global` / `Patch`), and the **Plugged vs Unplugged** dual-mode contract (its `#plugged-unplugged` section). A WE-authored standard.
- **51 active plug interface defs** — `we:src/_data/plugs/` (e.g. `we:src/_data/plugs/customattribute.json`, `"status": "active"`), homed under the domain projects they serve, with `webplugs` the foundational meta-project.
- **#606** moved only the runtime (`@frontierui/plugs`) — the impl half of the standard/impl seam; it did not touch the WE contract above.

So the `⊗ project pending` pill on [#170](/backlog/170-plugs-duplicated-across-webeverything-frontierui/) is a **status-drift false positive (#617)**: `we:src/_data/projects/webplugs.json` line 5 still says `"status": "concept"`, but the loader's drift-escape proxy counts only *resolved backlog items tagged `relatedProject: webplugs`* (`we:src/_data/backlog.js:77`, used at `:84-87`) — and zero match, because the surface shipped as a spec page + data defs, not a tagged resolved item.

## Recommended path at a glance

| Element | Classification | Recommendation |
| --- | --- | --- |
| `webplugs` project entity | WE **standard** (contract layer) | **Keep** — it is a real shipped surface, not a concept |
| Plug runtime (`@frontierui/plugs`) | FUI **impl** (settled by #606) | Unchanged — stays in FUI |
| `we:src/_data/projects/webplugs.json` `status` | drifted (`concept` over shipped work) | **Bump `concept → poc`** (convention, not enum-validated) → clears #170's pill |
| #170's `relatedProject` | correct as-is | Keep `webplugs` |
| Loader drift-proxy miss | general precision gap | Spin a follow-up (spec/data-only surfaces are invisible to #617) |

## Fork 1 — disposition of the WE `webplugs` project

**Why it is a fork (fork-existence):** case (a), a forced invariant — one branch is *excluded*, not a live either/or. The excluded branch is **retire**: it would delete a shipped WE standard (the plugged/unplugged contract + 51 active plug defs + the spec page). It only looked viable while #606 was misread as moving the *whole* plugs concern to FUI; it moved the runtime only. (Not a prioritization call — nothing here turns on cost/effort.)

- **(A) Retire the WE `webplugs` project** — delete `we:src/_data/projects/webplugs.json`, re-home #170. *Excluded:* destroys a live WE standard surface; contradicts the constellation (WE owns contracts).
- **(B) Keep `webplugs` as a WE standards project — default.** #606 split only the runtime; WE keeps the interface defs + the plugged/unplugged contract + conformance. Reconcile the drift: bump `we:src/_data/projects/webplugs.json` `status: concept → poc`. (Project `status` is **not** enum-validated — no check references it; `poc` is the established convention, 22 projects use it, for "shipped surface, not yet graduated". The `concept | draft | experimental | active` `LIFECYCLE` set in `we:scripts/check-standards-rules.mjs:574` governs *descriptors* like plugs/blocks, not projects — which is why the plug *defs* are individually `active` while the project is not. What actually matters: bumping **off** `concept` is what clears the demotion, since the `#617` drift-proxy fires only on `concept` + zero resolved surface.) #170's `relatedProject: webplugs` stays. **Confidence ~90%**; residual was only the exact status value (now settled: `poc`) and whether the loader-proxy gap is fixed now vs later (deferred to **#1260**).

## Independent of this decision

#170 closes the normal way once its last open child **#1047** (delete WE `plugs/` + relocate tests) lands → `/resolve #170`. This disposition does not gate that — it only removes a misleading readiness pill — so no `blockedBy` edge is wired.

## Follow-up surfaced (not part of the ruling)

The loader's #617 drift-escape proxy (`we:src/_data/backlog.js:77`) only detects shipped work via `relatedProject`-tagged *resolved backlog items*; a project whose surface ships as spec/data (like `webplugs`) is invisible and gets mis-demoted. **Filed as #1260** (`story`, size 3) — generalises the proxy to count spec-page + data-def surfaces. Not a `blockedBy` of this ruling: the `concept → poc` bump clears the pill now; #1260 makes it self-correcting without per-project status babysitting.

## Ratified (B) — 2026-06-20

Kept `webplugs` as a WE standards project (forced invariant; *retire* excluded). Red-team failed: the surface is genuine contract (spec page + 51 interface defs, no lingering impl) and *keep* violates no principle. Bumped `we:src/_data/projects/webplugs.json` status `concept → poc`, citing #606 (which split only the runtime). `graduatedTo: we:src/_data/projects/webplugs.json` recorded.
