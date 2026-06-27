---
kind: story
size: 3
status: open
relatedItems: ["1846"]
relatedProject: webplugs
locus: frontierui
dateOpened: "2026-06-27"
tags: [plugs, packaging, coupling, conformance]
---

# Three genuine cross-domain plug couplings — decouple or declare as seams (surfaced by the #1846 conformance gate)

The #1846 subpath-export tree-shake gate (`fui:plugs/__tests__/unit/subpath-exports.conformance.test.ts`) found that, once `webinjectors` is recognised as a declared runtime seam (the injector-chain DI eight domains resolve through, like `core`), three genuine sibling-feature couplings remain — a plug domain statically importing a NON-seam sibling, so importing it does not tree-shake the sibling away. They are locked in the gate's `KNOWN_CROSS_DOMAIN_VIOLATIONS` allowlist (new ones now hard-fail); this item decides each one's disposition.

## The three couplings

| Importer | Reaches | Where |
| --- | --- | --- |
| `fui:plugs/webanalytics` | `webbehaviors` | `fui:plugs/webanalytics/TrackAttribute.ts` |
| `fui:plugs/webportals` | `webdirectives` | `fui:plugs/webportals/PortalDirective.ts` |
| `fui:plugs/webregistries` | `webcomponents`, `webbehaviors` | `fui:plugs/webregistries/CustomElementRegistry.ts`, `fui:plugs/webregistries/ScopedRegistryAttribute.ts` |

## The call (per coupling)

For each, decide: **(a) decouple** — the import is incidental and the importer should depend on a shared seam or its own surface instead (then drop it from the allowlist); or **(b) declare an additional seam** — the imported sibling is genuinely foundational to the importer (e.g. `webanalytics`/`webportals` build on the attribute/directive primitive), in which case promote it into `DECLARED_SEAMS` with the rationale, like `webinjectors`. Each resolution either removes the entry from `KNOWN_CROSS_DOMAIN_VIOLATIONS` or moves the seam to `DECLARED_SEAMS`; the gate stays green by construction.

Lineage: surfaced by #1846 (subpath-export conformance). Locus: FUI.
