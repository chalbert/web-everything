---
type: decision
workItem: story
size: 2
parent: "315"
status: resolved
blockedBy: []
relatedReport: reports/2026-06-16-backlog-split-analysis.md
dateOpened: "2026-06-16"
dateStarted: "2026-06-17"
dateResolved: "2026-06-18"
graduatedTo: none
tags: []
---

# Temporal trait-impl locus — WE blocks/ vs @frontierui/blocks

Carved from the `/split 736` re-slice attempt (2026-06-16, reports/2026-06-16-backlog-split-analysis.md). #736 (temporal block IMPL — variant traits + build-chunk assertion) cannot be sliced until this is ruled, because the answer decides *where* its first trait-impl pattern is authored.

## The fork

**Where is greenfield temporal trait-impl (`calendar-grid` / `clock` / `range-coordination` CustomAttribute modules) authored — WE `blocks/temporal/` or `@frontierui/blocks`?**

- **#713** explicitly placed the temporal trait build in WE (`traitEnforcer({ traitMap: {} })`, vite.config.mts:104 — WE owns the trait-enforcer seam and has the empty traitMap awaiting its first entry).
- **#658** (resolved 2026-06-17) executed the #641 ruling: real impl migrated UP to a canonical `@frontierui/blocks` sub-package and WE's vendored `blocks/` runtime is being deleted. Authoring new trait impl into WE `blocks/temporal/` writes into a tree slated for deletion.

This was a "locus watch-item, a re-estimate not a fork" in #736's body; #658 going active turned it into a genuine fork.

## State (verified 2026-06-17, at claim)

The "both ends un-buildable" framing this was opened under is now stale: **`@frontierui/blocks` exists** — `../frontierui/blocks/package.json` (`@frontierui/blocks` v0.1.0) already ships the 14 original families **including a `traits` family**, plus the migrated single-file families. Only WE's `blocks/temporal/` end is non-viable (doesn't exist, tree doomed). So the FUI target is real and shipping; this strengthens the impl→FUI reading rather than leaving it a coin-flip. `blockedBy: ["658"]` dropped (658 resolved).

The remaining substance is not "which dir" but the **trait-enforcer build seam** (WE-owned, vite.config.mts:96): does it move to FUI, or stay a WE-side reference impl + conformance gate consuming a FUI-authored traitMap?

## Decision shape

Resolving this unblocks #736's impl-track. See reports/2026-06-16-backlog-split-analysis.md.

## Ruling (2026-06-17) — RATIFIED — FUI-locus end-to-end; the seam moves OUT of WE

> Ratified by the user 2026-06-17 after working through what the trait-enforcer actually does. Converged across the discussion: (1) the scan-and-emit plugins are "definitely implementation"; (2) the `traitManifestContract.ts` manifest format is "tied to the way FUI does things, so FUI is its natural home" — an FUI **intermediate representation**, not a neutral cross-seam contract. So the WHOLE `tools/trait-enforcer/` → FUI.

Governing principle (user, 2026-06-17): **WE is protocol + contracts only — it cannot hold code.** This is the load-bearing constellation invariant (impl-is-not-a-standard, npm-scope-mirrors-layer #239, #855 "only the contract crosses the seam, code never does", #507 "adapter lives outside WE"). It dissolves the fork: the temporal-trait work is several artifact kinds, and only one is a WE artifact.

- **Trait IMPL** (`calendar-grid` / `clock` / `range-coordination` CustomAttribute modules) → **`@frontierui/blocks`.** Real running code. Not greenfield-infra: FUI already ships a `traits` family (`../frontierui/blocks/traits`) and lazy-trait demos — the temporal traits slot in.
- **traitMap wiring + named-preset attribute declarations** → **FUI** (build wiring local to whoever renders the traits; that's FUI's site/demos).
- **Build-chunk assertion** ("a time-only fixture pulls no calendar chunk") → **FUI** (sub-call 3 settled by the principle: it's runnable code exercising FUI's real traits in FUI's build = dogfood, not a WE artifact). The *generic* chunk-isolation conformance is already separately owned by the #715 epic (#720/#722) — #736 does not duplicate it.
- **The entire trait-enforcer — both the `traitManifestContract.ts` manifest format AND the 5 generator plugins** (vite/rollup/webpack/esbuild/parcel) → **FUI.** The plugins are obviously code; the manifest format, though pure-data, is an FUI-shaped intermediate representation (build→runtime IR), not a neutral cross-seam contract — so it has no second party and rides with the impl. FUI already holds its own copy (`../frontierui/tools/trait-enforcer/`). WE's whole `tools/trait-enforcer/` copy is misplaced.
- **What WE retains:** at most the higher-level **Web Traits protocol** surface — the `trait` HTML-attribute convention + `registerTraits`/`CustomAttributeRegistry` runtime semantics + the lazy/eager/preload delivery vocabulary (the paradigm `project:webtraits` named). **Ratified position (lean, ~70%, explicitly revisitable):** that protocol-level surface stays a WE standard; only the manifest IR + codegen are FUI. The residual — whether even that surface is wholly FUI, reducing WE's Web Traits standard to the `CustomAttributeRegistry` plug it builds on — is documented for later as part of the #894 relocation (it must decide exactly what to preserve in WE vs move), not force-settled here.

**The trait-enforcer build seam does NOT move "into" WE — it moves OUT.** vite.config.mts:96 keeps `traitEnforcer({ traitMap: {} })` only because nothing's authored; the right end-state is to drop the plugin from WE's build entirely, because WE iframe-embeds FUI demos and never renders trait code (docs-rendering boundary) → WE's traitMap is empty *by design*, permanently.

### Consequences documented for later (NOT executed here)

- **#894 — relocate the whole `tools/trait-enforcer/` (manifest contract + 5 plugins) out of WE to FUI**, preserve only the protocol surface, drop the WE vite plugin. Reverses #484's "port the enforcer INTO WE" + the #715 subtree's WE-path placement (#717/#744/#756/#787), which predated the #641/#658/#855 boundary hardening. **Lineage:** supersedes those placements — *the enforcer was built correctly; the principle on where it lives changed*, not "it was wrong."
- **#895 — decide the home for a generic WE-conformance / schema-validation service.** Vectors (declarative, "what conformance means") → WE as a separate `@webeverything/…` data package (safe; a spec can't "fail to deliver"). The runnable validator → NOT WE (reputational risk + it's generic across implementers, FUI is only one) → lean Plateau-suite tooling (open-core), alt independent devtool. Surfaced by the user's concern that a big runnable tool failing would damage WE's reputation.

### Net for #736

Temporal impl-track is **FUI-locus, end-to-end** (impl + traitMap + build-chunk dogfood), against already-shipping FUI infra. Re-slice #736 with `locus: frontierui`; drop its #779 block.

**Confidence:** impl→FUI ~95%; whole-enforcer→FUI ~90% (user-affirmed principle + the manifest-is-an-FUI-IR call + #855/#507). Residual: the protocol-surface retention (~70%) and the #895 validator home are documented for later, not closed here.
