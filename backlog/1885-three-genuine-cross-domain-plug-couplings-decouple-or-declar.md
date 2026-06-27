---
kind: story
size: 3
status: resolved
relatedItems: ["1846"]
relatedProject: webplugs
locus: frontierui
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: frontierui/plugs/__tests__/unit/subpath-exports.conformance.test.ts
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

## Disposition (batch-2026-06-27) — all four edges: **(b) declare a seam**

Adjudicated each coupling against its source. All four are **the same shape** — a *feature* plug extending
a sibling's **base-class primitive**, never a feature→feature dependency:

| Edge | Site | What | Call |
| --- | --- | --- | --- |
| `webanalytics` → `webbehaviors` | `fui:plugs/webanalytics/TrackAttribute.ts:31,81` | `TrackAttribute extends CustomAttribute` | seam — behavior base |
| `webportals` → `webdirectives` | `fui:plugs/webportals/PortalDirective.ts:28,102` | `PortalDirective extends CustomTemplateDirective` | seam — directive base |
| `webregistries` → `webcomponents` | `fui:plugs/webregistries/CustomElementRegistry.ts:5,45` | registry defined over `CustomElement` (`new (…) => CustomElement`) | seam — element base |
| `webregistries` → `webbehaviors` | `fui:plugs/webregistries/ScopedRegistryAttribute.ts:17,25` | `ScopedRegistryAttribute extends CustomAttribute` | seam — behavior base |

`CustomAttribute` (webbehaviors), `CustomElement` (webcomponents), `CustomTemplateDirective` (webdirectives)
are the base classes that define a *kind* of custom thing — the platform-primitive layer alongside `core`
(the registry/base-class kernel) and `webinjectors` (the DI primitive). Extending a base class is
foundational, not incidental, so **decouple was rejected**: there is no shared-seam copy of these bases to
redirect to (they belong with their domain), and hoisting them into `core` is a wrong, larger refactor. So
all three primitive domains were **promoted into `DECLARED_SEAMS`** and `KNOWN_CROSS_DOMAIN_VIOLATIONS` is
now empty by construction. The gate keeps its teeth: a coupling between two *feature* domains is still NEW
and still fails — only the five platform-primitive domains are seams.

Edited `fui:plugs/__tests__/unit/subpath-exports.conformance.test.ts` (DECLARED_SEAMS + the now-empty
violations map + the informational test, which previously asserted `>0`); 40 conformance tests green. FUI
`check:standards` red is pre-existing and unrelated (34→34, none names this changeset).

Lineage: surfaced by #1846 (subpath-export conformance). Locus: FUI.
