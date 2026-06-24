---
kind: decision
parent: "746"
status: resolved
blockedBy: ["1029", "1701"]
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1752
codifiedIn: "docs/agent/platform-decisions.md#we-data-crosses-via-fui-served-route"
preparedDate: "2026-06-24"
relatedReport: reports/2026-06-24-workbench-block-shape-resolution-maas-serve-url.md
relatedProject: webdocs
tags: [workbench, maas, frontierui, servePathIR, decision]
---

# Workbench resolves block shape from the FUI /_maas/ serve URL, not hardcoded WorkbenchBlock literals

## Ruling (ratified 2026-06-24)

**Fork 1 → (a): `servePathIR` executable-only + generator decoupled.** The executable serve contract stays
executable-only; the source/CEM generator is delivery-agnostic. **Crossing mechanism:** WE build-emits the
bytes into FUI's own deployable (CLI/copy boundary — no WE package dep), and the workbench fetches them from
FUI's own MaaS HTTP **data route** (a distinct surface, esm.sh `?raw`-style — *not* the executable `?form=`
catalog, *not* a deploy-broken bundled read of WE's tree). Dev live-generates in the FUI MaaS middleware
in-memory; prod serves the build-emitted committed copy. (b) widen-`servePathIR` rejected on the
artifact-class axis; the demand-gating "no consumer" prong was struck. Codified as the statute rule
`#we-data-crosses-via-fui-served-route` (see `codifiedIn`).

**Fork 2 → (b): split acquisition + opt-in "as-served" native view.** Native primary stage via direct
`import()` of the authoritative FUI element; polyglot live forms via the cross-origin serve URL (#1499);
source-only blocks carry no loadable shape; an opt-in "as-served" secondary view if a served native form
ever exists. (a) URL-resolve-everything (a fabricated `wc-class-live` form) rejected — zero fidelity gain on
the native case.

**Build spun out:** the FUI workbench thin-descriptor registry + `/_maas/` loader (Fork 2) as a new story;
source/CEM FUI data route + consumption wired by [#1618](/backlog/1618-wire-the-we-author-mode-source-artifact-into-the-live-fui-wo/)
(now unblocked). Full reasoning + refs below.

Prepared 2026-06-24 — no design existed; the two forks below are grounded in the real FUI + WE tree and a
prior-art survey (the `/research/` topic, linked via `relatedReport`), each with a **bold** default. Reframe:
the FUI workbench is *thin UI over rendering* — the `/_maas/` serve endpoint ([#1029](/backlog/1029-fui-maas-wrapper-serve-endpoint-vite-middleware-conforming-t/),
conforming to `we:blocks/renderers/module-service/servePathIR.ts`) resolves the shape the UI needs, not
hardcoded closures in `fui:workbench/registry.ts`. **Fork 1 narrows it: generation is decoupled from
delivery; `servePathIR` stays executable-only, while source/CEM serve from FUI's own MaaS HTTP data route
(bytes cross WE→FUI at build; dev live-generates, prod serves the committed copy).**

This decomposes into orthogonal axes the survey surfaced, each pinned to the real tree. **Resolution scope**
— what the serve URL returns: `we:blocks/renderers/module-service/servePathIR.ts` declares `MEDIA_TYPES` =
`javascript`/`html`/`error` only ([we:blocks/renderers/module-service/servePathIR.ts:74-82](blocks/renderers/module-service/servePathIR.ts#L74-L82))
and a catalog-gated `form` param ([we:blocks/renderers/module-service/servePathIR.ts:138-145](blocks/renderers/module-service/servePathIR.ts#L138-L145));
the FUI handler `fui:tools/maas/wrapperServeHandler.mjs` (#1029) serves only loadable ES modules (catalog =
react/vue-`wrapper` + react/vue-`live`), cross-origin (#1499). **Loadable-instance acquisition** — how a
live stage is loaded: today `load: () => import('../blocks/droplist/AutoComplete')` + `create: () =>
document.createElement('auto-complete')` are inline closures in `fui:workbench/registry.ts`, consumed by
`await block.load()` then `block.create()` in `fui:workbench/mount.ts`. **Settled (not forks):** source
forms (`authorSource`) cross the #700 seam as pre-emitted data `we:src/_data/authorModeSource.json`
(#954/#1701 — `renderAuthorModePanel` reads data only, no instance); CEM follows the same data class; case
examples are workbench demo fixtures.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Fork 1 — resolution scope | **(a) `servePathIR` executable-only + generator decoupled** (executable forms resolve via the path; source/CEM produced by a delivery-agnostic generator and **served from FUI's own MaaS HTTP data route** — bytes cross WE→FUI at build, FUI serves its local copy: dev generates live in-memory, prod serves the build-emitted copy) | (b) **widen `servePathIR`** to also return source-text + CEM-as-data on its executable `?form=` catalog | High (on *not widening `servePathIR`*) |
| Fork 2 — loadable-instance acquisition | **(b) split** (native via direct `import()`; polyglot live via the cross-origin URL; source-only blocks carry no loadable shape) + opt-in "as-served" native view | (a) URL-resolve every live form incl. native via a thin descriptor (mint a `wc-class-live` catalog form) | Med — divergent |

## Fork 1 — resolution scope: what the `/_maas/` URL resolves

**Reframe (this turn): generation is decoupled from delivery.** The code that produces source/CEM/forms
(`we:scripts/gen-author-mode-source.mjs` and a CEM emitter) is a pure, delivery-agnostic transform. It can
emit to a build-time data file **and** be served via MaaS — two composable delivery surfaces over one
generator. So the real question is *not* "build-time data **xor** URL"; it is (1) what the **executable**
`servePathIR` contract resolves, and (2) where the workbench *consumes* source/CEM from. The prior framing
conflated those with MaaS's overall scope — that is the error this fork now corrects.

**Fork-existence justification (narrowed).** The genuine either/or is **whether to widen `servePathIR`'s
executable `?form=` catalog to also return source-text + CEM-as-data**. (b) — widening it — is the **flawed**
branch on an *artifact-class* axis: `servePathIR`'s identity (content-hash pin, immutable cache, SRI
integrity, `javascript/html/error` media) is the *executable-module* contract, and source/CEM are an
inspection-artifact class. The prior art cuts both ways and is decisive: esm.sh *does* serve source at
runtime (`?raw`) — so "source-via-URL is protocol-inappropriate" is **false** — *and* esm.sh keeps `?raw` a
**distinct mode** from its `?target` transform, i.e. source is served on its own surface, not bolted onto the
executable-transform catalog. Widening `servePathIR` muddies the executable contract; it does **not** follow
that MaaS must never serve source/CEM.

**Demand-gating struck — MaaS source/CEM is ADOPTED as the workbench's consumption path.** The earlier
"no runtime-serve consumer exists" prong is **withdrawn** — gating on present demand violates *judge-on-merit*
(a remote/polyglot consumer that can't bundle and wants a content-pinned CEM or `?raw` source over HTTP is a
legitimate MaaS consumer). And the workbench itself is that consumer: FUI has **no `@webeverything` package
dependency** and its dev-only sibling aliases vanish at deploy, so a bundled/aliased read of WE's tree is
**deploy-broken** — the workbench must consume source/CEM from **FUI's own MaaS HTTP data route** (its own
serve surface, à la esm.sh `?raw`, distinct from the executable `?form=` catalog). See *Crossing mechanism*
below.

**Crux (with refs).** `servePathIR` serves executable artifacts only ([we:blocks/renderers/module-service/servePathIR.ts:74-82](blocks/renderers/module-service/servePathIR.ts#L74-L82));
the FUI catalog is `{ react-wrapper, vue-wrapper, react-live, vue-live }` (`fui:tools/maas/wrapperFormCatalog.mjs`),
all loadable JS. Source already has a build-time home: `we:src/_data/authorModeSource.json`, emitted by
`we:scripts/gen-author-mode-source.mjs` (#954), consumed as data by `fui:workbench/authorMode.ts` — the
workbench's consumption choice, with no runtime-server dependency.

**(a) `servePathIR` executable-only + generator decoupled.** `servePathIR` resolves executable
element/wrapper modules (`?form=…`); the source/CEM generator stays delivery-agnostic, and the workbench
consumes its output from **FUI's own MaaS HTTP data route** (its own serve surface, esm.sh `?raw`-style, not
an extension of the executable catalog) — *not* a bundled read of WE's tree, which is deploy-broken (see
*Crossing mechanism*). Case examples stay workbench fixtures. *Merit:* keeps the executable contract clean
(no artifact-class mixing); honors #954 (FUI never imports the runtime `serve()` engine into its bundle —
fetching pre-emitted JSON over HTTP is consuming data, not running the transform); honors #700 (no WE package
dep); decouples generation so neither delivery surface is foreclosed; matches prior art (esm.sh `?raw`
distinct from `?target`; Storybook/Histoire/Ladle docgen). *Merit cost:* the workbench reads from two homes
(serve URL for executable modules, a sibling HTTP route for source/CEM) — but those are genuinely different
artifact classes, faithful separation, not incidental split.

**(b) Widen `servePathIR` to all shapes.** *Flawed-on-merit (artifact-class), but narrowly.* Extend
`servePathIR`'s media types + the executable `?form=` catalog so the *same* path also returns source-text and
CEM-as-data. *Merit cost:* folds an inspection-artifact class into the executable-module contract whose
caching/integrity identity is meaningful for evaluated bytes — the muddying esm.sh avoids by keeping `?raw` a
separate mode. *Note:* this rejects only *widening this path*, **not** serving source/CEM via MaaS — that is
the FUI-served source/CEM data route adopted above (a distinct surface from this executable catalog).

**Default: (a) `servePathIR` executable-only + generator decoupled.** Keep the executable contract clean and
the generator delivery-agnostic; the workbench consumes source/CEM from FUI's own MaaS HTTP data route (not a
deploy-broken bundled read of WE's tree). High confidence on *not widening `servePathIR`* — grounded in the
artifact-class distinction and esm.sh's own `?raw`/`?target` split.

**Crossing mechanism (resolved this turn): how the FUI server gets the content.** The bytes are WE-owned
(WE owns the standard + the `serve()` transform) but FUI carries **no `@webeverything` package dependency**,
and its dev-only sibling aliases (`weRoot = ../webeverything` in `fui:vite.config.ts`; the `@webeverything/*`
paths in [fui:tsconfig.json:29-36](../../frontierui/tsconfig.json#L29-L36)) **vanish at deploy** — the MaaS
*handler* is even deliberately left unaliased so it stays unresolvable from FUI ([fui:vite.config.ts:217](../../frontierui/vite.config.ts#L217)),
forcing the cross-origin HTTP boundary (#1499). So a bundled/aliased read of `we:src/_data/authorModeSource.json`
is **deploy-broken**, and the content reaches FUI's server like this:

- **Generation (WE).** WE produces the per-block × per-form source/CEM JSON via its transform
  (`we:scripts/gen-author-mode-source.mjs` → `we:src/_data/authorModeSource.json`, committed; CEM follows the
  same class).
- **Crossing (build-time CLI/copy boundary).** A build step emits those bytes into **FUI's own deployable**
  via a CLI/copy boundary — no package dep, no runtime WE import into FUI's bundle (honors #700/#954). FUI
  only ever serves what it already holds.
- **Serve (FUI MaaS HTTP route).** FUI's MaaS server exposes a source/CEM **data route** (own surface, esm.sh
  `?raw`-style, distinct from the executable `?form=` catalog); the workbench **fetches at runtime** — the
  already-deployed #1499 cross-origin FUI-server pattern.
- **Dev vs prod on one route contract.** *Prod:* the route serves the build-emitted committed copy. *Dev:*
  the FUI MaaS middleware imports the WE generator across the sibling alias (dev-only boundary, exactly how
  wrappers are already served) and runs it **in-memory per request (or on file-watch)** — fresh, never-stale
  bytes, no committed file needed. Identical route + workbench fetch in both; only the byte source differs
  (live-generate in dev, build-emitted copy in prod). The in-memory generation runs in the FUI dev *server*
  middleware, never the FUI app bundle — so #954's "FUI never imports `serve()`" invariant holds in both
  modes.

Skeptic: SURVIVES-WITH-REFRAME — the prior write rejected (b) partly on "no consumer" (demand-gating, now
struck) and overstated "source-via-URL is protocol-inappropriate" (esm.sh `?raw` refutes it). The surviving
merit point is narrow and real: don't fold an inspection-artifact class into the executable `servePathIR`
catalog. MaaS-serving source/CEM on its own surface is *not* rejected — it is the **adopted** consumption
path (FUI's own HTTP data route; the deploy-broken bundled read of WE's tree is what's ruled out). SURVIVES
on the narrowed artifact-class ground.

## Fork 2 — loadable-instance acquisition: URL-resolved vs split

**Fork-existence justification.** Genuine either/or: a block's native live instance comes from one source —
either a cross-origin module from `/_maas/?form=…` (a) or a direct `import()` of the FUI element (b); they
cannot both be *the* native-stage mechanism. (a)'s excluded-on-merit case: a served native `wc-class` is a
**projection** of the source element (content-hash-identical at best), so URL-resolving it adds a serve-origin
runtime dependency **+ a workbench-only `wc-class-live` catalog form** for **zero fidelity gain** over
importing the authoritative source directly — and no polyglot consumer needs a served native form (consumer
search: the live-render slices #912/#967 mount the *wrapper*, not a native served module). Composability does
not dissolve it: a direct import is not a facade over a URL fetch (different byte sources with different
failure surfaces).

**Crux (with refs).** Today native is `load: () => import('../blocks/droplist/AutoComplete')` +
`create()` inline in `fui:workbench/registry.ts`, called by `await block.load()` / `block.create()` in
`fui:workbench/mount.ts`. The polyglot React/Vue *live* forms have **no** native representation, so they are
*forced* to the cross-origin serve URL (#1499/#1501). Source-only blocks (#1701a) carry no loadable shape at
all.

**(b) Split acquisition.** Native primary stage via direct inline `import()` of the authoritative FUI
element; polyglot live forms via the cross-origin serve URL (forced by #1499); source-only blocks carry no
loadable shape; **plus an opt-in "as-served" secondary view** for the native form *if* a served native form
ever exists for a real reason. *Merit tradeoffs:* highest fidelity for the native stage (loads the real
source element, zero transform/drift); native-first (the platform-native artifact is the default, the
projection is opt-in); no fabricated catalog form; matches prior art (bundler-import the component, reserve
the serve URL for cross-origin/remote). *Merit cost:* two acquisition paths in the registry — but each is the
faithful path for its form class.

**(a) URL-resolved descriptor.** Registry entry is a thin `{ id, name, forms[] }`; *every* live form, native
included, resolves from `/_maas/<name>.js?form=…` — requires minting a native `wc-class-live` form in the FUI
catalog. *Merit tradeoffs:* one uniform mechanism; the native stage shows the exact served, content-pinned
artifact a consumer receives; closest to the stated "URL-resolved blocks / thin UI over rendering" end-state.
*Merit cost:* couples the primary stage to a running serve origin + a workbench-only catalog form, for a
fidelity gain that is near-zero on the native case (served native == source by hash). *The main alternative
the decider may prefer — to honor the stated end-state.*

**Default: (b) split** — with the skeptic amendment (opt-in "as-served" native view). It is the
higher-fidelity, native-first mechanism and still delivers the reframe's real goal — **no hardcoded rich
literals**: thin descriptors + source-only data + URL-resolved polyglot. Confidence **Med (divergent)**: (a)
is defensible for uniformity and is closer to the literal end-state, so this is the row where judgment is
genuinely needed, not a nod.

Skeptic: SURVIVES-WITH-AMENDMENT → attacked (b) with the strongest case for (a) ("show what a *real* MaaS
consumer receives — the served, transformed, content-pinned artifact — not a dev-mode import that can drift;
unifying removes a special-case"). The "removes a special-case / is what the user asked for" half is
elegance/desire, not merit, and forcing native through the URL mints a fabricated `wc-class-live` form whose
only consumer is the workbench's own stage. The consumer-fidelity half is a genuine merit point: amendment
keeps the native stage a direct `import()` (highest fidelity, no fabricated form) **and** offers an opt-in
"as-served" secondary inspection view if a served native form ever exists — honoring the fidelity point and
keeping the door open to the URL-resolved end-state without paying for a workbench-only catalog entry now.

## Context

**Settled by classification (not forks — supported by default).** Source forms (`authorSource`) and CEM reach
the *workbench* as pre-emitted **data** (#954/#1701; the panels read data with no live instance) — a
*consumption* choice over a *delivery-agnostic generator*. The crossing is **not** a bundled read of WE's
tree (deploy-broken — FUI has no WE dep): the bytes cross WE→FUI at build and the workbench fetches them from
FUI's own MaaS HTTP data route (Fork 1, *Crossing mechanism*; dev generates live in-memory, prod serves the
build-emitted copy). Case examples are **workbench demo fixtures** (#970/#971 family). What is open *for
`servePathIR`* is the loadable-element shape — hence the two forks above.

**Dependencies & lineage.** `blockedBy` [#1029](/backlog/1029-fui-maas-wrapper-serve-endpoint-vite-middleware-conforming-t/)
(the FUI `/_maas/` serve handler — resolved) and [#1701](/backlog/1701-how-does-the-fui-workbench-host-a-declarative-component-case/)
(the relaxed source-only `WorkbenchBlock` contract — resolved; a URL-resolved block with no loadable module
needs exactly that relaxation). [#1730](/backlog/1730-audit-relocate-the-maas-serving-runtime-out-of-we-per-1282-z/)
(relocate WE's serve core to FUI) is **not** a blocker — an internal WE→FUI cleanup under #1282 that does not
change the consumed HTTP contract. Downstream: [#1618](/backlog/1618-wire-the-we-author-mode-source-artifact-into-the-live-fui-wo/)
(wire the author-mode artifact) "should align with #1731 before hardcoding 9 source-only literals, to avoid
hardcode-then-rip" (#1701 scope note) — it should gain `blockedBy: 1731` at this decision's ratification.
Parent [#746](/backlog/746-block-explorer-interactive-fui-block-workbench/).

**At ratification.** The build spins out as FUI workbench-registry work: a thin descriptor registry + a
`/_maas/`-resolving loader for the polyglot live forms (and native, if Fork 2 lands (a)); source/CEM served
from **FUI's own MaaS HTTP data route** (the *Crossing mechanism* — WE build-emits bytes into FUI's
deployable; dev generates live in-memory, prod serves the committed copy) and consumed by the #1618 wiring;
case examples as workbench fixtures. Fork 1 (a) keeps `servePathIR` executable-only — no protocol change; the
source/CEM data route is a **distinct** FUI serve surface (esm.sh `?raw`-style), spun as its own build card.
If a documented technical setting
emerges (a `form`/`target` default), spin a Technical Configurator card per the prepared-fork-shape rule.
