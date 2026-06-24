---
kind: decision
parent: "746"
status: open
blockedBy: ["1029", "1701"]
dateOpened: "2026-06-24"
preparedDate: "2026-06-24"
relatedReport: reports/2026-06-24-workbench-block-shape-resolution-maas-serve-url.md
relatedProject: webdocs
tags: [workbench, maas, frontierui, servePathIR, decision]
---

# Workbench resolves block shape from the FUI /_maas/ serve URL, not hardcoded WorkbenchBlock literals

Prepared 2026-06-24 — no design existed; the two forks below are grounded in a read of the real FUI + WE
tree and a prior-art survey published as the `/research/` topic
[workbench-block-shape-resolution-maas-serve-url](/research/workbench-block-shape-resolution-maas-serve-url/)
(session report linked via `relatedReport`), each carrying a **bold** recommended default. The reframe: the
FUI workbench should be *thin UI over rendering*, with the FUI `/_maas/` serve endpoint ([#1029](/backlog/1029-fui-maas-wrapper-serve-endpoint-vite-middleware-conforming-t/),
conforming to `we:blocks/renderers/module-service/servePathIR.ts`) resolving the shape the UI needs for a
component — instead of each block hardcoding `load`/`create`/`cem`/`authorSource` closures inline in
`fui:workbench/registry.ts`. **The prep finding shrinks "*whatever shape* by URL": the serve path is an
executable-artifact origin, so only the loadable-module shape is genuinely open — source/CEM are settled as
build-time data (#954/#1701), case examples are workbench fixtures.**

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
| Fork 1 — resolution scope | **(a) loadable modules only** (URL serves executable forms; source/CEM stay build-time data, case = fixture) | (b) extend the serve path to also return source-text + CEM-as-data (universal URL resolver) | High |
| Fork 2 — loadable-instance acquisition | **(b) split** (native via direct `import()`; polyglot live via the cross-origin URL; source-only blocks carry no loadable shape) + opt-in "as-served" native view | (a) URL-resolve every live form incl. native via a thin descriptor (mint a `wc-class-live` catalog form) | Med — divergent |

## Fork 1 — resolution scope: what the `/_maas/` URL resolves

**Fork-existence justification.** Genuine either/or for the resolution model, and (b) is the **flawed /
excluded** branch — positively disproven, not asserted. (b) contradicts the ratified placement #954/#1701
(component source crosses the #700 seam as pre-emitted build-time data; FUI never imports the runtime
`serve()`) and **widens the protocol**: adding source-text + CEM-as-data media types to a serve path whose
identity (content-hash pin, immutable cache, SRI integrity, `javascript/html/error` media only) is meaningful
only for evaluated bytes. Consumer search: no surface needs source/CEM *served at runtime* — the author-mode
panel reads committed data (`fui:workbench/authorMode.ts`, no instance), so the runtime-serve consumer is
absent. They cannot both be "the" resolution model.

**Crux (with refs).** `servePathIR` serves executable artifacts only ([we:blocks/renderers/module-service/servePathIR.ts:74-82](blocks/renderers/module-service/servePathIR.ts#L74-L82));
the FUI catalog is `{ react-wrapper, vue-wrapper, react-live, vue-live }` (`fui:tools/maas/wrapperFormCatalog.mjs`),
all loadable JS. Source already has a build-time home: `we:src/_data/authorModeSource.json`, emitted by
`we:scripts/gen-author-mode-source.mjs` (#954), consumed as data by `fui:workbench/authorMode.ts`.

**(a) Loadable modules only.** The URL resolves executable element/wrapper modules (`?form=…`); source
forms + CEM stay build-time data (`we:src/_data/authorModeSource.json` + a CEM emit), case examples stay
workbench fixtures. *Merit tradeoffs:* keeps `servePathIR` executable-only (no protocol change); honors
#954/#1701's data placement; matches prior art (esm.sh transform-by-param = executable, `?raw` source is a
distinct mode; Storybook/Histoire/Ladle extract source/CEM as build-time docgen data). *Merit cost:* the
workbench reads from two homes (serve URL for modules, build-time data for source/CEM) — but those are
genuinely different artifact classes, so this is faithful separation, not incidental split.

**(b) All shapes via URL.** *Rejected.* Extend `servePathIR`'s media types + the catalog so the URL also
returns source-form text and CEM-as-data — the universal resolver the literal reframe implies. *Merit cost
(why excluded):* protocol widening onto non-executable data + re-introduces the runtime-serve coupling
#954/#1701 removed, for a runtime consumer that does not exist. *Rejected on the protocol-scope / placement
merit axis, not on effort.*

**Default: (a) loadable modules only.** The serve URL is correctly typed for executable modules; source/CEM
are build-time data with a ratified home and no runtime-serve consumer. High confidence — near a forced
invariant grounded in two ratified decisions, the protocol identity, and convergent prior art.

Skeptic: SURVIVES — attacked (a) with the strongest case for (b) ("one uniform resolver is simpler and keeps
the workbench truly thin; serving source/CEM is a small content-type addition"). Refuted on merit: "simpler/
thin" is elegance/effort, not merit; adding two media types to the IR is a *protocol widening*, not a
content-type nicety, and re-introduces exactly the runtime coupling #954/#1701 removed. esm.sh's
`?raw`-vs-`?target` split and Storybook's build-time docgen are the prior-art witnesses. SURVIVES — beat the
"uniform resolver" attack.

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

**Settled by classification (not forks — supported by default).** Source forms (`authorSource`) and CEM are
build-time **data** (#954/#1701; the serve path has no source/CEM media type, the panels read data with no
live instance); case examples are **workbench demo fixtures** (#970/#971 family). Only the loadable-element
shape is genuinely open — hence the two forks above.

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
`/_maas/`-resolving loader for the polyglot live forms (and native, if Fork 2 lands (a)), with source/CEM fed
from the build-time emit (the #1618 Transport half) and case examples as workbench fixtures. Fork 1 (a) keeps
`servePathIR` executable-only — no protocol change. If a documented technical setting emerges (a `form`/
`target` default), spin a Technical Configurator card per the prepared-fork-shape rule.
