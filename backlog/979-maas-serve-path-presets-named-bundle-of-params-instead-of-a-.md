---
type: decision
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: none
preparedDate: "2026-06-19"
relatedReport: reports/2026-06-19-maas-serve-path-presets.md
researchTopic: maas-serve-path-presets
relatedProject: webadapters
parent: "746"
tags: [maas, polyglot, protocol, ergonomics]
---

# MaaS serve-path presets — named bundle of params instead of a long query list

As the MaaS serve-path param surface grows (`form`/`target`/`strategy` plus injected catalog values like
`react-wrapper`, and whatever experience adds — see [#978](/backlog/978-maas-wrapper-serve-protocol-deferred-experience-review-collec/)),
passing the full list on every request gets unwieldy. Add a server-named **preset** — a request names one
preset id that expands to a fixed param set the origin holds, instead of spelling out every param.

> **Prep digest (2026-06-19).** The prior-art pass
> ([research topic](/research/maas-serve-path-presets/) ·
> [report](../reports/2026-06-19-maas-serve-path-presets.md)) traces the real tree and finds the same shape
> [#974](/backlog/974-define-the-maas-wrapper-serve-protocol-cem-framework-wrapper/) just landed: a
> **reconciliation against the existing `servePathIR`, not a greenfield protocol**, whose recommended path
> mints **no new WE contract surface**. Two of the four deferred questions collapse to **forced invariants**
> settled by existing code (identity hashes the *expansion*; a preset is a *floating alias*). What's left is
> **one keystone fork** (does the neutral contract name a `preset` seam at all?) plus two shape forks
> (composition with explicit params; carrier, if named). Named server-held param bundles are a settled CDN
> pattern (Cloudflare *variants*, Cloudinary *named transformations*, Akamai *image policies*) — the concept
> is validated; the only WE-owned question is placement against the neutrality seam, exactly as in #974.
> **Provisional — the live surface is just three params, not yet "unwieldy"; settle the shape, gate the
> build on #978-evidence.**

## The axis

A preset is a **named, origin-held bundle of serve params, referenced by id** — `?preset=<id>` standing in
for `form=…&target=…&strategy=…`. The CDN prior art (Cloudflare *variants*, Cloudinary `t_<name>`, Akamai
*policies*) validates the *mechanism*; none of it answers the only question that is WE's to settle: **does
the bundling mechanism cross the [`servePathIR` neutrality seam](../blocks/renderers/module-service/servePathIR.ts#L21)
into the neutral contract, or stay an origin-side convenience?** That is the same axis #974 just ratified for
the framework value (A1 — *no new neutral surface*). Two of #979's four questions never reach a fork: identity
is fixed because [`computeArtifactIdentity`](../blocks/renderers/module-service/fetchHandler.ts#L114) hashes
the **resolved** `{ definitionHash, compilerVersion, params{form,target,strategy} }`
([`we:fetchHandler.ts:121`](../blocks/renderers/module-service/fetchHandler.ts#L121)) — a preset expands to those
params *before* identity is computed, and [`maas-versioning`](../src/_data/protocols.json#L178) makes hashing
anything *but* the expansion the one broken option; and a preset is a floating alias that `302`s down the pin
ladder ([`CACHE_POLICY.floating`](../blocks/renderers/module-service/servePathIR.ts#L49)) to the hash of its
current expansion. So the live forks are placement, composition, and (conditionally) carrier.

### Recommended path at a glance

> **Provisional — the soft/revisitable end of the spectrum, like #974.** Settle the *shape* now; gate the
> *neutral-surface* build on the [#978](/backlog/978-maas-wrapper-serve-protocol-deferred-experience-review-collec/)
> cases-log showing real param-list pain. Promotion to a WE-named `preset` param would be a deliberate
> `servePathIR` `1.0.0 → 1.1.0` bump (this item itself says "likely a deliberate `servePathIR` version bump
> if it lands"). **Fork A is the high-leverage call — flag for the deciding agent's skeptic pass.**

| Fork | Options (**bold** = recommended default) | Main alternative & why weaker | Confidence |
|---|---|---|---|
| **A — if WE names a preset surface, what is it?** *(recast — see Reframe below)* | A1 — origin-private convenience, WE names nothing (the *floor*, always available) · A2 — bare `preset` param, value-set origin-injected · **A3 — `preset` id resolves against the npm registry: a config-exporting package (eslint-config pattern) → presets portable across providers** | A1 can't be portable at all; A2 pays for a `1.0.0` IR addition without buying portability. A3 is the only option delivering cross-provider portability and is maximally WE-shaped — WE owns only the config-export *schema* (a contract), npm is the registry, package authors own the catalog → zero new lock-in. | ~75% (A3 over A2 as the eventual surface) |
| **B — composition with explicit params** | **B1 — explicit params override the preset** · B2 — exclusive (conflict → 400) · B3 — strict merge (re-spec → 400) | B1 is most-permissive (restriction is the author's opt-in) and has CDN precedent (Cloudinary append, Cloudflare flexible variants); B2/B3 are coherent but trade ergonomics for a marginally cleaner identity story that the expand-then-hash invariant already gives B1 anyway. | ~70% |
| C — carrier *(now live & forced under A3)* | **C1 — query param `?preset=<id>`** · C2 — route segment | C2 (Cloudflare/Cloudinary path-token precedent) fragments identity across path + `@pin` and breaks WE's deliberate identity/selection split; every other knob is a query param. **A3 forces C1** — portability requires a stable, standard carrier. | ~80% |

### Ruling (ratified 2026-06-18): A3 + B1 + C1, build gated on #978

**A3** is the ratified WE direction (A1 = free floor, A2 collapsed); **B1** (explicit params override) and **C1**
(`?preset=<id>` carrier, forced by A3) stand. **The build is gated on [#978](/backlog/978-maas-wrapper-serve-protocol-deferred-experience-review-collec/)
real-case evidence — this settles a direction, not a now-build.** Skeptic pass (inline) cleared YAGNI /
impl-is-not-a-standard / minimize-lock-in / npm-scope; it surfaced one refinement, now folded in:

> **The portability lock is the config *schema*, not npm.** The schema is registry-**agnostic**; npm is the
> native-first *default* registry, but a conforming provider MAY resolve the package config from JSR / a URL / any
> registry. This sharpens minimize-lock-in (the only lock is an escapable schema) and avoids over-committing the
> contract to one registry.

Follow-up build captured as a blocked item (blockedBy #978).

### Reframe (2026-06-18): a preset resolves against a *registry*, and WE has none to offer — so reuse npm

The prepared Fork A asked "does WE's neutral contract name a `preset` *param*?" That under-frames it. A preset id is
meaningless without a **registry to resolve it against**, and WE owns no registry. So the standard-worthy question is
not "name a param" but **"against what registry does a preset id resolve, and is that resolution portable across
providers?"** A2's "origin-injected value-set" still leaves every provider with a private, non-portable table — it
names a seam without delivering the one thing portability needs.

**A3 — preset id = an npm package whose main export is a serve-param config (eslint-config pattern).** WE owns only
the **config-export schema** (a contract: a package's default export is a declarative `{form,target,strategy,…}`
object); **npm is the registry** (native-first — we invent nothing) and **package authors own the catalog**. This is
the only option that makes `?preset=maas-preset-react` mean the same thing at *any* conforming provider — the
portability that matters when you consume a module from an *external* provider. Zero new lock-in (npm is the escapable
registry; the schema is the only, escapable, lock). npm **versioning gives preset pinning for free** —
`preset=pkg@1.2.0` (pinned) vs `preset=pkg` (floating) maps onto the existing pin ladder, strengthening invariant #2.

Settled sub-knobs under A3:
- **Declarative, not executable.** The exported config is static, JSON-serializable params — never runnable code.
  Keeps server-side resolution safe and the preset genuinely portable. *Fixed.*
- **Private/commercial precedence.** Provider-private presets live under a **reserved sigil** that cannot collide with
  an npm name and **shadows** npm resolution (the commercial-MaaS private-preset case). WE defines the *precedence
  rule*; it owns neither catalog. *Knob — refine under #978.*
- **Provider support policy** (resolve any package vs whitelist) stays **origin-side** — WE names the resolution
  contract, not the allow/deny policy (parallels the catalog invariant #3).

**A1 is not a competing branch — it is the floor:** origin-private convenience needs no WE surface and ships today.
A3 is the named *direction*; the **A3 contract build stays gated on [#978](/backlog/978-maas-wrapper-serve-protocol-deferred-experience-review-collec/)
real-case evidence**, exactly as the provisional posture requires. This ruling settles a *direction*, not a now-build.

Cascade: A3 makes **Fork C live and forces C1** (portability needs a stable carrier). **Fork B unchanged → B1.**
Invariant #3 recasts: the registry is **npm (public, portable) + an optional origin-private overlay**, not an
origin-only table — but WE still enumerates nothing (it has no oracle), so the spirit holds.

## Supported by default (forced invariants — not forks)

Each names no excluded-yet-coherent alternative; the alternative is *broken*, so these ratify rather than fork:

1. **Identity hashes the _expansion_, never the preset id.**
   [`computeArtifactIdentity`](../blocks/renderers/module-service/fetchHandler.ts#L114) hashes the resolved
   `{form,target,strategy}` ([`:121`](../blocks/renderers/module-service/fetchHandler.ts#L121)); a preset is
   resolved to those params *before* identity. Two presets that expand identically → the same artifact id;
   redefining a preset's expansion → a new id via the pin ladder. Hashing the id *string* is the broken
   branch [`maas-versioning`](../src/_data/protocols.json#L178) explicitly excludes (same id, changed bytes =
   drift). **This settles #979 sub-question (4) with no fork.**
2. **A preset is a _floating alias_.** An unpinned `?preset=<id>` behaves like any floating tag: `302` down
   the pin ladder ([`CACHE_POLICY.floating`](../blocks/renderers/module-service/servePathIR.ts#L49),
   maas-versioning §2) to the immutable hash of its current expansion. The terminal artifact URL carries the
   **expanded** params + `@pin`, never the preset id. Reuses the existing tag→hash machinery unchanged.
3. **Preset expansions are an injected origin catalog, never enumerated by WE.** Even under A2 only the
   *seam* is neutral — exactly like `form`
   ([`we:servePathIR.ts:88-95`](../blocks/renderers/module-service/servePathIR.ts#L88), neutrality rule
   [`:21-24`](../blocks/renderers/module-service/servePathIR.ts#L21)). WE has no oracle for what
   `react-modern` expands to; that is the most origin-specific knowledge imaginable. **Settles #979
   sub-question (2)'s value-set half** — the only live part is whether the *seam* is named (Fork A).
4. **Unknown preset → 400**, catalog-gated, same shape as an unknown `form`
   ([`we:fetchHandler.ts:204-209`](../blocks/renderers/module-service/fetchHandler.ts#L204)) — materialises as a
   WE-named response only under A2; under A1 it is the origin's own 400.
5. **Constellation placement.** Neutral contract → **WE** (touched only under A2). Preset expansion table +
   parse/expand step + the served runtime → **FUI / the origin** (#855/#817 — runtime never crosses the
   WE→FUI seam). Hosted serve → **plateau-app** (#091/#398).

## Fork A — does WE's neutral contract name a `preset` seam at all?

*Fork-existence: A1 and A2 genuinely cannot coexist — either the neutral `servePathIR` carries a `preset`
param (a frozen contract addition) or it does not (the mechanism lives wholly in the origin). Both are
coherent end-states, so this is a real either/or, not a forced invariant.*

- **A1 — presets are a pure origin-side convenience; WE names nothing (recommended default, ~60%).** The
  origin accepts `?preset=<id>`, expands it to `form/target/strategy`, and from then on every byte, the
  identity, the cache, the headers, and the errors are the **existing expanded-param behaviour** the IR
  already describes. From WE's conformance view a preset request is byte-identical to its expansion, which
  the #506 vectors already cover, so the neutral contract needs to name **nothing new**. **#979 then yields
  no WE artifact** (parallel to #974's A1): the whole mechanism is a FUI/origin expansion table + a parse
  step. This is the minimal-commitment, minimize-lock-in, fully-reversible path, and matches the provisional
  posture — start cheap, promote to A2 only when experience demands.
  **Skeptic flag (the high-leverage residual):** the #974 leg-1 conformance-consumption inversion is
  *weaker* here. Unlike the framework value, a preset has **one oracle-free, value-set-blind assertion WE
  *could* own** — *"`?preset=P` resolves to the same hash pin as P's spelled-out expansion."* That is a real
  incremental conformance surface the framework axis lacked, so Fork A is closer to a genuine 50/50 than
  #974's was. The deciding skeptic must weigh whether that single assertion earns the IR addition, or whether
  it is better left as an origin-level property collected as experience under #978.
- **A2 — name a catalog-gated `preset` param in `servePathIR`** (seam neutral, value-set injected,
  unknown→400) — structurally identical to how `form` is handled today. Buys discoverability (the OpenAPI
  projection documents it) and the expansion-equivalence conformance assertion above, and tells a
  forward-adapter (#507) to implement preset expansion. Weaker because it freezes a bundling mechanism into
  the `version: '1.0.0'` IR ([`we:servePathIR.ts:132`](../blocks/renderers/module-service/servePathIR.ts#L132))
  for a three-param surface that is not yet unwieldy — the YAGNI/over-engineering risk the IR author
  deliberately guards against by keeping value-sets out of the neutral contract. If A2 is later warranted,
  it is a clean `1.0.0 → 1.1.0` bump with experience to justify it.

## Fork B — how a preset composes with explicit params

*Fork-existence: B1/B2/B3 give genuinely different answers to the same request (`?preset=P&target=es2015`)
and cannot coexist — a conflicting param is either an override, an error, or a strict-merge rejection. All
three are coherent, so this is a real either/or.*

- **B1 — explicit params override the preset's values (recommended default, ~70%).** `?preset=P&target=es2015`
  expands `P` then overrides `target` — the "base preset + tweaks" ergonomic that makes presets worth having.
  Most-permissive (the restriction is the author's opt-in, per the most-flexible-default principle) and has
  direct CDN precedent (Cloudinary `raw_transformation` append, Cloudflare flexible variants). Identity stays
  clean: the override resolves to a final expanded param set *before* the expand-then-hash invariant runs, so
  there is no identity cost over the stricter options.
- **B2 — exclusive: naming a preset forbids explicit byte-params (conflict → 400).** The cleanest "a preset
  *is* the request" story, but it throws away the base-plus-tweaks ergonomic and surprises a caller who adds
  one knob. Coherent, but the restriction belongs as an author opt-in, not the default.
- **B3 — strict merge: a preset fills unset params; re-specifying a preset-set param → 400.** A middle
  ground that still rejects the most natural "override one knob" request, so it carries B2's surprise without
  B2's simplicity.

## Fork C — carrier, *conditional on A2*

*Fork-existence: a request names the preset in exactly one place — a query param or a route segment — and
the two cannot coexist. Live only under A2 (if WE names nothing, the carrier is the origin's call, and even
there a query param by consistency); both are coherent URL designs, so it is a real either/or under A2.*

- **C1 — query param `?preset=<id>` (recommended default, ~80%).** Every other knob (`form`/`target`/
  `strategy`) is a query param, and the route `<name>[@<pin>]`
  ([`we:servePathIR.ts:134`](../blocks/renderers/module-service/servePathIR.ts#L134)) is reserved for identity.
  A preset is a *selector*, so it rides the selection surface; Akamai's policy-id precedent is query/header,
  not path.
- **C2 — route segment `/_maas/<preset>/<name>@<pin>.js`.** Cloudflare/Cloudinary precedent puts the named
  token in the path — but those systems put *all* transform knobs in the path. Against WE's grammar a route
  segment fragments identity across the path *and* the `@pin`, breaking the deliberate identity/selection
  split. Coherent but weaker for our grammar specifically.

## Worked example (A1 — preset as an origin-side floating alias)

Illustrative trace against the existing grammar; **provisional** — refine as #978 surfaces real cases. The
preset never appears on the terminal URL; it expands to params, which fold into the hash exactly as a
spelled-out request would.

```http
GET /_maas/date-picker.js?preset=react-modern
→ 302 Found
# origin expands react-modern → form=react-wrapper&target=es2022&strategy=…, hashes the EXPANSION:
Location: /_maas/date-picker@sha256-Ab3x...9Qk.js?form=react-wrapper&target=es2022&strategy=…
Cache-Control: public, max-age=60, must-revalidate         # CACHE_POLICY.floating — preset is a floating alias

# B1 (override) — tweak one knob off the base preset:
GET /_maas/date-picker.js?preset=react-modern&target=es2015
→ 302 Found
Location: /_maas/date-picker@sha256-C4d2...mN0.js?form=react-wrapper&target=es2015&strategy=…   # different bytes → different id
```

Cross-refs: provisional protocol ruling [#974], standing experience review [#978], FUI catalog registration [#977].
