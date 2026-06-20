# Deck dogfood readiness map — which deck contracts must ship before a deck can render

**Status:** analysis for #1215 (first slice of the dogfood epic #1210). **Date:** 2026-06-20.

The deck/slide standards (carved from epic #1173 under the ratified distributed placement #1175) are now
**spec'd** across their kin projects (the batch-2026-06-20-deck run authored #1180–#1200). This map answers
the dogfood question #1210 needs: **which of those contracts must be (a) spec'd, (b) FUI-implemented, and
(c) hosted before an audience deck can actually render** — i.e. the dependency gate that says *which deck
can render when*.

## The three readiness states

Per the docs-rendering boundary (#765/#777, and the WE↔FUI constellation split): WE owns the **contract**
(spec'd), FUI owns the **rendered component** (FUI-implemented), and a served/hosted surface is **plateau**
(hosted). A deck renders only when every contract on its critical path has cleared all three. The honest
state today:

- **Spec'd** — the WE contract exists (registry entry / conformance vectors / project-partial section).
- **FUI-implemented** — a Frontier UI component conforms to and renders the contract. **None yet** — this
  is the load-bearing residual the whole epic gates on.
- **Hosted** — served behind the plateau product surface. **None yet** (downstream of FUI).

## Contract inventory & state

| # | Contract | Home | Spec'd | FUI | Hosted | On the minimal-deck critical path? |
|---|----------|------|:---:|:---:|:---:|---|
| #1180 | Deck document model (protocol) | webcomponents | ✓ | — | — | **Yes** — load-bearing; everything keys off it |
| #1191 | Slide layout-template vocabulary | webcomponents | ✓ | — | — | **Yes** — slides need a layout to fill |
| #1179 | Advanceable-sequence intent family | webintents | ✓ | — | — | **Yes** — the advance kernel |
| #1181 | Fragment / incremental-reveal | webintents | ✓ | — | — | No — enhances; a static deck renders without it |
| #1182 | Slide addressing (semantic) | webintents | ✓ | — | — | No — deep-linking, not first render |
| #1187 | Overview / slide-sorter | webintents | ✓ | — | — | No — navigator affordance |
| #1188 | Timed-advance / autoplay | webintents | ✓ | — | — | No — kiosk/autoplay only |
| #1199 | Up-next preview | webintents | ✓ | — | — | No |
| #1200 | Interstitial / scheduled-insertion | webintents | ✓ | — | — | No |
| #1197 | Animation-orchestration | webintents | ✓ | — | — | No — build-in polish |
| #1183 | Reduced-motion conformance vectors | webtraits | ✓ | n/a | n/a | **Conformance gate** — FUI render must pass it |
| #1195 | Presentation-a11y vector set (tag `deck`) | webtraits | ✓ | n/a | n/a | **Conformance gate** — the single "is it conformant?" story |
| #1185 | Speaker-notes (semantic) | webresources | ✓ | — | — | No — presenter view only |
| #1189 | Paged-media export (semantic/rules) | webresources | ✓ | — | — | No — export path, not on-screen |
| #1190 | Scoped per-slide/section theming | webtheme | ✓ | — | — | Soft — a deck renders on the project theme without it |
| #1192 | Embedded-deck postMessage (protocol) | webportals | ✓ | — | — | No — embedding only |
| #1198 | Fullscreen presentation surface | webportals | ✓ | — | — | Soft — presentation mode, not first render |
| #1196 | Code-view step-through | webdocs (code-view block) | ✓ | partial¹ | — | No — code slides only |
| #1193 | Deck analytics vocabulary | webanalytics | ✓ | — | — | No — instrumentation |

¹ code-view itself is a `status: concept` block; the step-through extension is spec'd onto it, FUI impl of
the base block is the prerequisite.

**Held / out of this map** (relatedProject is a `concept` project — D3-readiness demoted, the standard must
ship first): **#1184** presenter-mode cross-window sync (webrealtime), **#1186** fit-to-viewport scaling
(webpositioning), **#1194** remote-control multiplex (webrealtime). The fit-scale and presenter traps are
*captured as conformance vectors* in #1195 even though their owning projects aren't ready, so the obligation
isn't lost.

## The render-when gate (what #1210 actually waits on)

A **minimal static audience deck** (slides with layouts, advance next/prev, conformant a11y) can render as
soon as FUI implements just the **critical-path** rows:

1. **#1180 document model** + **#1191 layout templates** — the structure and the slide surfaces.
2. **#1179 advanceable-sequence** — next/prev advance.
3. Passing **#1183 + #1195** conformance vectors — reduced-motion gate + the deck a11y set.

Everything else (fragments, autoplay, overview, presenter, embed, analytics, export, scoped theming) is an
**additive layer** a richer deck turns on later — none blocks first render. So the epic's gating is narrow:
**FUI must build a deck component conforming to 3 contracts + 2 vector sets**; that is the single dependency
the rest of #1210 (the dogfood render slices) waits on. Hosting is strictly downstream of that FUI build.

## Bottom line

- **Spec'd: 19/19** deck contracts (this batch) — the WE-layer is complete; no contract is missing for a
  first render.
- **FUI-implemented: 0/19** — the whole epic is now gated on **one FUI build** (the critical-path 3 + 2
  vector sets), not on more WE spec work.
- **Hosted: 0/19** — downstream of FUI; not yet on the critical path.

The actionable next slice for #1210 is therefore an **FUI deck-component build** against the critical-path
contracts, gated green by the #1183/#1195 vector suites — not further WE authoring.
