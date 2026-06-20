---
kind: decision
size: 5
parent: "081"
status: resolved
dateOpened: "2026-06-06"
dateStarted: "2026-06-12"
blockedBy: ["081"]
dateResolved: "2026-06-12"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#constellation-placement"
preparedDate: "2026-06-11"
tags: [module-as-a-service, versioning, content-addressing, immutability, cache-key, semver, adapters, plateau, esm]
relatedProject: webadapters
crossRef: { url: /adapters/, label: Rendering Adapters }
---

# Versioning for served modules — what makes two served artifacts "the same"?

MaaS (#081) serves a component over `/_maas/…` in many forms but a served URL has **no version identity**
([we:tools/maas/vite-plugin.ts:80-118](tools/maas/vite-plugin.ts#L80-L118) resolves `name × form × target`
and serves with no hash, no cache header). Bytes can change underneath a consumer. **This is the
prerequisite for caching + distribution ([#087](/backlog/087-module-service-distribution-caching/))** —
you cannot cache-immutably something whose identity is undefined.

**Framing (the lens that collapses this).** WE supports *any coherent way to consume a served module* —
it does not mandate one pinning style or workflow. So most of what looked like "forks" are **not
decisions**: we support all coherent options and exclude only what is *actually broken*. That leaves
exactly **one forced invariant** and **one genuine product-scope choice**.

## The decision to make

**1 · The identity invariant — forced by correctness, ratify.**
A served artifact's version id = a **content hash of every input that determines its bytes**: the
authored definition + the transform/compiler version + the params (form/target/strategy). Same hash ⇒
same artifact, cache forever; any input moves ⇒ new id.
*The only excluded option is the broken one:* an identity rule that omits a byte-determining input (e.g.
ignores the `webadapters` core or compiler version) — it silently serves drifted bytes, which is the
exact failure versioning exists to prevent. This isn't a preference; it's the one rule that works.

**2 · Runtime-dependency coupling — the one real choice (both branches coherent).**
The functional form imports a bare specifier (`@frontierui/jsx-runtime`) resolved by the **consumer's**
import map — its version is outside the service's control, and *WE does not mandate the consumer's
toolchain*. So the artifact **declares a compatibility range against the runtime's public API contract**
(surfaced in metadata) — this is a consumer↔provider seam-contract, the same shape as
[#092](/backlog/092-provider-consumer-graph-platform-manager/). The genuine choice is **how far WE goes**:

- **A. Advertise-only** — surface the range as metadata; the consumer validates (or not) however it
  likes. Mandates nothing.
- **B. Advertise + ship an *optional* resolve-time validator** — the same range, plus a convenience tool
  a consumer can opt into to fail-loud on a mismatch.

Both are coherent (B is a superset convenience, not a mandate). *The only excluded option:* serving with
**no** compat contract at all (silent runtime mismatch). **Lean: B** — advertise the range and offer the
validator as opt-in, because the data is free to emit and a fail-loud option is cheap; but A is fully
legitimate if we want zero added surface now.

## Supported by default — not decisions (support all coherent, mandate nothing)

These looked like forks but aren't: WE supports every coherent option and only the id invariant above
constrains them.

- **Unit of version** — author semver on the definition *and* the derived content hash coexist (semver =
  human contract, hash = integrity contract; npm's tag→tarball model). Not either/or.
- **What the consumer pins** — floating tag *and* exact semver *and* content hash all supported, resolving
  floating → exact → content-addressed URL. Pin however you develop.
- **Provenance** — the service emits the producing core/compiler version (a response header beside
  `X-MaaS-Lossy`/`X-MaaS-Diagnostic` at [we:vite-plugin.ts:111](tools/maas/vite-plugin.ts#L111)) and folds it
  into the hash. Pure added metadata; consumers may ignore it.

---

## Context — what varies underneath a served URL

A served module is a function of independently-moving inputs; the id invariant above is just "the hash
covers all of them":

| Input | Moves when | Today's identity |
|---|---|---|
| **Authored definition** | author edits the component | none — resolver reads "current" fixture |
| **`webadapters` AST core** | the transform code changes (#081 anti-drift core) | none — implicit "latest" |
| **Form / target / strategy** | per request | query string only |
| **Compiler** (esbuild, #081 2b) | esbuild version/options change | none |
| **Runtime dependency** (`@frontierui/jsx-runtime`, #081 2c) | the package publishes | consumer's import map, unversioned |

## Context — sequencing & relationships

- **Sequence:** #081 (MaaS, **done**) → this → #087 consumes immutable content-addressed URLs (can't land
  `Cache-Control: immutable` / eager distribution before the id invariant is settled).
- Distinct from **#005** (spec/capability-manifest versioning) and **#033** (browser-substrate version
  verification) — this is *served-artifact* versioning.
- Ties to the render-strategy registry (#052/#078): the strategy is part of the artifact's identity, so
  it's a hash input, not a side channel.

## Resolution (2026-06-12)

**1 · Identity invariant — ratified.** A served artifact's version id = a content hash over **every
byte-determining input** (authored definition + transform/compiler version + params). Same hash ⇒ same
artifact (cache forever); any input moves ⇒ new id. The alternative (a rule that omits an input) is the
*broken* option — it serves drift — so this is a forced invariant, not a preference.

**2 · Runtime-dependency coupling — chose B (advertise + ship an opt-in validator), layered per the
constellation.** WE supports any coherent consumer toolchain and mandates none; the artifact declares a
runtime **API-contract-version range** in its metadata, and a consumer may opt into a checker that
fails-loud on mismatch. The layer split (WE = contract, Frontier UI = implementation):

- **WE (standard / protocol):** *defines the contract* — the identity-hash rule, the runtime
  compat-range metadata format, and what "satisfies" means (a consumer↔provider seam-contract, the same
  shape #092 generalizes). Vendor-neutral; the escapable lock.
- **Frontier UI (implementation):** *implements it* — `@frontierui/jsx-runtime` exports `__API_VERSION__`
  (the contract version, bumped only on public-API change, decoupled from package semver), and
  `@frontierui/maas-check` is the opt-in validator (CI/resolve-time check + optional load-time guard).
  Inert unless the consumer opts in.

**Everything else** (unit-of-version layering, the tag/semver/hash pin ladder, the provenance header)
is *supported by default*, not decided — see above.

**Graduated to:** the WE-layer versioning contract is realized by **[#389](/backlog/389-maas-served-artifact-versioning-content-hash-identity-pin-gr/)**
(serve impl: id-hash + pin grammar + provenance header + compat-range emission), which now blocks
**[#087](/backlog/087-module-service-distribution-caching/)** (caching needs the immutable URLs to
*exist*, so #087 is re-pointed `blockedBy: #088 → #389`); the Frontier UI half is
**[#390](/backlog/390-frontier-ui-jsx-runtime-api-contract-version-export-maas-che/)** (runtime export +
validator), blocked by #389.

**Graduated to** `none` — MaaS versioning contract — serve impl tracked by #389 (id-hash/pin/provenance/compat-range) + #390 (Frontier UI runtime export + maas-check validator).
