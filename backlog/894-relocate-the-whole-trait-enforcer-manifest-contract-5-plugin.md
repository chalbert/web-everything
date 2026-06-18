---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["905"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
tags: []
---

# Relocate the whole trait-enforcer (manifest contract + 5 plugins) out of WE to FUI

Ratified #779 consequence: the entire `tools/trait-enforcer/` — the 5 bundler plugins (vite/rollup/webpack/esbuild/parcel) AND the `we:traitManifestContract.ts` manifest format (ruled an FUI-shaped build→runtime IR, not a neutral contract) — belongs in FUI, which already holds its own copy. Remove WE's `tools/trait-enforcer/`, drop `traitEnforcer()` from WE's vite.config.mts, but PRESERVE in WE the higher-level Web Traits protocol surface (`trait` attribute + registerTraits/CustomAttributeRegistry semantics + delivery vocab).

WE iframe-embeds FUI demos and never renders trait code → its traitMap is empty by design, permanently, so the plugin earns no place in WE's build. This supersedes the WE placement of #484/#717/#744/#756/#787 — the enforcer was built correctly; the principle on where it LIVES changed (#641/#658/#855 boundary hardening, #507 adapter-outside-WE). Lineage, not erasure. Note the #779 residual: whether even the protocol surface is wholly FUI (~70% it stays WE) is decided here, as part of choosing exactly what to preserve vs move.

## Blocked — premises only partly true (found in batch-2026-06-17 pre-flight)

Two premises don't hold against the tree, and the item's own flagged residual is a real open decision —
so this can't be executed as a mechanical move. Filed as decision **[#905](/backlog/905-decide-exactly-what-of-we-s-trait-enforcer-moves-to-fui-vs-s/)**; this item is now `blockedBy: [905]` (released to `open`).

- **"FUI already holds its own copy" is only partial.** `frontierui/tools/trait-enforcer/` has just
  `we:vite-plugin.ts` + `fui:virtual.d.ts` — **not** `we:traitManifestContract.ts`, the rollup/webpack/esbuild/parcel
  plugins, or `we:composedTraitSet.ts`. A move must ADD those to FUI, not delete a duplicate.
- **WE consumes the pieces marked for removal.** `we:blocks/renderers/module-service/traitServePath.ts` imports
  `traitManifestContract` **types** (the MaaS serve-path); `we:plugs/bootstrap.ts` + `we:tools/maas/vite-plugin.ts`
  consume `virtual:trait-manifest`, provided by `vite.config.mts:96` `traitEnforcer({traitMap:{}})`. WE may
  not import FUI (npm-scope-mirrors-layer), so moving `traitManifestContract` out breaks `traitServePath`.
- **The protocol surface is already separate** — `trait` attr + `registerTraits` + `CustomAttributeRegistry`
  live in `plugs/webbehaviors/`, **not** in `tools/trait-enforcer/`, so "preserve it" = leave `plugs/webbehaviors/`
  untouched. The open residual (~70% it stays WE) is whether even that moves — a standards-placement call.

Lean (in #905, ~70%): move only the 5 bundler plugins + `composedTraitSet` to FUI; KEEP `traitManifestContract`
+ the protocol surface in WE; swap vite's `virtual:trait-manifest` to the empty `resolve.alias` the vitest leg
already uses (mechanical, `bootstrap` still resolves). Not improvised here — it reverses part of #779's framing
and needs ratification.
