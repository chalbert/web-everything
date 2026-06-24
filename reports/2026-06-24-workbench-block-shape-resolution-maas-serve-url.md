# Workbench block-shape resolution — `/_maas/` serve URL vs hardcoded `WorkbenchBlock` literals (#1731)

> Prep research for decision [#1731](/backlog/1731-workbench-resolves-block-shape-from-the-fui-maas-serve-url-n/)
> (parent [#746](/backlog/746-block-explorer-interactive-fui-block-workbench/)). Surveys prior art,
> grounds the forks in the real FUI + WE tree, and recommends defaults. No human judgment taken here —
> the call is `/next decision`'s job. Promoted to the `/research/` topic
> `workbench-block-shape-resolution`.

## The question

The reframe in #1731: the FUI workbench should be **thin UI over rendering**, with the FUI `/_maas/`
serve endpoint ([#1029](/backlog/1029-fui-maas-wrapper-serve-endpoint-vite-middleware-conforming-t/),
conforming to `we:blocks/renderers/module-service/servePathIR.ts`) providing *whatever shape the UI needs
for a component* — source forms, CEM, a loadable element module, or a case example — **resolved by URL**,
instead of each block hardcoding `load`/`create`/`cem`/`authorSource` closures inline in
`fui:workbench/registry.ts`. The user-stated end-state is "URL-resolved blocks."

The prep finding is that "*whatever shape* resolved by URL" is **too broad**: the serve path is an
**executable-artifact** origin, and the workbench's *data* shapes (source/CEM) already have a ratified
build-time home. The decision shrinks to two genuine forks — a **scope** fork (what the URL resolves) and
an **acquisition** fork (how a live instance is loaded).

## Grounding — the real seam (verified in-tree)

**The workbench today (FUI).** `fui:workbench/registry.ts` registers exactly **one** block today —
`auto-complete` — as a hardcoded literal: `load: () => import('../blocks/droplist/AutoComplete')` (the
inline side-effect import), `create: () => document.createElement('auto-complete')…` (an inline seed/config
closure), plus an inline `cem` data literal and inline `styles`. The `WorkbenchBlock` contract requires
`load`/`create`; `cem?`/`authorSource?` are optional. The shell consumes a block in `fui:workbench/mount.ts`:
`await block.load()` then `block.create()` for the live stage, `if (block.cem)` gates the polyglot
wrapper-source panel (`generateWrapper(cem, target)`), `if (block.authorSource)` gates the author-mode
source-tabs panel. The author-mode panel (`fui:workbench/authorMode.ts`) consumes **data only**
(`{ name, definition, forms[] }`) — no live instance.

**The serve endpoint (FUI).** `fui:tools/maas/wrapperServeHandler.mjs` (#1029, resolved) is a **cross-origin**
(CORS, the #1499/#1501 design) Vite-middleware origin serving `/_maas/<name>[@<pin>].js?form=…&target=…&strategy=…`.
It returns **only loadable ES modules**. Catalog forms today (`fui:tools/maas/wrapperFormCatalog.mjs`) =
`{ react-wrapper, vue-wrapper, react-live, vue-live }` — all executable JS, no native `wc-class` form, no
source-text, no CEM-as-data. Identity = content-hash pin → `200` immutable + SRI integrity, `302` floating→pin
redirect, `304`/`400`/`404`/`500`. **No code in the repo imports from `/_maas/` yet** — the workbench is
100% hardcoded literals; there is no existing seam between registry and serve URL.

**The contract (WE).** `we:blocks/renderers/module-service/servePathIR.ts` is the language-neutral serve-path
IR. `MEDIA_TYPES` = `javascript / html / error` **only** ([we:blocks/renderers/module-service/servePathIR.ts:74-82](blocks/renderers/module-service/servePathIR.ts#L74-L82)). The `form` param is
**catalog-gated** ([we:blocks/renderers/module-service/servePathIR.ts:138-145](blocks/renderers/module-service/servePathIR.ts#L138-L145)) — the value set is an injected implementation catalog, the IR
only names that the seam exists. The whole identity model (content-hash pin, `immutable` cache, SRI
integrity, `X-MaaS-Producer`) is built for **evaluated artifacts** whose bytes must be pinned.

**Ratified placement (WE).** [#954] + [#1701] (resolved) settled that component **source forms** cross the
"#700 seam" as **pre-emitted build-time data** — `we:src/_data/authorModeSource.json`, emitted by a
build-time `serve()` *projection* (`we:scripts/gen-author-mode-source.mjs`, an allowed author/validate use
of `serve()`) — and **FUI never imports the runtime `serve()`**. The author-mode panel reads that committed
data, not a live serve call. #1701's ruling: *"only rendered text + diagnostics cross the #700 seam."*

## Prior art

| System | How it resolves a component's *module* | How it resolves *source / metadata* | Takeaway |
|---|---|---|---|
| **esm.sh** | URL transform params (`?target`, `?bundle`, `?standalone`, `?deps`) → an **executable ES module**, content-addressed/edge-cached | **raw source** is a *distinct* `?raw` mode; type defs a separate `?no-dts`/`.d.ts` path | Transform-by-param URL is for **executable** artifacts; source is a separate mode, not the same param axis. |
| **Storybook** (addon-docs/CSF) | component module loaded by the **bundler** (direct import), not an HTTP serve URL | **source-loader / docgen** extract source + props **at build time** as data | Source/props = build-time docgen **data**; the module is imported directly. |
| **Histoire / Ladle** | bundler import of the story/component module | build-time props/source extraction | Same split as Storybook — no runtime shape-serving URL. |
| **CEM-driven docs** (Shoelace / Web Awesome, `@custom-elements-manifest`) | element module imported directly | a **CEM manifest** generated at build, consumed as **data** | CEM is a build-time **data** manifest, never a runtime media type on a transform URL. |
| **jsdelivr / unpkg** | serves the module file by URL | a **separate data API** (`/v1/…`) for metadata, not the file URL | Module-serving and metadata are **different endpoints** by design. |

**Convergent signal:** every mature system splits *executable-module resolution* (a transform/serve URL,
or a direct bundler import) from *source/metadata resolution* (build-time docgen **data**). None overloads a
single transform-by-param URL to also return source-text or a manifest-as-data. This independently lands on
**Fork 1 (a)** and supports **Fork 2 (b)** (direct import of the authoritative module).

## Axis decomposition

The workbench needs up to four shape-classes per block. Classifying each against the architecture settles
most of the question:

| Shape | Natural home (grounded) | Open? |
|---|---|---|
| **Source forms** (`authorSource`) | **Build-time data** — `we:src/_data/authorModeSource.json` (#954/#1701). The serve path has no source-text media type; the panel reads data, no instance. | **Settled — not a fork.** |
| **CEM** (`cem`) | **Build-time data** — same class as source (a manifest, no `javascript`/`html` media type fits it; prior art = the CEM manifest). Today a hardcoded literal; should join the source emit, not the serve URL. | **Settled — not a fork.** |
| **Case example** (seed/config) | **Workbench demo fixture** — what attrs/items to set on the instance; an authored demo (#970/#971 family), neither a served artifact nor a WE emit. | **Settled — not a fork.** |
| **Loadable element module** (`load`/`create`) | The one shape the serve path is *for* (cross-origin, content-pinned). Polyglot live forms (React/Vue) are **forced** to the URL (#1499); the native form is the real choice. | **Open — Forks 1 & 2.** |

So axis (1) of #1731 ("loadable module vs data shapes") resolves to a **classification**: loadable modules
→ runtime `/_maas/` URL; source/CEM → build-time data; case → workbench fixture. Axis (2) ("how the URL
declares which shape") = the `form` catalog-gated param — the mechanism *within* Fork 2, not a separate
fork. Axis (3) (dependency on #1730/#1029) resolves to: #1029 **resolved** (the consumed mechanism exists);
**#1730 is not a blocker** — it relocates WE's serve *core* to FUI (an internal WE→FUI cleanup under #1282)
and does **not** change the FUI `/_maas/` HTTP contract the workbench consumes. #1730 is context, not a
prerequisite edge.

## Fork 1 — resolution scope: what the `/_maas/` URL resolves

- **(a) Loadable modules only [recommended].** The URL resolves executable element/wrapper modules
  (`?form=…`); source forms + CEM stay build-time data (#954/#1701 + a CEM emit), case examples stay
  workbench fixtures.
- **(b) All shapes via URL [rejected].** Extend servePathIR's media types + the catalog so the URL also
  returns source-form text and CEM-as-data — the universal shape resolver the literal #1731 framing implies.

**Fork-existence:** (b) is the **flawed/excluded** branch. It contradicts ratified placement #954/#1701
(source crosses #700 as pre-emitted data; FUI never imports `serve()`) and **widens the protocol** — adding
source-text + CEM-as-data media types to a serve path whose identity (content-hash pin, immutable cache,
SRI) is meaningful only for evaluated artifacts. No consumer needs source/CEM *served at runtime* (the panel
reads committed data). They cannot both be "the" resolution model. **Confidence: High** — near a forced
invariant, grounded in two ratified decisions + the protocol identity + convergent prior art.

**Skeptic (REFUTED the attack / default SURVIVES):** attacked (a) with the strongest case for (b) — "one
uniform resolver is simpler and keeps the workbench truly thin; serving source/CEM is a small content-type
addition." Refuted on merit: "simpler/thin" is elegance/effort, not merit; adding two media types to the IR
is a **protocol widening**, not a content-type nicety, and it re-introduces exactly the runtime coupling
#954/#1701 removed. esm.sh's `?raw`-vs-`?target` split and Storybook's build-time docgen are the prior-art
witnesses. SURVIVES.

## Fork 2 — loadable-instance acquisition: URL-resolved vs split

- **(a) URL-resolved descriptor.** Registry entry is a thin `{ id, name, forms[] }`; *every* live form,
  native included, resolves from `/_maas/<name>.js?form=…` — requires minting a native `wc-class-live` form
  in the FUI catalog. Closest to the user's "URL-resolved blocks / thin UI over rendering" end-state.
- **(b) Split acquisition [recommended].** Native primary stage via direct inline `import()` of the
  authoritative FUI element; polyglot (React/Vue) live forms via the cross-origin serve URL (forced by
  #1499); source-only blocks (#1701a) carry no loadable shape. Plus an **opt-in "as-served" secondary view**
  for the native form, available *if* a served native form ever exists for a real polyglot consumer
  (the skeptic amendment — honors consumer-fidelity without minting a workbench-only catalog form now).

**Fork-existence:** genuine either/or for a block's native live instance — it comes from one source.
(a)'s excluded-on-merit case: a served native `wc-class` is a **projection** of the source element
(content-hash-identical at best), so URL-resolving it adds a serve-origin runtime dependency **+ a
workbench-only catalog form** for **zero fidelity gain** over importing the authoritative source directly;
the URL round-trip earns its keep only where there's a cross-origin/projection reason — the polyglot forms,
which (b) keeps on the URL. Native-first default: load the platform-native artifact directly, make the
projection opt-in. Prior art (Storybook/Histoire/Ladle bundler-import the component; serve-URL is for
remote/cross-origin modules) supports (b). **Confidence: Med (divergent)** — (a) is defensible for
uniformity and is closer to the stated end-state; this is where judgment is genuinely needed. Note (b)
still delivers the user's real goal: **no hardcoded rich literals** — thin descriptors + source-only data —
while keeping the native stage source-faithful.

**Skeptic (SURVIVES-WITH-AMENDMENT):** attacked (b) with "show what a *real* MaaS consumer receives (the
served, transformed, content-pinned artifact), not a dev-mode import that can drift; unifying removes a
special-case." The "removes a special-case / is what the user asked for" half is elegance/desire, not merit
— and forcing native through the URL mints a fabricated `wc-class-live` form whose only consumer is the
workbench's own stage. But the consumer-fidelity half is a **genuine** merit point. Amendment (folded into
(b)): keep the native stage a direct `import()` (highest fidelity, no fabricated form), and offer an opt-in
"as-served" secondary inspection view *if* a served native form ever exists for a real reason — keeping the
door open to the user's URL-resolved end-state without paying for a workbench-only catalog entry now.

## Dependencies & lineage

- **blockedBy #1701 (resolved)** — the relaxed `WorkbenchBlock` contract (source-only blocks) is a
  prerequisite either way: a URL-resolved block with no loadable module needs exactly that relaxation.
  Lineage edge; resolved → leaves #1731 ready.
- **blockedBy #1029 (resolved)** — the FUI `/_maas/` serve handler is the mechanism the loadable shape
  resolves from. Lineage edge; resolved.
- **#1730 (open) — NOT a blocker.** Internal WE→FUI relocation of the serve *core* under #1282; does not
  change the consumed HTTP contract. Context/crossRef only.
- **#1618 (open, `blockedBy: 1701`) — downstream.** Its build slice "should align with #1731 before
  hardcoding 9 source-only literals, to avoid hardcode-then-rip" (#1701 scope note). Resolving #1731 informs
  whether #1618 registers literals or thin descriptors; #1618 should gain `blockedBy: 1731` at #1731's
  ratification.

## At ratification

The build spins out as FUI workbench-registry work: thin descriptor registry + a `/_maas/`-resolving loader
for the polyglot live forms (and native if Fork 2 lands (a)), with source/CEM fed from the build-time emit
(#1618 Transport half) and case examples as workbench fixtures. Fork 1's rejection of (b) keeps servePathIR
executable-only — no protocol change. If a "documented technical setting" emerges (e.g. a `form`/`target`
default), spin a Technical Configurator card per the prepared-fork-shape rule.
