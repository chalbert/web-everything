---
kind: story
size: 5
status: open
locus: webeverything
parent: 1353
dateOpened: "2026-06-24"
tags: [webeverything, demos, block-runtime-delete]
---

# Delete the graduated WE bootstrap-runtime block families + repoint the declarative-spa demos

Re-scoped 2026-06-24 after `/slice 1768` (`we:reports/2026-06-24-backlog-split-analysis.md`) found the original "relocate the plug + bulk-delete 7 families" framing stale. Corrected scope:

- **The plug relocation is already done** — #606 resolved (plugs live in FUI), #1234/#1046 landed the WE→`@frontierui/plugs` repoint. WE has no `plugs/` source; `we:vite.config.mts:16` resolves the bootstrap URL to `fui:plugs/`, and `fui:plugs/bootstrap.ts` already wires all 7 families. Nothing to relocate.
- **6 families are clean graduated-runtime, deletable now** — `we:blocks/parsers`, `we:blocks/text-nodes`, `we:blocks/for-each`, `we:blocks/transient`, `we:blocks/stores`, `we:blocks/attributes` each have **exact FUI parity** (same src file count, FUI twin complete) and **no `__fixtures__`/conformance vectors**. Delete the runtime impls; the standard *definitions* under `we:src/_data/blocks/` stay — only the impl graduates.
- **`we:blocks/router` STAYS** — it is the #1684 webrouting standard's WE-side derivation (`we:blocks/router/route-emitters.ts`, `we:blocks/router/sitemap-emitter.ts`, `we:blocks/router/route-map.ts`, `we:blocks/router/url-state.ts` + `we:blocks/router/__fixtures__/` vectors), not a bootstrap-runtime family. Out of this story's scope.
- **`navigation` is already deleted** WE-side.

## Work

1. Repoint the 3 demos that import the WE families **directly** — `we:demos/declarative-spa.html`, `we:demos/declarative-spa-jsx.tsx`, `we:demos/declarative-spa-router.html` — off the WE-local imports (they already load the FUI-resolved bootstrap; remove the direct `we:blocks/` imports).
2. Confirm no other live (non-test, non-`_site`, non-`dist`) importer of the 6 families remains.
3. Delete the 6 WE family runtime dirs; update any `we:blocks/index` barrels. Keep the definitions under `we:src/_data/blocks/` and keep `we:blocks/router`.
4. Gate: `npm run check:standards` green; demos still render against the FUI bootstrap.
