---
type: idea
status: open
dateOpened: "2026-06-06"
tags: [module-as-a-service, versioning, content-addressing, immutability, cache-key, semver, adapters, plateau, esm]
relatedProject: webadapters
crossRef: { url: /adapters/, label: Rendering Adapters }
---

# Versioning for served modules — what does a consumer pin, and what makes two served artifacts "the same"?

Module-as-a-Service (#081) serves a single authored component in many forms, transpile targets, and (soon) strategies — but a served artifact today has **no version identity**. A consumer that imports `/_maas/user-card.js?form=wc-class` re-fetches whatever the resolver produces *now*; there is no way to pin a known-good build, no guarantee that the bytes behind a URL never change, and no contract for what happens when the authored `<component>` definition, the `webadapters` transform, the compiler, or the runtime dependency moves underneath it. **Versioning is the prerequisite for caching and distribution (#087)** — you cannot cache-immutably or eager-distribute something whose identity is undefined.

The question this item resolves: **what is the unit of version, what does a consumer pin to, and what is the equivalence rule that says two served artifacts are identical?**

## What actually varies underneath a served URL

A served module is a function of several independently-moving inputs. Any of them changing should produce a *different* version; none of them changing should produce the *same* one (so caches stay valid):

| Input | Moves when | Today's identity |
|---|---|---|
| **Authored definition** (the `<component>` source) | the author edits the component | none — resolver reads "current" fixture |
| **`webadapters` AST core** | the transform code changes (the anti-drift core, #081) | none — implicit "latest" |
| **Form / target / strategy** params | per request | encoded in the query string only |
| **Compiler** (esbuild provider, #081 phase 2b) | esbuild version, options change | none |
| **Runtime dependency** (`@webeverything/jsx-runtime` for the functional form, #081 phase 2c) | the bare-specifier package publishes | resolved by the consumer's import map, unversioned |

So a single logical component has a **matrix** of served artifacts, and the version must compose: `(definition version) × (transform/compiler version) × (params)`. This is exactly the seam where an immutable, content-addressed URL belongs.

## Open decisions (recommendations in bold)

- **Unit of version.** Author-facing semver on the *component* vs. content hash of the *resolved artifact*. **Do both, layered: authors publish semver on the definition; the service derives an immutable content-addressed id (hash of definition + transform/compiler version + params) for each concrete artifact.** Semver is the human contract; the content hash is the cache/integrity contract. Mirrors how npm tags resolve to immutable tarballs.
- **What the consumer pins.** A floating tag (`@latest`, `@^1`), an exact semver (`@1.4.2`), or the content hash. **Support all three, resolving floating → exact → content-addressed URL** — the same `latest`/range/exact ladder consumers already understand, terminating in an immutable URL safe to cache forever (the #087 cache contract).
- **Equivalence rule.** When are two artifacts "the same" for cache reuse? **Same content hash ⇒ same artifact, period.** This makes the transform/compiler version a *first-class input to the hash*, so a `webadapters` core change correctly busts the cache instead of silently serving drifted bytes — the runtime extension of #081's single-core anti-drift guarantee.
- **Transform/compiler version provenance.** Whether the served response advertises which core/compiler produced it. **Carry it in a response header (alongside the existing `X-MaaS-Lossy`/`X-MaaS-Diagnostic`) and bake it into the content hash** — so a served artifact is self-describing and reproducible.
- **Runtime-dependency version coupling.** The functional form imports a bare specifier resolved by the consumer's import map; its version is *outside* the service's control. **Version the contract (the runtime's public API), not just the package, and surface a compatibility range in the served module's metadata** so a consumer's import map can be validated against what the artifact expects. This is the hard, still-open part.

## Dependencies / sequencing

1. **MaaS v1 + phases 2a–2c** (#081) — the thing being versioned exists and serves over HTTP. **Done.**
2. **This item** — define version unit, pin grammar, content-addressing, equivalence rule, and the provenance header.
3. **#087 (caching + distribution)** consumes this: immutable content-addressed URLs are what make `Cache-Control: immutable`, eager pre-distribution, and CDN fan-out sound. **#087 cannot land its cache contract before this resolves the equivalence rule.**

## Notes

- Distinct from the existing versioning items: **#005** is *spec/capability-manifest* versioning for the validation engine, and **#033** is *browser substrate* version verification. This is **served-artifact** versioning for MaaS — a different unit (a concrete transformed module, not a spec or a browser).
- Ties back to the render-strategy registry pattern (#052/#078): the strategy chosen is part of the artifact's identity, so it must be an input to the version hash, not a side channel.
