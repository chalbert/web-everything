---
kind: decision
parent: "746"
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: 1618
codifiedIn: "docs/agent/platform-decisions.md#workbench-inert-data-static-slot"
preparedDate: "2026-06-27"
relatedReport: reports/2026-06-27-fui-workbench-author-mode-source-home.md
tags: [block-explorer, workbench, author-mode, maas, fui]
---

# Author-mode-source form-set + generation-home for the FUI workbench

Two build-blocking sub-calls before [#1618](/backlog/1618-wire-the-we-author-mode-source-artifact-into-the-live-fui-wo/) can wire the FUI block-explorer's author-mode panel (workbench epic [#746](/backlog/746-block-explorer-interactive-fui-block-workbench/)). **(a) Form-set** — `AuthorModeForm` names five forms but FUI faithfully emits three; **RATIFIED** to ship the three and carve the missing `html`/`jsx` text emitters. **(b) Generation-home** — author-mode source is inert display text in the same class as `cem`, so it rides as a **static `authorSource` slot in the descriptor registry** (read synchronously for first render), with **dev freshness via the existing `/_maas/data/<tag>.json` HMR re-fetch that `cem` already uses (#1751)**. `/_maas/`'s transpile/serve role stays reserved for live modules. Sub-call (a) is sequencing; (b) resolved to **(B)** after a discussion that considered — and rejected — making `/_maas/` the primary transport (see Fork 2).

## The axis — what is genuinely open, grounded in the FUI tree

The author-mode panel (`fui:workbench/authorMode.ts`) is built and form-count-agnostic: it renders exactly one tab per `source.forms` entry (`fui:workbench/authorMode.ts:98-110`), with a `lossy`/`diagnostics` pair surfaced as a `⚠ Lossy` flag under the **"flag, don't fake"** doctrine (`fui:workbench/authorMode.ts:12-15`, `:32-34`, `:87-90`). What it lacks is *data*. FUI lowers its case fixtures (`fui:blocks/renderers/component/__fixtures__/component-cases.ts`) to **3 of the 5** forms — `declarative` (def text), `wc-class` (`generateClassSource`, `fui:blocks/renderers/component/declarativeComponent.ts:152`), `functional` (`generateFunctionalSource`, `fui:blocks/renderers/functional/functionalComponent.ts:44`) — with **no `html`/`jsx` text emitter and no lossy/diagnostics computation** anywhere in the tree. The WE emitter + committed artifact that once supplied this were **deleted by #1730** (the #1282 zero-impl rule), so generation is now wholly a FUI concern off FUI's own fixtures. Separately, the thin-descriptor registry `WORKBENCH_BLOCKS` (`fui:workbench/registry.ts:276`) already declares an inert `authorSource?: AuthorModeSource` data slot (`fui:workbench/registry.ts:143-147`, same class as `cem?`), and `/_maas/` (`fui:vite.maas.config.mts`) serves only consume-mode wrapper bytes + CEM data + a 404ing functional route — **never author-mode source**. The `/_maas/` origin exists for cross-origin framework-dep bytes needing transpile/bundle (#1499/#955), none of which static source text requires. This sits under [#1731](/backlog/1731-workbench-resolves-block-shape-from-the-fui-maas-serve-url-no/)'s ratified architecture: the workbench is thin UI over rendering, and `authorSource` was **settled (not a fork) to cross as pre-emitted DATA the panel reads directly, no live instance** (source-only blocks return `null` from `fui:workbench/loader.ts:37-43`).

## Recommended path at a glance

| Sub-call | Shape | Recommended | Why |
|---|---|---|---|
| **Fork 1 — form-set v1 scope** | sequencing, not a true fork | **Scope v1 to the 3 faithfully-emitted forms; carve `html`/`jsx` text emitters + lossy/diagnostics to a follow-up** | Panel renders exactly the forms it's handed (`fui:workbench/authorMode.ts:98-110`); the emitters don't exist; adding them later changes nothing for the consumer. |
| **Fork 2 — generation-home** | genuine fork → ratified (B) | **(B) static `authorSource` registry slot like `cem`; dev freshness via the existing `/_maas/data/` HMR re-fetch** *(ratified 2026-06-27 ~80%, revisit if MaaS matures)* | `cem` — the documented same-class sibling — is a static slot read directly (`fui:workbench/registry.ts:247`, `fui:workbench/mount.ts:267`); `/_maas/` is fetched only for transpilable live modules (`fui:workbench/loader.ts:28-31`). Dev staleness is solved by `cem`'s existing file-watch → HMR → `/_maas/data/` re-fetch loop, not by reclassifying the primary transport. |

## Fork 1 — form-set v1 scope: 3 faithful forms now, or build html/jsx first

**RATIFIED 2026-06-27 → (default) scope v1 to the 3 faithfully-emitted forms** (`declarative`, `wc-class`, `functional`). The `html`/`jsx` text emitters + their lossy/diagnostics computation are carved to a follow-up build story under #746. Grounding confirmed the panel is form-count-agnostic ([fui:workbench/authorMode.ts:98-110](../../../frontierui/workbench/authorMode.ts#L98-L110)) and no `html`/`jsx` emitter exists under `fui:blocks/renderers/`.

*Fork-existence:* this is **sequencing, not a forced either/or** — both branches converge on the same panel and interface; the only difference is how many tabs appear in v1, and nothing downstream blocks on all five (`fui:workbench/mount.ts` consumes whatever `source.forms` holds). Recorded here because the card posed it and the v1 surface is a real call, but it fails the fork-existence test as a *merit* fork.

- **(default) Scope v1 to the 3 faithfully-emitted forms** — `declarative`, `wc-class`, `functional`. Register the cases with a 3-entry `authorSource.forms`; the panel renders 3 tabs. File the missing `html`/`jsx` source-text emitters **+ their lossy/diagnostics computation** as a follow-up build story under #746 (the "flag, don't fake" path: when an `html`/`jsx` emitter lands but can't honour a case faithfully, it arrives `lossy: true`). No empty/faked tabs in the interim.
- **(b) Build the `html`/`jsx` text emitters now** so the panel ships all five. No distinct benefit to v1 — it only adds two tabs whose emitters must first be written — and it bundles a separate emitter-build into the wiring slice, against the bias toward small independently-deliverable slices.

*Skeptic: SURVIVES → 3-form v1 default holds. Verified the panel is form-count-agnostic (one tab per `source.forms` entry, `fui:workbench/authorMode.ts:98-110`) — a 3-form source does not cripple it — and confirmed no `html`/`jsx` text emitter exists anywhere under `fui:blocks/renderers/`. "Build now vs later" is genuine sequencing, not a fork.*

## Fork 2 — generation-home: build-emit descriptor data vs a live /_maas/ endpoint

**RATIFIED 2026-06-27 → (B), after considering and rejecting (a).** Author-source is inert display text in the `cem` class; it rides as a **static `authorSource` slot** in `fui:workbench/registry.ts`, read directly for first render, with **dev freshness via the existing `/_maas/data/<tag>.json` HMR re-fetch `cem` already runs (#1751)**. `/_maas/`'s transpile/serve role stays reserved for transpilable live modules.

> **Revisit trigger (ratified-with-caveat).** Ratified at ~80% confidence. If/when the MaaS layer matures — e.g. `/_maas/data/` becomes the routine transport for *all* descriptor data, or a server-side author-source generation path lands that makes a live route the path of least resistance — **revisit whether the static slot is still the right *primary* transport** (it may then be cleaner to serve author-source from `/_maas/data/` directly, as (a) proposed). This is a maturity-gated reversal, not deferred work: nothing to build until the trigger fires; the (B) build proceeds now. Reversal is cheap — the consumer reads `block.authorSource` either way; only where the baseline value comes from changes.

*Dev-time mechanism (mirrors `cem`):* (1) a FUI build/probe step regenerates the author-source data from `fui:blocks/renderers/component/__fixtures__/component-cases.ts` via the existing emitters; (2) first render reads the static `authorSource` slot synchronously — no fetch; (3) editing a fixture in dev changes the data manifest, and a dev-only watcher plugin (`fui:vite.config.mts:70-86`, the `cemHotReload` pattern) fires an HMR event; (4) the workbench demo (`fui:demos/workbench.ts:33-44`) re-fetches `/_maas/data/<tag>.json` — a static **data** route ("consuming data, not running the transform", [#1731:108](/backlog/1731-workbench-resolves-block-shape-from-the-fui-maas-serve-url-no/)) — and calls `handle.refresh()`. No registry rebuild, no stale content. The author-source slice adds `authorSource` to that same `/_maas/data/` payload and listens on the same (or a sibling) HMR event.

*Discussion trail (why (a) was considered and dropped):* mid-discussion the recommendation flipped to (a) — a `/_maas/` author-source endpoint as the *primary* consumption interface — on two arguments, both of which collapsed. (i) *"Keep the workbench off a FUI dependency"* — **retracted**: the workbench **is** in FUI, so consuming FUI's own emitter output is intra-repo, no cross-repo edge. (ii) *"#1731's headline rejects hardcoded literals"* — an **over-read**: #1731's "no literals / banished closures" targets **live-instance resolution** (imperative `load`/`create`), not inert display data; `cem` is itself a static literal slot (`fui:workbench/registry.ts:247`) and #1731 was fine with it. Grounding the sibling precedent settled it: `cem` (documented same-class slot) is read directly as `block.cem` (`fui:workbench/mount.ts:267`, `:683`); only transpilable polyglot live forms are fetched from `/_maas/` (`fui:workbench/loader.ts:28-31`). Author-source matches `cem`, not the live-module class.

*Fork-existence:* a genuine either/or on the **primary transport** (static slot vs runtime fetch) — resolved to the static slot by the `cem` sibling precedent; the `/_maas/data/` re-fetch is the dev-only freshness seam, not the primary interface.

- **(B) Static `authorSource` registry slot, read directly — like `cem`** *(ratified 2026-06-27, revisitable if MaaS matures)* — baseline value carried in `fui:workbench/registry.ts`; dev freshness via the existing `/_maas/data/` HMR re-fetch. No new primary transport; `/_maas/`'s transpile role untouched. It is **inert display data** (same class as `cem?`, `fui:workbench/registry.ts:143-147`), so it does **not** re-introduce the imperative `load`/`create` closures #1731 Fork 2 banished.
- **(a) `/_maas/` author-source endpoint as the primary transport** *(rejected)* — would make every author-source read a runtime fetch, diverging from the `cem` sibling for no benefit: the only upside (dev freshness) is already delivered by `cem`'s HMR re-fetch seam without reclassifying the baseline transport, and it would route static display text through machinery scoped to transpilable bytes (#1499/#955).

*Skeptic: the prepared (B) default holds — strengthened, not amended. A mid-discussion (a) flip was driven by a retracted dependency argument and a #1731 misread; grounding the `cem` sibling (`fui:workbench/mount.ts:267`) plus the dev HMR mechanism (`fui:vite.config.mts:70-86` → `fui:demos/workbench.ts:33-44`) reversed it back to (B). The dev-freshness concern that motivated (a) is met by `cem`'s existing `/_maas/data/` re-fetch seam, with no change to the primary transport.*

## Lineage

Opened 2026-06-27 as the two design sub-calls [#1618](/backlog/1618-wire-the-we-author-mode-source-artifact-into-the-live-fui-wo/) surfaced when it was claimed-and-released (it can't be clean wiring until these resolve). Prepared 2026-06-27: FUI-tree survey + the #1730/#1731/#1752 lineage, published as research topic `fui-workbench-author-mode-source-home` and report [we:reports/2026-06-27-fui-workbench-author-mode-source-home.md](reports/2026-06-27-fui-workbench-author-mode-source-home.md). Ratifying both forks unblocks #1618's build.
