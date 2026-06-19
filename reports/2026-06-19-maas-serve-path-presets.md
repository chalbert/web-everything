# MaaS serve-path presets — prep research (decision #979)

**Date:** 2026-06-19 · **For:** [#979](../backlog/979-maas-serve-path-presets-named-bundle-of-params-instead-of-a-.md) ·
**Parent:** Block Explorer epic #746 · **Project:** webadapters ·
**Sibling:** wrapper-serve protocol [#974] (ratified A1) / standing review [#978] / FUI catalog [#977]

## The idea, and the prep's headline finding

#979 asks: as the MaaS serve-path param surface grows (`form`/`target`/`strategy` plus injected catalog
values), spelling out the full list on every request gets unwieldy — add a server-named **preset** that a
request names by id, expanding to a fixed param set the origin holds. Four design questions were deferred:
(1) where it lives (`preset` query param vs route segment), (2) neutral-contract vs injected catalog like
`form`, (3) how it composes with explicit params, (4) how it folds into the content-hash identity.

**Headline finding — the same shape #974 just landed: this is a reconciliation against the existing
`servePathIR`, not a greenfield protocol, and the recommended path mints _no new WE contract surface_.**
Tracing the real tree:

- **The identity question (Q4) is a forced invariant, fully settled by existing code.**
  [`computeArtifactIdentity`](../blocks/renderers/module-service/fetchHandler.ts#L114) hashes the
  *resolved* `{ definitionHash, compilerVersion, params{form,target,strategy} }` —
  [`we:fetchHandler.ts:121`](../blocks/renderers/module-service/fetchHandler.ts#L121). A preset is an alias
  that **expands to those params before identity is computed**, so identity is over the *expansion*, never
  the preset id. [`we:protocols.json#maas-versioning`](../src/_data/protocols.json#L178) names omitting a
  byte-determining input *"the one excluded (broken) option"* — and hashing the id *string* (so a
  redefined preset keeps its id while its bytes change) is exactly that broken option. No fork.

- **A preset is a _floating alias_, also forced.** An unpinned `?preset=<id>` behaves like any floating
  tag: `302` down the pin ladder ([`CACHE_POLICY.floating`](../blocks/renderers/module-service/servePathIR.ts#L49),
  maas-versioning §2) to the immutable hash of its current expansion. Redefine the preset → the floating
  request resolves to a *new* hash pin. The terminal URL carries the **expanded** params + `@pin`, never
  the preset id. This is the existing tag→hash machinery, reused unchanged.

- **The preset value-set is an injected origin catalog, never enumerated by WE** — exactly like `form`
  ([`we:servePathIR.ts:88-95`](../blocks/renderers/module-service/servePathIR.ts#L88), neutrality rule
  [`:21-24`](../blocks/renderers/module-service/servePathIR.ts#L21)). WE has no oracle for *what*
  `react-modern` expands to; that is the most origin-specific knowledge imaginable. Forced invariant.

What's left after the invariants: **one keystone fork** (does the neutral `servePathIR` name a `preset`
seam *at all*, or is it pure origin-side sugar?) plus two shape forks (composition; carrier-if-named).

## Prior art — named server-held param bundles are a settled CDN pattern

The "name a server-held bundle of serve params and reference it by id" pattern is ubiquitous in image/asset
CDNs. Three concrete precedents, all confirming the concept and lending vocabulary:

| System | Mechanism | Carrier | Composition with inline params |
|---|---|---|---|
| **Cloudflare Images** *variants* | a predefined named option set OR a comma-list of params; "a valid URL must specify either a variant or at least one parameter" | **path segment** (`…/<image-id>/<variant-or-options>`) | *flexible variants* also accept inline params |
| **Cloudinary** *named transformations* (`t_<name>`) | a codename for a saved param string (`c_scale,h_329,w_624` → `t_preview`) | **path segment** (slash-chained) | **composes** — chain `t_x` with inline params; `raw_transformation` appends literal params to the same component |
| **Akamai** *image policies* | a named server-side bundle of transformation params applied by policy id | query/header **policy id** | policy + per-request overrides |

**Lessons that shape the forks:**
1. **The concept is validated** — a short named token expanding to a held bundle is the mainstream design.
   Vocabulary: *variant* (Cloudflare), *named transformation* (Cloudinary), *policy* (Akamai).
2. **Composition is real and the modern default is override/append** (Cloudinary chaining + `raw_transformation`,
   Cloudflare flexible variants), with pure-exclusive (pick-one-variant) also in the wild — so Fork B (how a
   preset composes with explicit params) is a genuine fork, and the permissive override branch has precedent.
3. **Carrier is split in the wild** — Cloudflare/Cloudinary put the named token in a **path segment**, but
   those systems put *all* transform knobs in the path. Our grammar deliberately splits **identity**
   (the `<name>[@<pin>]` route) from **selection** (query params) and keeps value-sets *out* of the neutral
   contract. Against that grammar a query param is the consistent carrier; a route segment would fragment
   identity across path + pin. So Fork C is real but the alternative is weak *for our grammar specifically*.

Browser-standards survey: nothing in the platform standardizes a "named serve-param bundle" — this is an
origin-ergonomics layer, so the prior art that governs is the CDN precedent above plus WE's own
already-ratified neutrality discipline, not an MDN/WHATWG anchor. (Already-researched adjacent ground linked,
not re-run: polyglot-maas-origin #463, wrapper-serve #974, maas-versioning identity rule.)

## The WE-specific axis — placement against the neutrality seam (mirrors #974)

The CDN prior art validates *the mechanism*; it does not answer the only question that is WE's to settle:
**does the bundling mechanism cross the `servePathIR` neutrality seam into the neutral contract, or stay an
origin-side convenience?** This is the exact axis #974 just ratified for the framework value (A1 — no new
neutral surface), and the same three legs largely apply:

- **Conformance-consumption (the #974 leg-1 test).** A WE conformance vector (#506) consumes the
  *catalog-gated seam* (in-catalog → 200, unknown → 400) and the *resolved request*, both of which are
  identical whether a preset is a WE-named param or an origin-internal expansion that 302s. **But here the
  inversion is _weaker_ than in #974**: a preset has one oracle-free, value-set-blind assertion WE *could*
  own that the framework axis lacked — *"`?preset=P` resolves to the same hash pin as P's spelled-out
  expansion."* That is a real incremental conformance surface, which is why Fork A is closer to a genuine
  50/50 than #974's was, and is the flag for the deciding skeptic.
- **Minimize-lock-in / WE = contracts-only.** Presets-as-origin-convenience add **zero** contract surface
  and are fully reversible (the origin adds/removes/redefines presets freely). Naming a neutral `preset`
  param freezes a mechanism into the `version: '1.0.0'` IR ([`we:servePathIR.ts:132`](../blocks/renderers/module-service/servePathIR.ts#L132)).
- **Provisional posture (#974/#978).** The live surface is just three params
  ([`we:servePathIR.ts:138-156`](../blocks/renderers/module-service/servePathIR.ts#L138)) — not yet
  "unwieldy." #979 itself says "likely a deliberate `servePathIR` version bump if it lands." The
  minimal-commitment path is to settle the *shape* now and gate the *neutral-surface* build on #978
  showing real param-list pain.

## Recommended defaults (full options + tradeoffs are authored into #979)

- **Fork A (keystone) — presets are a pure origin-side convenience; WE names nothing** (~60%). Origin
  accepts `?preset=<id>`, expands to `form/target/strategy` before identity, 302s to the expansion's hash
  pin. #979 then yields **no WE artifact** (parallel to #974's A1). Skeptic flag: the preset-expansion
  equivalence assertion is a real argument for the alternative (a WE-named catalog-gated `preset` param) —
  weigh it at decision time.
- **Fork B — explicit params override the preset's values** (~70%, most-permissive default; Cloudinary/
  Cloudflare precedent). Exclusive and strict-merge are the coherent alternatives (cleaner identity story,
  the author's opt-in restriction).
- **Fork C (conditional on A's alternative) — if WE ever names the seam, it's a query param** (~80%), not
  a route segment; route is identity-reserved, every other knob is a query param.

## Constellation placement (settled, inherited)

Neutral contract → **WE** (`servePathIR`, touched only under Fork A's alternative). Preset expansion table +
parse/expand step + the served runtime → **FUI / the origin** (#855/#817 — runtime never crosses the WE→FUI
seam). Hosted serve → **plateau-app** (#091/#398). Under the recommended A-default, #979's artifact is a
one-line doc note + an entry in #978's cases-log, not a protocol change.
