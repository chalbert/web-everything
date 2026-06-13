# App Shell + Micro-App Compatibility Map — survey & fork analysis

> Prior-art survey grounding backlog **#104**'s three open forks (home, compatibility-chart
> schema, memory-eviction model). The item descends from the archived design essay
> (`reports/2026-06-06-front-end-platform-book.md`, *Micro Apps / Ideal micro-apps setup*,
> lines 364–423) and has **no design yet** — this report gathers web-platform and industry
> prior art per design-first step 1 so the schema reuses established vocabulary
> (browser-compat-data, semver, the Storage eviction model) instead of coining terms.
>
> **Revision 2026-06-13 — deep prior-art pass.** A first cut (rev. 2026-06-11) claimed "none
> ships a declared, introspectable compatibility chart per app." A deeper survey of
> **Module Federation 2.0** (the `mf-manifest.json` + runtime era), **Native Federation**,
> **Piral**, **qiankun**, **Luigi**, **Bit**, plus the classic declared-range resolvers
> (**npm peerDependencies / engines**, **OSGi**, **Kubernetes version-skew**) shows that claim
> is **wrong as stated** — declared manifests *and* rendered dependency graphs already exist.
> What survives, narrowed and sharpened, is the real novelty (Finding 1 below). The schema fork
> is now much more concretely grounded; see Findings 3a/3b.

## TL;DR — what the deep pass changed

- **The novelty is narrower than "a declared chart."** MF2's `mf-manifest.json`, Native
  Federation's `remoteEntry.json`, Piral's feed/`PiletMetadata`, and Bit's rendered dependency
  graph are all declared, introspectable manifests — *for the shared-library-version dimension*.
  The defensible white space is a **declared *coexistence* contract**: version ranges **plus**
  DOM-level claims (custom-element tag-names, global `window` claims, route ownership, CSS
  namespace) that a platform statically resolves and **renders as a map**. No surveyed tool
  declares those DOM-level claims; the ones that *solve* them (qiankun, Luigi) do it by **enforced
  isolation (JS sandbox / iframe)**, never by a declared, mapped contract. (Findings 1, 6.)
- **"Shared library version negotiation" ≠ "app coexistence."** MF/Native-Federation/single-spa
  /vite-federation all negotiate shared *library versions* only. Globals, tag-names, CSS, routes
  are out of scope for every one of them. That distinction is now the spine of the schema fork.
- **Fork 2 (schema) gets concrete shape.** Declare flat using the **npm `peerDependencies` +
  semver** dialect authors already know, add **OSGi-style namespaced claims** for the DOM
  dimension, and **compute** the BCD-style matrix as the rendered view — because BCD is itself a
  *curated/computed* artifact, never declared by implementers (Finding 3b). Borrow the **Kubernetes
  three-state, asymmetric** model: `supported / supported-but-flagged(degraded) / unsupported`, with
  shell-newer-than-required a forward-compat zone and shell-older a hard fail (Finding 3d).
- **Fork 1 (home) is reinforced, not changed.** **Zephyr Cloud** — a deployment/version control
  plane *over* MF's manifest — is concrete proof the "live map as a product over the manifest +
  graph" leg is viable; and MF's lesson that *one manifest is the single seam both the resolver and
  the visualization read* is exactly the protocol-vs-product split (Finding 7).

## The question

The essay asks for a **thin App Shell** (meta-framework, little/no dependency) that loads
independently-developed **micro-apps** as pages of one SPA. On navigation the shell decides
whether the next page loads **in the same SPA** (compatible) or needs a **hard refresh**
(incompatible), and dedupes already-loaded bundles. The Platform then exposes a
**compatibility map** that surfaces apps worth converting. Three things are undesigned:
(1) **where this lives** — a standard protocol vs. a Plateau product; (2) the
**compatibility-chart schema** each micro-app declares; (3) the **memory/eviction model**
for a long-lived single SPA. The essay flags all three and leaves them open
(`reports/2026-06-06-front-end-platform-book.md:406,410–412`).

## Finding 1 — the gap is *coexistence* declaration, not "a declared chart"

The **App Shell architecture** (a minimal HTML/CSS/JS frame, cached, that hosts dynamically
loaded content) is a well-known PWA pattern, and the micro-frontend variants that load multiple
independently-built apps into one shell are mature. The deep pass corrects the first cut's claim
that "none ships a declared, introspectable chart" — several do, *for the version dimension*:

- **single-spa** — a root config registers applications with `activeWhen` route predicates and
  abstracts each app's `bootstrap/mount/unmount` lifecycle; multi-framework on one page. Shared
  deps resolve via **import maps** or SystemJS. *No per-app manifest* (deps are a central import
  map), *no compatibility introspection*, *no isolation* — it deliberately delegates all
  coexistence concerns to the operator. Closest structural analog to the essay's shell.
- **Webpack/Rspack Module Federation (MF2)** — ships **`mf-manifest.json`**, a machine-readable,
  *introspectable* per-remote manifest (`exposes` / `shared` with `version`/`requiredVersion`/
  `singleton`/`strictVersion` / `remotes` / `metaData` / `types`), **and** a Chrome DevTools
  extension that renders the federated **dependency graph** computed from those manifests
  ([manifest-fields](https://module-federation.io/configure/manifest-fields);
  [chrome-devtool](https://module-federation.io/guide/debug/chrome-devtool)). So a declared,
  introspectable manifest + rendered graph already exists — *but only over shared library
  versions* (Finding 2/6).
- **Native Federation** (Angular Architects) — the standards-based (ESM + import maps, esbuild,
  bundler-agnostic) reimplementation of MF's model; emits per-remote `remoteEntry.json` + a host
  `federation.manifest.json`, same `singleton`/`strictVersion`/`requiredVersion` negotiation
  ([README](https://raw.githubusercontent.com/angular-architects/module-federation-plugin/main/libs/native-federation/README.md)).
  This is the direction most aligned with WE's native-first stance.
- **import maps** — the native substrate: a JSON map from bare specifier → URL, with **`scopes`**
  for per-path version coexistence; `import-map-overrides` swaps a micro-app's resolved URL at
  runtime without rebuild ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap)).

**Corrected key takeaway:** declared manifests and rendered graphs **do** exist — what none of
them declares is a **coexistence** contract beyond library versions. The genuinely novel artifact
#104 is about is a **per-app declared coexistence contract** — required shell/provider version
*ranges* **plus** DOM-level claims (custom-element tag-names, `window` globals, route ownership,
CSS namespace) — that a Platform statically resolves and **renders as a compatibility map** over
the relationship graph (**#092**, `backlog/092-provider-consumer-graph-platform-manager.md:17`).
The tools that *negotiate versions* ignore the DOM dimension; the tools that *solve* the DOM
dimension (qiankun, Luigi — Finding 6) do it by enforced isolation, never by a declared, mapped
contract. That intersection — declared + DOM-dimension + mapped — is the white space.

## Finding 2 — the coexistence verdict is *computed* from declared facts (MF is the proof)

The shell's same-SPA-vs-hard-refresh decision reduces to: *can the new page's required
provider/shell versions coexist with what is already mounted?* Three sources of incompatibility
recur across the prior art:

1. **Shell/Platform API version** — the new app requires shell ≥ X; the running shell is older
   → run on an older shell or hard-refresh (the essay's exact scenario,
   `reports/2026-06-06-front-end-platform-book.md:1426`).
2. **Shared-dependency version conflict** — two mounted apps demand incompatible singleton
   versions of the same provider (Module Federation's `singleton`/`strictVersion` failure mode).
3. **Conflicting globals / side effects** — the essay's "avoid conflicts" requirement
   (`:404`); two apps that both claim a global, a custom-element tag name, or a route.

**MF already computes the verdict for source #2 — and shows the policy fork.** Within a named
*share scope*, MF's resolver does exactly the coexistence decision, per shared dependency
([configure/shared](https://module-federation.io/configure/shared);
[webpack#10960](https://github.com/webpack/webpack/pull/10960)):

| Situation | MF behavior | Shell analog |
|---|---|---|
| Loaded copy satisfies `requiredVersion` | reuse | coexist in same SPA, no reload |
| Not satisfied, `singleton: false` | load a **second copy** | coexist with duplication |
| Not satisfied, `singleton: true`, loose | use highest, **warn** | coexist but risky (one wins) |
| Not satisfied, `singleton: true` + `strictVersion` | **throw / fail** | cannot coexist → hard refresh |

Two lessons for #104: (a) the verdict is **computable from declared facts** — you don't hand-author
the pairwise map, you *derive* it; MF's DevTools graph is literally "the compatibility map computed
over the manifests." (b) MF defaults to **load-and-warn**, not refuse — "cannot coexist" only fires
under explicit `singleton + strictVersion`. So **default-soft vs default-hard is a real policy
fork** the shell must decide consciously (npm's `engine-strict` is the same lever: advisory by
default — Finding 3a).

**But "every provider individually satisfiable" ≠ "the whole graph is consistent."** OSGi's `uses`
constraint (Finding 3c) is the warning: a *singleton* shared provider forces **all** active apps onto
one resolved version, so the map must compute the **intersection of every active app's range against
the single resolved version**, not pairwise satisfaction in isolation. Import-map **scopes** sidestep
this for *isolatable* providers (each app gets its own version); a singleton reintroduces the
intersection constraint. Whether a provider is singleton or isolatable is therefore a per-provider
property the schema must carry.

WE already owns the *bytes-and-versions are npm/git* stance and the **provider↔consumer graph** as
the control plane (#092). A compatibility chart is therefore not a new registry — it is a
**declaration each app contributes to that graph** plus a **resolver** that computes coexistence. The
`changelog-manifest` protocol already standardizes per-module semver severity + migration linkage
(`src/_data/protocols.json:86`); the compatibility chart is its forward-looking dual: not *what
changed* but *what I require to run here*.

## Finding 3a — declared-manifest shape: npm `peerDependencies` + OSGi-namespaced claims

The most *directly analogous* declaration is the **npm plugin-needs-host** model — exactly "I
require the shell/providers in range Y" ([Node.js peer-deps](https://nodejs.org/en/blog/npm/peer-dependencies);
[npm package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/)):

- **`peerDependencies`** `{ name: range }` — the plugin-needs-host relation. The exact analog of
  "required shared-provider P in range Z." Best practice: **lenient ranges** (`^1.0`, `1.x`), not
  pinned patches — adopt as authoring guidance.
- **`peerDependenciesMeta` `{ optional: true }`** — an *optional* provider; the app degrades but
  still loads if absent.
- **`engines`** `{ … }` — the runtime-version requirement, **advisory by default** unless
  `engine-strict` (the warn-vs-block policy knob, ref. Finding 2's default-soft fork).
- **semver range syntax** (`^`, `~`, `>=`, `||`, x-ranges, `≤`) — the lingua franca authors know;
  reuse it verbatim (it's already the `changelog-manifest` vocabulary).

For the *DOM-dimension* claims that no version-sharing tool models, **OSGi's
`Require-Capability` / `Provide-Capability`** is the precise prior art
([OSGi Core 7](https://docs.osgi.org/specification/osgi.core/7.0.0/framework.module.html)): a
**namespace** is the dependency *type*, a capability declares typed attributes, a requirement
carries a filter. Each coexistence dimension becomes a namespace: `provider` (version range, the
npm peer analog), `tag-name`, `route`, `global` — a second claimant on the same key is a *namespace
collision*, detected separately from version mismatch. (Tag-name collision is also enforced natively
— `customElements.define` throws on re-register — so the shell can pre-detect it.) This yields a
**flat per-app manifest**, MF-shaped: an MF `shared`-style `providers` block (semver ranges +
`singleton`/`optional`) plus sibling `claims` namespaces (`globals` / `tagNames` / `routes`) that
negotiate the same way.

## Finding 3b — render the matrix in BCD's *shape*, but **compute** it (BCD is curated, not declared)

**MDN browser-compat-data (BCD)** is the right *render target*: a `support` map keyed by agent,
each statement carrying `version_added` (incl. ranged `"≤50"`), `version_removed`,
`partial_implementation` (boolean), `flags`, and a `status` object
(`experimental`/`standard_track`/`deprecated`), with **Baseline** as the rolled-up traffic-light
tier over the grid ([BCD schema](https://github.com/mdn/browser-compat-data/blob/main/schemas/compat-data-schema.md);
[web.dev/baseline](https://web.dev/baseline)). The transferable cell vocabulary —
supported / **partial** / behind-flag / removed / unknown — is the proven state set, and
`partial_implementation` is exactly the essay's "runs on an older shell, flagged on the dashboard"
(`:1426`).

**Crucially, BCD is *curated/observed by third parties*, not declared by implementers** — browser
vendors do **not** ship a BCD file describing their own support; contributors research and record
it ([BCD repo](https://github.com/mdn/browser-compat-data)). This decides the altitude fork:
micro-apps should **not author a BCD-shaped matrix**; they declare the **flat ranges + claims**
of Finding 3a, and the **shell computes** the BCD-shaped matrix by intersecting each app's declared
ranges/claims against the known set of shell + provider versions. A `partial`/`flagged` cell is
*derived* (from a `degradeOn` hint + the skew rules of Finding 3d), never hand-written per shell
version. **Declare flat; render rich, computed.**

## Finding 3c — OSGi: the resolver lesson (`uses` / class-space consistency)

OSGi is the deepest declared-range resolver in the wild, and its `uses` constraint is the lesson
the shell's resolver must encode
([OSGi Core 7](https://docs.osgi.org/specification/osgi.core/7.0.0/framework.module.html)).
`Import-Package` carries a version **range**, `Export-Package` a version **value**; they match when
the export falls in the range. But a `uses:=` constraint propagates: if package `p` *uses* `q`,
every consumer of `p` is forced onto the *same* `q` instance — so a consumer wanting a different `q`
**cannot resolve**, even though `q` alone has a satisfying provider. The takeaway for #104: a
**singleton shared provider** creates exactly this global intersection constraint — the map must
compute the **intersection of all active apps' ranges against the one resolved version**, not
per-pair satisfaction. (`Require-Capability`/`Provide-Capability` is also the generic namespace
model already borrowed in Finding 3a for the DOM-dimension claims.)

## Finding 3d — Kubernetes version-skew: the three-state, asymmetric window

Kubernetes is the strongest analog for the essay's "app on an older shell, flagged" scenario
([k8s version-skew-policy](https://kubernetes.io/releases/version-skew-policy/)). Components run at
different versions within a **declared supported skew window**, with the API server (≈ the shell)
as the reference point. Two lessons transfer directly:

- **The window is asymmetric.** A component may *lag* the reference (kubelet up to 3 minor behind)
  but generally **may not lead** it. The shell analog: *shell newer than the app declared* is a
  **forward-compat zone** (allow, maybe flag) — only *shell older than the app requires* is a hard
  fail. The schema must distinguish the two directions, not treat any mismatch as failure.
- **Three states, not two**, with a backstop: `supported` / `supported-but-flagged (degraded)` /
  `unsupported`; and a component persistently at max skew **must be upgraded before the next
  control-plane bump**. The shell analog: an app on the oldest-supported shell runs but is flagged,
  and *blocks the next shell upgrade* until it catches up. This is the richer state model #104's map
  should render (and it matches BCD's `partial_implementation`, Finding 3b).

## Finding 4 — eviction prior art: the Storage model (best-effort/persistent + LRU)

A long-lived single SPA accreting micro-apps faces the essay's open problem: *"you cannot load
stuff infinitely, even if conflicts are managed"* (`:406`). The web platform already specifies a
graceful-degradation eviction model worth borrowing — the **Storage API eviction model**:

- Two **persistence classes**: **best-effort** (default; evictable under pressure) and
  **persistent** (opt-in via `navigator.storage.persist()`; skipped by eviction).
- Under pressure, the browser evicts **least-recently-used (LRU)** best-effort origins first.
- A **quota** (e.g. ~the device budget) bounds the total.

Mapped onto the shell: a mounted micro-app is a unit with a **persistence class** (pin
the current route / a "keep-alive" app; let background pages be evictable), an **LRU policy**
for choosing what to unmount under a **mounted-app budget**, with **unmount = single-spa's
`unmount` lifecycle** (tear down, release the global/tag claims, keep the bundle cached for fast
re-mount). This makes eviction a *policy dimension* (LRU default; pin/keep-alive opt-in)
rather than a baked mechanic — and it degrades gracefully exactly like the storage model.

## Finding 5 — there is no native app shell; adapters keep the incompatible set shrinking

There is no native "load arbitrary independent app into my SPA" primitive — import maps +
dynamic `import()` are the substrate, but the lifecycle/routing/eviction frame is userland
(single-spa fills it). WE's distinctive lever is the essay's **adapters-via-DI** move
(`:417`): *convert an old setup to the new API without loading the old implementation*, because
APIs are dependency-injected (the constellation's **webinjectors**). That is what lets the
incompatible set shrink over time and is already a constellation capability — so the shell's
"hard refresh" is the *last resort*, not the first response to a version mismatch.

## Finding 6 — the competitor landscape: who declares, who resolves, who isolates

The four capabilities a compatibility map needs are spread thin across the field — **no single tool
has all four**, and the DOM-dimension declaration + map is the white space:

| Tool | Declared per-app manifest | Runtime coexistence resolution | Introspection / map | Isolation (globals/CSS/tags/routes) |
|---|---|---|---|---|
| **single-spa** | ✗ central import map | import-map alias only, no negotiation | ✗ (layout/route template only) | ✗ (lifecycle `unmount` cleanup only) |
| **Module Federation 2** | ✓ `mf-manifest.json` | ✓ share-scope (singleton/strict/required) | ✓ DevTools dependency graph | ✗ (module versions only) |
| **Native Federation** | ✓ `remoteEntry.json` | ✓ same negotiation, ESM+import-maps | ✗ machine metadata, no rendered map | ✗ (module versions only) |
| **Piral** | ✓✓ richest: `PiletMetadata` + feed | import maps for pilets; host peer deps | 🟡 feed = catalog/listing, not a chart | 🟡 shared realm; per-pilet require; no sandbox |
| **qiankun** | ✗ central register array | isolation-based (HTML entry) | ✗ | ✓✓ **JS sandbox (Proxy/snapshot) + Shadow-DOM/scoped CSS** |
| **Luigi** (SAP) | ✗ host nav config | iframe (no JS sharing) | ✗ | ✓✓ **iframe** (`isolateView`/`viewGroup`) |
| **Bit / bit.dev** | ✓ `workspace.jsonc`/`env.jsonc` | dependency resolver | ✓ **rendered visual dependency graph** | 🟡 build-time capsule, not runtime |

Reading: **Piral's feed** is the nearest *declared catalog* (extend its `dependencies`/`custom`
pattern with coexistence fields); **Bit Cloud's graph** is the nearest *rendered introspection* UX
(extend node-edge → a coexistence matrix); **qiankun / Luigi** are the *isolation enforcement tier*
behind the declarative map (sandbox or iframe when two apps declare an irreconcilable conflict —
the backstop when "hard refresh" / "older shell" isn't enough); **Native Federation** is the
*standards-based loading substrate* (ESM + import maps) most aligned with WE's native-first stance.
But none declares a coexistence contract over globals/tag-names/routes, and none renders a *can-these
-coexist-and-why* map — confirming the Finding 1 white space.

## Finding 7 — direction of travel: runtime-first MF, the manifest as the seam, Zephyr as control plane

Where the ecosystem is heading orients the **home** fork (Fork 1):

- **MF2 is runtime-first and bundler-agnostic** — the same runtime now spans webpack, Rspack,
  Rollup/Rolldown, Rsbuild, Vite, Metro, with framework bridges for cross-framework mounting
  ([InfoQ 2026-04](https://www.infoq.com/news/2026/04/module-federation-2-stable/)). The
  **`mf-manifest.json` is becoming the canonical integration seam** — *both* the DevTools graph and
  external platforms read it. That is precisely the #104 split: **one declared protocol artifact,
  consumed by (a) the runtime resolver and (b) the map view.** Don't invent a separate format per
  consumer.
- **Zephyr Cloud** is a deployment/version **control plane *over* MF's manifest** — immutable
  versioned builds, preview URLs, one-click promote + instant rollback, framework/bundler-agnostic
  ([Zephyr docs](https://docs.zephyr-cloud.io/); [RedMonk](https://redmonk.com/blog/2025/01/27/rmc-zack-chapple-on-zephyr-cloud-micro-frontends-and-module-federation/)).
  It is concrete proof the "**live map as a product over the manifest + relationship graph**" leg is
  viable and valuable — i.e. the Plateau-dashboard side of the Fork-1 split, rendered over #092.
- **Known MF failure modes worth designing against:** the "*Shared module is not available for eager
  consumption*" init-ordering hazard (the shell must boot its shared layer before micro-apps mount);
  singleton conflicts being **latent** (highest-wins + warn, broken hooks, not a clean error) unless
  `strictVersion`; SSR complexity; and **no integrity/signing model for remotes** — a real
  supply-chain gap for any shell loading third-party micro-apps (one WE could close where MF doesn't).

## Forks (carried into #104)

- **Fork 1 — home.** A thin **protocol** (the declared compatibility chart, a contract micro-apps
  author against, owned by **webmanifests** alongside `changelog-manifest`) **vs.** a **Plateau
  product** (the live map dashboard). Not exclusive: the protocol is the standards artifact; the
  live map is a *view of the #092 graph* and belongs in Plateau. Recommended split below.
- **Fork 2 — compatibility-chart schema.** A **flat requirement manifest** (declared:
  required shell range + required provider ranges + conflicting-global claims, semver ranges per
  `changelog-manifest`) **vs.** a **full BCD-style support matrix** (per-provider ranged/partial/
  status statements). Recommend: **declare flat, render rich-computed.** Concretely (Findings 3a/3b):
  declare an MF `shared`-shaped `providers` block (semver ranges + `singleton`/`optional`, npm
  `peerDependencies` dialect) **plus OSGi-namespaced `claims`** (`globals`/`tagNames`/`routes`) — the
  DOM-dimension declaration is the genuine novelty; then **compute** the BCD-shaped matrix as the map
  view (BCD is curated/computed, not declared). Carry three render states (Finding 3d:
  `supported`/`flagged-degraded`/`unsupported`), an **asymmetric** window (shell-newer = forward-compat
  zone; shell-older = fail), a **warn-vs-block policy knob** (Finding 2 / npm `engine-strict`), and a
  **singleton-vs-isolatable** flag per provider (Finding 3c: singletons need range *intersection* across
  all active apps; isolatables can use import-map scopes).
- **Fork 3 — eviction model.** **Borrow the Storage model** (best-effort/persistent classes +
  LRU under a mounted-app budget; unmount via lifecycle, keep bundle cached) **vs.** a bespoke
  policy or no eviction (essay's explicit non-answer). Recommend the Storage-model mirror as a
  policy *dimension* (LRU default, pin opt-in).

## Cross-references

- Decision: **#104** — App shell + micro-app compatibility map.
- Parent vision: **#099** — the evergreen app (`backlog/099-evergreen-app-vision.md`).
- Supplies the graph the map renders: **#092** — provider↔consumer relationship graph.
- Schema sibling / vocabulary source: **#102** — `changelog-manifest` protocol
  (`src/_data/protocols.json:86`); adapters-via-DI: **#094**, webinjectors.

## Sources

**Module Federation (incumbent resolver + declared manifest)**
- [Module Federation 2.0 release discussion (#2397)](https://github.com/module-federation/core/discussions/2397) — the manifest/runtime/types/bridges pillars
- [`mf-manifest.json` field reference](https://module-federation.io/configure/manifest-fields) · [manifest vs stats](https://module-federation.io/configure/manifest) — the declared contract shape
- [configure/shared](https://module-federation.io/configure/shared) · [webpack PR #10960 (sokra)](https://github.com/webpack/webpack/pull/10960) — singleton/requiredVersion/strictVersion resolution algorithm
- [Chrome DevTool — federated dependency graph](https://module-federation.io/guide/debug/chrome-devtool) — the computed-map prior art
- [InfoQ — MF2 reaches stable (2026-04)](https://www.infoq.com/news/2026/04/module-federation-2-stable/) — runtime-first/bundler-agnostic direction
- [ANGULARarchitects — version-mismatch-hell](https://www.angulararchitects.io/en/blog/getting-out-of-version-mismatch-hell-with-module-federation/) · [multi-framework/multi-version MFEs](https://www.angulararchitects.io/en/blog/multi-framework-and-version-micro-frontends-with-module-federation-the-good-the-bad-the-ugly/) — tag-name collisions MF does *not* model
- [Zephyr Cloud — Versions](https://docs.zephyr-cloud.io/features/versions) · [RedMonk interview](https://redmonk.com/blog/2025/01/27/rmc-zack-chapple-on-zephyr-cloud-micro-frontends-and-module-federation/) — control-plane-over-manifest analog

**Competitor frameworks**
- [single-spa — Recommended setup](https://single-spa.js.org/docs/recommended-setup/) · [configuration](https://single-spa.js.org/docs/configuration/)
- [Native Federation — README](https://raw.githubusercontent.com/angular-architects/module-federation-plugin/main/libs/native-federation/README.md) · [Angular blog](https://blog.angular.dev/micro-frontends-with-angular-and-native-federation-7623cfc5f413)
- [Piral — pilet specification](https://docs.piral.io/reference/specifications/pilet-specification) · [feed API spec](https://github.com/smapiot/piral/blob/develop/docs/specs/feed-api-specification.md)
- [qiankun — API (sandbox / style isolation)](https://umijs.github.io/qiankun/api/) · [Luigi — navigation/isolation](https://github.com/SAP/luigi/blob/master/docs/navigation-advanced.md)
- [Bit — inspecting dependencies (rendered graph)](https://bit.dev/reference/dependencies/inspecting-dependencies/) · [@originjs/vite-plugin-federation](https://www.npmjs.com/package/@originjs/vite-plugin-federation)

**Declared-range / resolution / matrix prior art**
- [import maps (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap) · [import-map-overrides](https://github.com/single-spa/import-map-overrides)
- [npm package.json — peerDependencies/engines/semver](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/) · [Node.js peer-dependencies blog](https://nodejs.org/en/blog/npm/peer-dependencies)
- [OSGi Core 7 §3 Module Layer (version ranges, `uses`, Require/Provide-Capability)](https://docs.osgi.org/specification/osgi.core/7.0.0/framework.module.html)
- [browser-compat-data compat-data-schema](https://github.com/mdn/browser-compat-data/blob/main/schemas/compat-data-schema.md) · [BCD repo (curation model)](https://github.com/mdn/browser-compat-data) · [web.dev Baseline](https://web.dev/baseline)
- [Kubernetes version-skew policy](https://kubernetes.io/releases/version-skew-policy/)
- [MDN — Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
