---
type: idea
workItem: epic
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:reports/2026-06-19-deck-slide-standards.md"
tags: [deck, slides, presentation, navigation, view-transition, theming, conformance]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Deck/slide standards — the WE contracts a deck built on FUI components must conform to

Umbrella for **all the WE-standards-layer specs needed to support a slide deck/presentation**
(Reveal.js / Slidev / Keynote-on-web class) **built from FUI components**. A deck composes navigation,
view transitions, theming, expressions, keyboard, prefetch, layout, and realtime at once — so this
epic's job is to pin down **which existing WE contracts a deck reuses** vs **the genuine gaps that
need a new WE spec**, then slice the gaps. The deck is the forcing function; the **contracts are the
deliverable** (FUI renders/animates, plateau hosts). Grounded by deep cross-framework +
native-platform research — see relatedReport.

## Scope & boundary

Scoped to the **WE-standards layer** only, per the constellation-layering precedent
([we:docs/agent/platform-decisions.md](../docs/agent/platform-decisions.md), #091/#475): WE owns
contracts/protocols/intents/semantics; the rendered slide/deck **components**, authoring UI, and
animation aesthetics are **FUI**; the hosted/export/collab product is **plateau**. A deck "built on
WE standards + FUI components" means FUI components conform to these WE contracts. **Out of scope:**
the FUI deck components themselves and the plateau deck product (those are tracked in their repos).

## Reuse (no new spec — the deck composes these)

`navigation`/`route`/`deep-link`/`navigation-api` + [we:router](../src/_data/blocks/router.json);
[we:view](../src/_data/blocks/view.json) + `view-transition`; [we:carousel](../src/_data/blocks/carousel.json);
`motion`; `layout` + [we:app-shell](../src/_data/blocks/app-shell.json);
[we:keyboard-shortcuts](../src/_data/blocks/keyboard-shortcuts.json); `design-tokens` + webtheme;
`prefetch` + [we:prefetch-behavior](../src/_data/blocks/prefetch-behavior.json); `surface`;
[we:simple-store](../src/_data/blocks/simple-store.json);
[we:for-each](../src/_data/blocks/for-each.json) + webexpressions; webcomponents; webevents +
[we:broadcast](../src/_data/blocks/broadcast.json); webresources; webportals; webrealtime +
`transport-negotiation`. Full reuse table in the relatedReport.

## Outcome — analysis delivered, slices carved & scattered (RESOLVED)

This epic was the **analysis/triage artifact**: produce the reuse-vs-gap map, ratify where the new
contracts live, and carve the slices. All three shipped — it graduates to the relatedReport.

- **Placement decision (GAP-0) → #1175, RATIFIED B (fully distributed), no `webdecks` project.** The
  governing statute is *#project-protocol-bar* (mint a project only for a genuine cross-cutting domain
  with a provider seam; "already homed" is a valid resolution). A deck is overwhelmingly *reuse*
  composed at the page level, so its contracts **scatter to their kin projects** — which is why this
  epic has **no child umbrella**: the slices are standalone, homed by `relatedProject`.
- **The 21-contract inventory & homes table lives in #1175.** Reuse map (17 existing standards) lives
  in the relatedReport.
- **Slices carved → #1180–#1200** (standalone, each `relatedProject` = its kin project, each
  `blockedBy: #1175` for lineage). The cross-media reframe (deck = one of {deck, video, carousel})
  spun out **#1179 — the temporal/advanceable-media sequence intent family** (its own small epic in
  webintents), the real novel surface and the headline harvest.

The single "is a deck conformant?" story is **a named conformance-vector set (tag `deck`)** — #1195
(a11y) folding in the reduced-motion (#1183) and fit-scale (#1186) correctness traps — which needs no
project to home it, answering B's one real con.
