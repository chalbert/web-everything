---
type: idea
workItem: story
size: 5
parent: "081"
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: webadapters
tags: []
---

# MaaS served-artifact versioning — content-hash identity, pin grammar, provenance header, runtime compat-range contract

Realize the versioning contract #088 ratified: derive an immutable content-addressed id (hash of authored definition + transform/compiler version + params) for each served MaaS artifact; support a floating-tag → exact-semver → content-hash pin ladder resolving to the immutable URL; emit the producing core/compiler version as a provenance header (beside X-MaaS-Lossy) folded into the hash; and define + emit the runtime API-contract-version compat range in artifact metadata. The WE-layer contract (identity rule + compat-range format) plus its realization in the MaaS serve path. Prereq for #087 caching/distribution.

## Progress

**Resolved 2026-06-12.** The WE-layer contract is authored: `protocols.json#maas-versioning` + `project-webadapters.njk#protocol-maas-versioning` + 3 semantics terms (identity rule, pin grammar, provenance header, runtime compat-range *formats*). Serve-path emission is deferred — graduated as a build to #087 (caching/distribution) + #390 (Frontier UI runtime `__API_VERSION__` export + opt-in `maas-check` validator). `graduatedTo: webadapters` (home of the maas-versioning protocol).

> **Scope note (2026-06-12).** Picked up in a batch as a "build" but **no MaaS serve path exists in the tree yet** — so this splits: the **standard artifact is authorable now** (the identity rule, the floating-tag → semver → content-hash pin grammar, the provenance-header + compat-range *formats* — a WE-layer spec, design-first), but the **serve-path realization is deferred** until there is a serve path to realize it in (the MaaS provider build, alongside #087 caching/distribution and the Web Docs/MaaS product builds). Treat the next pickup as standards-authoring of the contract, not a serve-path implementation.

## Progress (2026-06-12) — standards artifact authored

Authored the WE-layer contract as a **Protocol** (`maas-versioning`, owned by `webadapters`):

- **`src/_data/protocols.json`** — new `maas-versioning` entry (`status: concept`, `ownedByProject: webadapters`, `anchor: protocol-maas-versioning`), summarizing the four-part contract.
- **`src/_includes/project-webadapters.njk`** — normative `<section id="protocol-maas-versioning">` body: MaaS framing, then (1) the content-addressed **identity invariant** + hashed-inputs table + `ArtifactIdentity` shape; (2) the **pin grammar** (floating → semver → content-hash ladder) + cache-policy table; (3) the **provenance header** (`X-MaaS-Producer`, folded into the hash); (4) the **runtime API-contract-version compat range** + `RuntimeCompat` shape + "satisfies" semantics. Contracts only — concrete impl is Frontier UI's (#390). Cross-links the #092 seam-contract (webregistries) and #088 ruling.
- **`src/_data/semantics.json`** — three new terms: *Content-Addressed Id*, *Pin Ladder*, *API-Contract Version*.

**Deferred (unchanged):** serve-path *emission* of the id/headers/metadata — there is no production serve path (`tools/maas/vite-plugin.ts` is dev-only). That realization lands with #087 (caching/distribution) and the Frontier UI runtime half (#390). This item resolves as **standards-authoring complete**; the serve-path build is tracked by #087/#390.
