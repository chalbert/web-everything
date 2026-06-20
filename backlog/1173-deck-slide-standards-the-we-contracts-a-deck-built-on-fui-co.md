---
type: idea
workItem: epic
status: open
dateOpened: "2026-06-19"
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

## Candidate slices (gaps — to be carved after the placement decision)

**Not yet sliced** — pending the deep-research review and the load-bearing placement decision below.
Proposed children, each an independently-deliverable WE spec; *extension* items (cheapest) are
marked **[ext]**:

- **GAP-0 — placement decision (`type:decision`, resolve first):** new `webdecks` project vs
  distribute the new contracts across existing projects. **Carved → #1175** (prepared, ready to
  ratify). Gates the framing/home of every slice below.
- **1 — slide/deck document model** (semantic + intent) — load-bearing data model.
- **2 — fragment / incremental-reveal intent** — finer-than-slide step reveal; overloaded "next".
- **3 — slide addressing / 2D-nav** **[ext]** — two-level deep-link + instant-jump restore.
- **4 — slide-transition + reduced-motion conformance** **[ext]** — gate the native VT API omits.
- **5 — presenter-mode + cross-window sync protocol** — BroadcastChannel current/next/notes/timer.
- **6 — speaker-notes semantic** — per-slide notes, hidden-in-show/shown-in-presenter, persistence.
- **7 — fit-to-viewport fixed-aspect scaling** **[ext]** — extend `fit` + scale-factor shim contract.
- **8 — overview / grid zoom-out intent** — spatial slide-sorter (vs navigation).
- **9 — autoplay / timed-advance** — per-slide timing, pause/resume/loop, Wake Lock.
- **10 — paged-media export protocol** — separate un-scaled paged layout, one slide/page, notes pages.
- **11 — scoped per-slide/section theming** **[ext]** — extend `design-tokens` scoping.
- **12 — slide layout-template vocabulary** — title/section/two-col/code/image/quote slots.
- **13 — embedded-deck postMessage contract** — embed a live deck, state isolation + sync.
- **14 — deck analytics vocabulary** **[ext]** — slide impressions/dwell/drop-off; extend `analytics-vocabulary`.
- **15 — remote-control / multiplex protocol** — clicker + follow-the-presenter (lower priority).
- **16 — presentation accessibility conformance** — reading order, focus, slide-change announce.
- **17 — code-presentation step-through** **[ext]** — line-focus + magic-move; extend [we:code-view](../src/_data/blocks/code-view.json).

The genuinely-novel WE contracts are 1, 2, 5, 10, 12, 13; the rest are extensions to existing
standards or compositions. **Correctness traps to bake as conformance vectors (not author options):**
reduced-motion under View Transitions (4, 16) and fit-scale hit-testing (7).

> This epic is now **sliced** (child #1175 carved; `size` dropped per backlog-workflow epic rules).
> The remaining gap slices above stay as prose candidates until GAP-0 (#1175) is ratified — its
> outcome sets each one's home and artifact kind, so they're carved in a single consistent pass
> afterward rather than re-homed.
