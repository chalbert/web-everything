# webplugs: the standard is WE, the runtime is FUI — disposition grounding (#1248)

**Date:** 2026-06-20 · **Decision:** [#1248](/backlog/1248-disposition-of-the-webplugs-we-project-entity-after-606-move/) · **Research topic:** `/research/webplugs-standard-vs-runtime-split/`

## The question

After [#606](/backlog/606-where-does-the-plugs-platform-layer-runtime-live-web-everyth/) ruled the plugs **runtime** lives in Frontier UI (`@frontierui/plugs`, not a WE standard artifact), does the WE `webplugs` *project entity* still have a reason to exist — or is it a ghost of the pre-#606 model that should be retired? The trigger was a `⊗ project pending` readiness pill on the plugs-dedup epic #170, which implied `webplugs` is an un-built concept.

## Finding — WE owns the plugs *interface/contract* standard; #606 split only the runtime

The `webplugs` project is **not** an empty concept. WE ships a substantial, live standards surface for it:

1. **The plug-layer spec.** `we:src/_includes/project-webplugs.njk` defines Web Plugs as *"the foundational layer of the Web Everything platform"* — the polyfills/patches contract. It specifies the **plug types** (`Global` = new objects on `window`; `Patch` = modifies a native API) and, in its own `#plugged-unplugged` section, the **Plugged vs Unplugged dual-mode contract**: *plugged* monkey-patches native APIs so the DOM self-upgrades; *unplugged* is explicit safe-library usage. That dual-mode contract is a **standard definition**, authored in WE.
2. **51 active plug interface defs.** `we:src/_data/plugs/` holds 51 entries (`CustomAttribute`, `CustomContext`, `CustomExpressionParser`, the registries, …), each `"status": "active"` (e.g. `we:src/_data/plugs/customattribute.json`). These are the interface/contract surfaces of the plug layer. They are homed under the *domain* projects they serve (`we:src/_data/plugs/customattribute.json` → `"projects": ["webbehaviors"]`), with `webplugs` as the foundational meta-project that defines what a plug *is*.

This is exactly the WE-standard / FUI-impl seam the constellation prescribes: **WE owns the contract (the plug interfaces + the plugged/unplugged mechanism + conformance); FUI owns the runtime (`@frontierui/plugs`).** #606 moved the *runtime*, which is the impl half — it did **not** move or dissolve the WE-side standard. So a WE `webplugs` project is correct, not a ghost.

## Why the readiness pill misfired — status-drift (#617) invisible to the loader proxy

The `⊗ project pending` hold is a **false positive from status-drift**. `we:src/_data/projects/webplugs.json:5` still reads `"status": "concept"`, but the project has a shipped standards surface (above). The loader's D3-readiness drift-escape (#617) is supposed to *not* demote a concept project that has real shipped work — but its shipped-surface proxy counts only **resolved backlog items carrying `relatedProject: webplugs` in frontmatter** (`we:src/_data/backlog.js:77`, consumed at `:84-87`). Exactly **zero** items match: webplugs' surface shipped as a **spec page + data defs**, not as a tagged resolved backlog item. So the drift is real but invisible to the proxy, and the loader demotes #170 out of Tier A.

This is a small but general loader-precision gap: **any project whose surface ships as spec/data rather than a `relatedProject`-tagged resolved item is mis-demoted.** Worth a follow-up so this isn't whack-a-mole across webplugs-like projects.

## Disposition

- **Ruled out — retire the WE `webplugs` project.** Retiring would delete a real, shipped WE standard (the plugged/unplugged contract + 51 active plug defs + the spec page). The branch only looked viable while #606 was misread as moving the *whole* concern to FUI; it moved the runtime only.
- **Correct — keep `webplugs` as a WE standards project.** Reconcile the drift: bump `we:src/_data/projects/webplugs.json` `status: concept → poc` (the highest value the project-status enum — `concept` | `draft` | `poc` — allows). This reflects the shipped standards surface and clears #170's false hold. The `relatedProject: webplugs` on #170 stays.

## Independent of the disposition

#170 (the dedup epic) closes the normal way once its last open child **#1047** (delete WE `plugs/` + relocate tests) lands → `/resolve #170`. The disposition does not gate that; it only removes a misleading readiness pill, so no `blockedBy` edge is wired.

## Confidence

~90% on **keep** (the WE plugs standard surface is concrete and live). Residual is the exact status value to set (`poc` is the enum ceiling; the plug *defs* are individually `active`, but project-status has no `active`) and whether the loader-proxy gap warrants its own fix now vs later.
