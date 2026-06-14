---
type: issue
workItem: story
size: 5
parent: "170"
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: "project:webtraits"
tags: [traits, trait-enforcer, build, vite, code-split]
---

# Port the trait-enforcer tool into Web Everything (real manifest generation)

Port FU's `tools/trait-enforcer/` — the Vite plugin that scans template usage and **generates** the `virtual:trait-manifest` module (a code-split chunk per lazy trait, a hoisted static import per eager trait, the #202 per-usage `preload` hint) — into Web Everything. Today (#448) WE wires `registerTraits(virtual:trait-manifest)` but the specifier resolves to the **empty** static manifest on every leg: there is no Enforcer here to build the real table, so no trait chunk is ever emitted. This item builds that generator and swaps the empty-alias fallback for it. The final leg of #170's merge-up; required before any real trait can ship in WE.

## Scope

- Add the trait-enforcer Vite plugin under WE `tools/trait-enforcer/`.
- Swap the `virtual:trait-manifest` `resolve.alias` empty-manifest fallback in [vite.config.mts](../vite.config.mts) for the plugin (vitest **keeps** the empty-alias fallback — the Enforcer is a Vite plugin, absent under vitest; tsc keeps the ambient `plugs/virtual-trait-manifest.d.ts`).
- Prove a scanned `<el trait>` usage emits its own chunk, loaded on first appearance.

Behaviourally a no-op until a trait is authored into the manifest, but the wiring (#448) is empty until this lands.
