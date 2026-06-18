---
type: issue
workItem: story
size: 5
status: open
dateOpened: "2026-06-18"
tags: []
---

# Relocate the whole trait-enforcer (manifest contract + 5 plugins) out of WE to FUI

Ratified #779 consequence: the entire `tools/trait-enforcer/` — the 5 bundler plugins (vite/rollup/webpack/esbuild/parcel) AND the `traitManifestContract.ts` manifest format (ruled an FUI-shaped build→runtime IR, not a neutral contract) — belongs in FUI, which already holds its own copy. Remove WE's `tools/trait-enforcer/`, drop `traitEnforcer()` from WE's vite.config.mts, but PRESERVE in WE the higher-level Web Traits protocol surface (`trait` attribute + registerTraits/CustomAttributeRegistry semantics + delivery vocab).

WE iframe-embeds FUI demos and never renders trait code → its traitMap is empty by design, permanently, so the plugin earns no place in WE's build. This supersedes the WE placement of #484/#717/#744/#756/#787 — the enforcer was built correctly; the principle on where it LIVES changed (#641/#658/#855 boundary hardening, #507 adapter-outside-WE). Lineage, not erasure. Note the #779 residual: whether even the protocol surface is wholly FUI (~70% it stays WE) is decided here, as part of choosing exactly what to preserve vs move.
