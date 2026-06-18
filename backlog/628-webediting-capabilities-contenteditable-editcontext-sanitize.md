---
type: issue
workItem: story
size: 2
parent: "618"
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "capability:contenteditable + editcontext + sanitizer-api + highlight-api — 4 editing-surface capabilities (capabilities.json + capabilityMatrix.json), foundational slice of #618"
tags: []
---

# webediting capabilities — contenteditable/editcontext/sanitizer-api/highlight-api ids + capabilityMatrix tiers

Add the four net-new editing-surface capability ids (contenteditable, editcontext, sanitizer-api, highlight-api) to we:src/_data/capabilities.json (mirror the popover entry shape: id/label/webFeaturesKey/baseline/polyfill/summary) and tier each in we:src/_data/capabilityMatrix.json (impls[].tiers map). Foundational slice for the #618 webediting graduation — the editing surface caps the engine Protocol negotiates (contenteditable floor + editcontext upgrade, #590 Fork 3) and the rich-text intent requiresCapabilities. No deps; renders on the capabilities catalog. Ratified in #590.

## Progress

- Added the four editing-surface capabilities to [we:src/_data/capabilities.json](/src/_data/capabilities.json) mirroring the popover entry shape: `contenteditable` (baseline 2020, polyfill `capability`), `editcontext` (not-yet-Baseline, `capability` — the #590 Fork 3 upgrade tier), `sanitizer-api` (`polyfillable` via DOMPurify), `highlight-api` (`partial` span-wrap fallback).
- Tiered all four in both registered impls in [we:src/_data/capabilityMatrix.json](/src/_data/capabilityMatrix.json) to keep the impl × capability grid complete: `base-select` (native substrate) tiers all four `native-ok`; `face` (build-your-own) tiers `contenteditable` native-ok, `editcontext` capability-hard, `sanitizer-api`/`highlight-api` polyfill-ok — mirroring its existing cross-root-aria / anchor-positioning pattern.
- `npm run check:standards` green.
