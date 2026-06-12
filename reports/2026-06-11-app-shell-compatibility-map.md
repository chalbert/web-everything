# App Shell + Micro-App Compatibility Map — survey & fork analysis

> Prior-art survey grounding backlog **#104**'s three open forks (home, compatibility-chart
> schema, memory-eviction model). The item descends from the archived design essay
> (`reports/2026-06-06-front-end-platform-book.md`, *Micro Apps / Ideal micro-apps setup*,
> lines 364–423) and has **no design yet** — this report gathers web-platform and industry
> prior art per design-first step 1 so the schema reuses established vocabulary
> (browser-compat-data, semver, the Storage eviction model) instead of coining terms.

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

## Finding 1 — the App Shell model is established; the compatibility *decision* is the gap

The **App Shell architecture** (a minimal HTML/CSS/JS frame, cached, that hosts dynamically
loaded content) is a well-known PWA pattern. The micro-frontend variants that load multiple
independently-built apps into one shell are mature:

- **single-spa** — a root config registers applications with `activeWhen` route predicates and
  abstracts each app's `bootstrap/mount/unmount` lifecycle; it explicitly supports multiple
  frameworks on one page. Shared deps resolve via **import maps** (`<script type="importmap">`)
  or SystemJS. This is the closest existing analog to the essay's shell.
- **Webpack/Rspack Module Federation** — runtime sharing of build-time modules with a
  `shared` config carrying **semver requirements** (`requiredVersion`, `singleton`,
  `strictVersion`). Compatibility is asserted *per shared dependency at the version level*.
- **import maps** — the native substrate: a JSON map from bare specifier → URL; `import-map-overrides`
  lets a shell swap a micro-app's resolved URL at runtime without rebuild.

**Key takeaway:** every system models compatibility as **"does my required version range
intersect what's already loaded / what the shell provides"**, but none ships a *declared,
introspectable compatibility chart per app* that a Platform can render as a map. That map —
the cross-app introspection view — is the genuinely novel artifact #104 is about, and it sits
directly on the relationship-graph work (**#092**, `backlog/092-provider-consumer-graph-platform-manager.md:17`).

## Finding 2 — compatibility = version-range intersection over shared providers

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

WE already owns the *bytes-and-versions are npm/git* stance and the
**provider↔consumer graph** as the control plane (#092). A compatibility chart is therefore not
a new registry — it is a **declaration each app contributes to that graph** plus a **resolver**
that computes coexistence. The `changelog-manifest` protocol already standardizes per-module
semver severity + migration linkage (`src/_data/protocols.json:86`); the compatibility chart is
its forward-looking dual: not *what changed* but *what I require to run here*.

## Finding 3 — schema prior art: browser-compat-data's support-statement shape

The richest, battle-tested compatibility schema on the web platform is **MDN
browser-compat-data (BCD)**. Its `__compat` object is worth mirroring structurally:

- A **`support`** object keyed by *agent* (browser id), each value a `simple_support_statement`
  (or array): `version_added` (mandatory, `false` | version string | **ranged** `"≤50"`),
  `version_removed`, plus modifiers `prefix`, `alternative_name`, `flags[]`,
  `partial_implementation` (boolean), `notes`, `impl_url`.
- A **`status`** object: `experimental`, `standard_track`, `deprecated` (booleans) — increasingly
  superseded by **Baseline** (`web-features`).
- **Ranged versions** explicitly encode *uncertainty* ("supported by at least vX, maybe earlier").

The transferable lessons for the compatibility chart:

- Model the unit as **(provider/shell, version-range)** keyed pairs — BCD's "keyed by agent,
  value carries a version statement" shape maps cleanly onto "keyed by provider, value carries a
  required range".
- Carry **`partial_implementation`-style nuance** — a page can be *degraded-compatible* (runs but
  with a flagged incompatibility), not just binary compatible/incompatible. This is exactly the
  essay's "runs on an older shell, flagged on the dashboard" (`:1426`).
- Carry **status** (deprecated/experimental) so the map can surface apps pinned to dying providers.
- Use **semver ranges** (caret/tilde) directly — the essay's "MaaS with version range, not fixed
  version" (`:418`), already the `changelog-manifest` vocabulary.

Two viable schema altitudes emerge: a **flat capability/requirement manifest** (lightweight,
declares required shell + provider ranges + conflicting globals) vs. a **full BCD-style
support-matrix** (per-provider statements with ranged/partial/status nuance). The flat manifest
is the right *declared* artifact; the BCD-style matrix is the *computed view* the map renders.

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

## Forks (carried into #104)

- **Fork 1 — home.** A thin **protocol** (the declared compatibility chart, a contract micro-apps
  author against, owned by **webmanifests** alongside `changelog-manifest`) **vs.** a **Plateau
  product** (the live map dashboard). Not exclusive: the protocol is the standards artifact; the
  live map is a *view of the #092 graph* and belongs in Plateau. Recommended split below.
- **Fork 2 — compatibility-chart schema.** A **flat requirement manifest** (declared:
  required shell range + required provider ranges + conflicting-global claims, semver ranges per
  `changelog-manifest`) **vs.** a **full BCD-style support matrix** (per-provider ranged/partial/
  status statements). Recommend: declare flat; compute the BCD-style matrix as the rendered view.
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

- [browser-compat-data compat-data-schema](https://github.com/mdn/browser-compat-data/blob/main/schemas/compat-data-schema.md)
- [MDN — Compatibility tables and BCD](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Page_structures/Compatibility_tables)
- [MDN — Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [single-spa — Recommended setup](https://single-spa.js.org/docs/recommended-setup/)
- [Module Federation — shared dependencies / version requirements](https://module-federation.io/)
- [import-map-overrides](https://github.com/single-spa/import-map-overrides)
