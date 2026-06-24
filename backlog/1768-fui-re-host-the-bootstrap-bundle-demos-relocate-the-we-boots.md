---
kind: story
size: 5
status: resolved
locus: webeverything
parent: 1353
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: frontierui/blocks (parsers, text-nodes, for-each, transient, stores, attributes)
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

## Progress (resolved 2026-06-24)

- **Repoint** — the only *value* import of a graduated family across all live consumers is `SimpleStore` from `we:demos/*` importing the URL `/blocks/stores/simple` (the 3 declarative-spa demos). Repointed via a targeted `we:vite.config.mts` alias (`/blocks/stores/simple` → `fui:blocks/stores/simple`) — mirrors the established `we:vite.config.mts` `/plugs` #1234 repoint; the demos keep the same URL, now FUI-resolved. The other 5 families are bootstrap-registered (custom elements / behaviors) pulled in by the FUI-resolved bootstrap (`we:vite.config.mts` aliases `/plugs` → `fui:plugs`) — no direct demo import. `we:demos/text-interpolation-demo.html` is bootstrap-only (interpolation runs via FUI webexpressions) — unaffected.
- **No kept-code coupling** — verified **zero** WE source outside the 6 dirs imports them (renderers/router/etc. use `@webexpressions`/`@frontierui/plugs`, not the graduated families); no `we:blocks/index` barrel exists.
- **Deleted** — the 6 runtime dirs (`we:blocks/parsers`, `we:blocks/text-nodes`, `we:blocks/for-each`, `we:blocks/transient`, `we:blocks/stores`, `we:blocks/attributes`) + their 13 WE-side tests (the FUI parity twins carry the coverage). Kept: `we:blocks/router`, all other `we:blocks/*`, and the standard definitions under `we:src/_data/blocks/`.
- **Gate** — `npm run check:standards` 0 errors. `test:unit` green for this changeset (the 2 unrelated reds — `claim-no-git-guard`, `backlog-graph-render` — are concurrent-session failures in files outside this changeset; the graph red is a pre-existing 14-circle gap independent of these edits).
