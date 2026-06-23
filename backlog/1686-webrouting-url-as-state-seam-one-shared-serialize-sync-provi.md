---
kind: decision
parent: "1684"
status: open
dateOpened: "2026-06-23"
locus: webeverything
tags: [webrouting, routing, url-state, persistence, stateful-components]
---

# webrouting URL-as-state seam — one shared serialize/sync provider vs per-component declaration

Decide how stateful components project state to and from the URL — a grid's filters/sort/page, a tab selection, a wizard step, a disclosure. Nothing is forced: whether any slice lives in the URL is a per-slice choice reusing the navigation persistence vocabulary (url/session/memory) with a permissive default. This fork settles the seam shape, not the policy: one shared serialize/restore provider the components consume, versus each component declaring its own syncable slices.

## What you have to decide

The **mechanism** by which a stateful component's individual state slices (a filter, a sort, a page number, a tab, a wizard step, a disclosure) are serialized to / restored from the URL — *not* whether to do it.

## Settled constraints (not up for decision)

- **Nothing is forced.** Whether a slice lives in the URL is the author's per-slice opt-in, with a permissive default (most-flexible default rule). A grid *can* put filters in the URL; it is never made to.
- **Reuse the existing vocabulary.** The "URL or not" axis is the Navigation Intent's `persistence` (`url | session | memory`, `we:src/_data/intents/navigation.json`) generalized from whole-view navigation down to each slice — do not reinvent it.

## Candidate seam shapes (to be researched + given a default by `/prepare`)

- **One shared serialize/restore provider** — a single webrouting seam (a context/provider) every component consumes; components register syncable slices, the provider owns encode/decode, debounce, and history-vs-replace policy. Consistent, one place for search-param encoding; the cost is a central dependency every stateful block reaches for.
- **Per-component declaration** — each component declares its own syncable slices + their `persistence`, using a thin shared codec but owning its own sync. Looser coupling; the cost is drift in how each component encodes the URL.

## Grounding to gather (`/prepare`)

URL-as-state prior art (nuqs, TanStack Router search params, React Router `useSearchParams`, Vue Router `query`); typed/coerced search-param schemas (the URLPattern gap); how the seam composes with the `router` block's existing `RouteContext { query }` and the Navigation Intent `persistence` axis; debounce / history-entry policy when many slices change at once.

**Next step:** `/prepare 1686` — survey, publish a `/research/` topic, state options + a bold default + confidence, set `preparedDate`.
