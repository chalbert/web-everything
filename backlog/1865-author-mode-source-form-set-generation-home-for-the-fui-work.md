---
kind: decision
parent: "746"
status: open
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
preparedDate: "2026-06-27"
relatedReport: reports/2026-06-27-fui-workbench-author-mode-source-home.md
tags: [block-explorer, workbench, author-mode, maas, fui]
---

# Author-mode-source form-set + generation-home for the FUI workbench

Two build-blocking sub-calls before [#1618](/backlog/1618-wire-the-we-author-mode-source-artifact-into-the-live-fui-wo/) can wire the FUI block-explorer's author-mode panel (workbench epic [#746](/backlog/746-block-explorer-interactive-fui-block-workbench/)). **(a) Form-set** — `AuthorModeForm` names five forms but FUI faithfully emits three; the recommendation is to ship the three and carve the missing `html`/`jsx` text emitters. **(b) Generation-home** — author-mode source is static display text, so build-emit it as data the thin-descriptor registry carries rather than standing up a live `/_maas/` endpoint. The first is sequencing; the second is the one genuine fork.

## The axis — what is genuinely open, grounded in the FUI tree

The author-mode panel (`fui:workbench/authorMode.ts`) is built and form-count-agnostic: it renders exactly one tab per `source.forms` entry (`fui:workbench/authorMode.ts:98-110`), with a `lossy`/`diagnostics` pair surfaced as a `⚠ Lossy` flag under the **"flag, don't fake"** doctrine (`fui:workbench/authorMode.ts:12-15`, `:32-34`, `:87-90`). What it lacks is *data*. FUI lowers its case fixtures (`fui:blocks/renderers/component/__fixtures__/component-cases.ts`) to **3 of the 5** forms — `declarative` (def text), `wc-class` (`generateClassSource`, `fui:blocks/renderers/component/declarativeComponent.ts:152`), `functional` (`generateFunctionalSource`, `fui:blocks/renderers/functional/functionalComponent.ts:44`) — with **no `html`/`jsx` text emitter and no lossy/diagnostics computation** anywhere in the tree. The WE emitter + committed artifact that once supplied this were **deleted by #1730** (the #1282 zero-impl rule), so generation is now wholly a FUI concern off FUI's own fixtures. Separately, the thin-descriptor registry `WORKBENCH_BLOCKS` (`fui:workbench/registry.ts:276`) already declares an inert `authorSource?: AuthorModeSource` data slot (`fui:workbench/registry.ts:143-147`, same class as `cem?`), and `/_maas/` (`fui:vite.maas.config.mts`) serves only consume-mode wrapper bytes + CEM data + a 404ing functional route — **never author-mode source**. The `/_maas/` origin exists for cross-origin framework-dep bytes needing transpile/bundle (#1499/#955), none of which static source text requires. This sits under [#1731](/backlog/1731-workbench-resolves-block-shape-from-the-fui-maas-serve-url-no/)'s ratified architecture: the workbench is thin UI over rendering, and `authorSource` was **settled (not a fork) to cross as pre-emitted DATA the panel reads directly, no live instance** (source-only blocks return `null` from `fui:workbench/loader.ts:37-43`).

## Recommended path at a glance

| Sub-call | Shape | Recommended | Why |
|---|---|---|---|
| **Fork 1 — form-set v1 scope** | sequencing, not a true fork | **Scope v1 to the 3 faithfully-emitted forms; carve `html`/`jsx` text emitters + lossy/diagnostics to a follow-up** | Panel renders exactly the forms it's handed (`fui:workbench/authorMode.ts:98-110`); the emitters don't exist; adding them later changes nothing for the consumer. |
| **Fork 2 — generation-home** | genuine fork | **(B) build-emit author-source as descriptor data; not a live `/_maas/` endpoint** | Static display text needs none of `/_maas/`'s transpile/bundle/cross-origin machinery; the `authorSource?` slot + #1731's "pre-emitted data" settled note already chose this shape. |

## Fork 1 — form-set v1 scope: 3 faithful forms now, or build html/jsx first

*Fork-existence:* this is **sequencing, not a forced either/or** — both branches converge on the same panel and interface; the only difference is how many tabs appear in v1, and nothing downstream blocks on all five (`fui:workbench/mount.ts` consumes whatever `source.forms` holds). Recorded here because the card posed it and the v1 surface is a real call, but it fails the fork-existence test as a *merit* fork.

- **(default) Scope v1 to the 3 faithfully-emitted forms** — `declarative`, `wc-class`, `functional`. Register the cases with a 3-entry `authorSource.forms`; the panel renders 3 tabs. File the missing `html`/`jsx` source-text emitters **+ their lossy/diagnostics computation** as a follow-up build story under #746 (the "flag, don't fake" path: when an `html`/`jsx` emitter lands but can't honour a case faithfully, it arrives `lossy: true`). No empty/faked tabs in the interim.
- **(b) Build the `html`/`jsx` text emitters now** so the panel ships all five. No distinct benefit to v1 — it only adds two tabs whose emitters must first be written — and it bundles a separate emitter-build into the wiring slice, against the bias toward small independently-deliverable slices.

*Skeptic: SURVIVES → 3-form v1 default holds. Verified the panel is form-count-agnostic (one tab per `source.forms` entry, `fui:workbench/authorMode.ts:98-110`) — a 3-form source does not cripple it — and confirmed no `html`/`jsx` text emitter exists anywhere under `fui:blocks/renderers/`. "Build now vs later" is genuine sequencing, not a fork.*

## Fork 2 — generation-home: build-emit descriptor data vs a live /_maas/ endpoint

*Fork-existence:* a real either/or — the two are mutually exclusive as the **transport** the workbench consumes (a runtime fetch vs a build-time data slot), and (a) is the weaker branch on this artifact class (it routes static text through module-serving machinery).

- **(B) Build-emit author-source as data the descriptor's `authorSource` slot carries** *(default)* — a FUI build step generates the `AuthorModeSource` for each case from `fui:blocks/renderers/component/__fixtures__/component-cases.ts` via the existing emitters and populates the `authorSource?` slot in `fui:workbench/registry.ts`. This is **inert display data** (the same class as the existing `cem?` slot, `fui:workbench/registry.ts:143-147`), so it does **not** re-introduce the imperative `load`/`create` closures #1731 Fork 2 banished from `fui:workbench/registry.ts`. Matches #1731's settled "authorSource crosses as pre-emitted data, panel reads data only, no live instance." Author-mode source needs no transpilation, no framework deps, no cross-origin — none of `/_maas/`'s reason for being.
- **(a) A live `/_maas/` author-source endpoint** — the workbench fetches source text at runtime. Buys dev HMR (edit a fixture → see new source without a registry rebuild) but conflates "serve a transpilable mountable module" with "serve already-rendered source text for a tab," and pays a route + fetch for static text. The HMR win is narrow: the block is source-only (no live instance to keep in sync) and there are ~9 fixtures.

*Skeptic: SURVIVES-WITH-AMENDMENT → (B) build-emit holds. Verified the "no hard-coded literals" #1731 concern does not apply — `authorSource` is inert data like `cem?`, not a behavioural closure (`fui:workbench/registry.ts:143-147`) — and the HMR attack is real but narrow (source-only block, ~9 fixtures). Amendment folded: the build-emitted slot is the **v1 interim**; a dev-server live-read off the sibling path is the documented **upgrade seam** (already flagged at `fui:workbench/registry.ts:144`), not a v1 requirement.*

## Lineage

Opened 2026-06-27 as the two design sub-calls [#1618](/backlog/1618-wire-the-we-author-mode-source-artifact-into-the-live-fui-wo/) surfaced when it was claimed-and-released (it can't be clean wiring until these resolve). Prepared 2026-06-27: FUI-tree survey + the #1730/#1731/#1752 lineage, published as research topic `fui-workbench-author-mode-source-home` and report [we:reports/2026-06-27-fui-workbench-author-mode-source-home.md](reports/2026-06-27-fui-workbench-author-mode-source-home.md). Ratifying both forks unblocks #1618's build.
