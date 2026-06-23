---
kind: decision
parent: "1684"
status: open
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
preparedDate: "2026-06-23"
locus: webeverything
tags: [webrouting, routing, url-state, persistence, stateful-components]
---

# webrouting URL-as-state seam — one shared serialize/sync provider vs per-component declaration

Settle the seam by which stateful components project state to and from the URL — a grid's filters/sort/page, a tab, a wizard step, pagination. **Recommended: Fork 1 (c)** per-component declaration over a shared codec, with intra-component microtask coalescing and an *optional* coordinator that batches cross-component writes into one history entry (med-high); **Fork 2 (b)** a typed per-slice codec, not raw strings (med-high). Three invariants ratify (never-force · reuse `url|session|memory` · webrouting-not-storage). Grounded in [/research/url-as-state-component-seam](/research/url-as-state-component-seam/).

## Axis framing

The concern decomposes into three settled invariants + two genuine forks, each pinned to the real tree:

- **Never force** (ratify). Whether a slice is URL-synced is a per-slice opt-in with a permissive non-URL default (most-flexible-default rule). Not a fork.
- **Reuse the persistence vocabulary** (ratify). The "URL or not" axis is the navigation intent's `persistence` (`url | session | memory`, `we:src/_data/intents/navigation.json`) generalized to each slice — already declared by `tabs` (`persistence: memory`) and exercised by `stepper` (`session`). Not a fork.
- **Placement: webrouting, not webstates storage** (ratify). `we:src/_data/protocols/storage.json`'s `CustomStorageStrategy` seam is scoped explicitly to "durable structured-record stores ONLY" (IndexedDB/localStorage) and carves out non-durable facets; the `persistence` axis lives in navigation. The shareable/navigable/history-tied URL is routing's facet by the tree's own carve-outs. Not a fork.
- **Seam shape** → **Fork 1**. Today there is no shared seam: the only URL sync is pagination's ad-hoc `urlSync: 'none'|'query-param'` (`we:blocks/renderers/pagination/PaginationBehavior.ts:45`), which invented its own `?page=n` encoding via the History API.
- **Param codec** → **Fork 2**. Pagination also does ad-hoc `Number(raw)` coercion (`we:blocks/renderers/pagination/PaginationBehavior.ts:87`); `RouteContext.query` is raw `URLSearchParams` (`we:blocks/router/types.ts:28`).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| Fork 1 — seam shape | **(c) per-component declaration + shared codec; intra-component microtask coalesce; *optional* coordinator batches cross-component writes into one history entry** | (a) central router-coupled provider | Med-high (~70%) |
| Fork 2 — param codec | **(b) typed per-slice serialize/parse + coercion contract (Zod/nuqs plug in), raw-string escape hatch** | (a) raw `URLSearchParams` strings | Med-high (~75%) |

## Fork 1 — the seam shape

**Fork-existence:** a real either/or on *where coordination of concurrent writes lives* — (a) and (c) cannot coexist as the canonical seam (a component is either router-coupled or router-agnostic), and (a)/(b) are positively flawed (below). The choice is structural, not a preference.

**Crux (real-tree refs):** no shared seam exists; pagination direct-writes the URL router-free (`we:blocks/renderers/pagination/PaginationBehavior.ts:45`). A standalone grid on a page with no `<we-route-view>` must still be able to sync. But a grid changing filter+sort+page at once must not push three history entries.

**Options:**

- **(a) Central stateful provider** — one router-coupled provider every stateful block consumes; it owns all encode/decode + history policy. *Rejected:* couples every stateful block to a mounted router and breaks the router-free standalone case the pagination precedent already supports.
- **(b) Pure per-component (shared codec only, no coordinator)** — each component owns read+write with a shared codec helper, no batching layer. *Rejected:* re-creates cross-component history-spam (each slice pushes its own entry).
- **(c) Per-component declaration + shared codec + optional coordinator** — components declare syncable slices **router-agnostically** using a **shared per-slice codec** (Fork 2) on *both* read and write paths; each component **coalesces its own slices into one write per microtask**; an **optional coordinator** additionally batches *cross-component* concurrent writes into one history entry (the nuqs batching model).

**Recommended default: (c).** It keeps components decoupled and router-free (a grid syncs whether or not a router is mounted), formalizes the pagination precedent rather than fighting it, and avoids history-spam via two scoped mechanisms: intra-component microtask coalescing (always) and cross-component coordinator batching (when present). Both write paths share the Fork 2 codec, so there is one encoding, not two.

**Skeptic:** SURVIVES — beat the "have-it-both-ways punt" attack: (c) codifies the shipping direct-write path + an additive optimization, not two speculative paths. **Amended** to close the drift gap the skeptic found: both paths *must* share the per-slice codec (only the commit — one history entry vs N — differs), and the default's "solves multi-slice spam" claim is scoped — self-batching solves *intra*-component, the coordinator solves *cross*-component.

## Fork 2 — the param codec

**Fork-existence:** a forced either/or on the encode/decode contract — raw-strings and a typed contract cannot both be the canonical codec, and (a) is positively flawed (the coercion drift is already in the tree).

**Crux (real-tree refs):** `RouteContext.query` is raw `URLSearchParams` (`we:blocks/router/types.ts:28`), and pagination already re-implements `Number(raw)` coercion ad hoc (`we:blocks/renderers/pagination/PaginationBehavior.ts:87`) — the drift a shared contract exists to kill.

**Options:**

- **(a) Raw `URLSearchParams` strings only** — the platform primitive; each component coerces + validates itself. *Rejected:* loses types, can't cleanly express arrays/nested data, and forces the per-component coercion drift already visible in pagination.
- **(b) Typed per-slice codec** — a declared serialize/parse + coercion contract per slice (number/boolean/enum/date/array), with a raw-string escape hatch. A **strategy lock** like `CustomStorageStrategy` / `CustomChangeStrategy` — Zod / nuqs plug in behind it; WE does not rebuild them.

**Recommended default: (b).** Matches the industry consensus (nuqs typed parsers/serializers, TanStack `validateSearch` schema validation) and kills the ad-hoc coercion already in the tree, while staying a thin contract (the lock), not a re-implementation.

**Skeptic:** SURVIVES — beat the "scope-creep / re-implementing nuqs+Zod" attack: the scope is a per-slice serialize/parse contract (a strategy registry, like the verified storage / change-tracking strategy seams) that *lets* Zod/nuqs plug in. Raw-strings-only is provably insufficient — pagination's `Number(raw)` (`we:blocks/renderers/pagination/PaginationBehavior.ts:87`) is the drift; and no existing layer owns string↔typed URL coercion (webexpressions is a `{{ }}` binding layer; the storage protocol excludes non-durable facets).

---

## Context

- **Settled invariants (ratify, not forks):** never-force (per-slice opt-in, permissive default); reuse `url|session|memory`; webrouting owns the facet (the storage protocol self-excludes it).
- **Contract clauses to spell out at build (skeptic-surfaced):** namespaced query keys (collision arbiter — two components can't both claim `?page`); popstate/navigate is the read source of truth (back/forward restores true state, not a stale cache); pure codec + History-presence-guarded writes (SSR/no-DOM, as pagination already guards).
- **Reads #1685:** the syncable slices ride the canonical route table — settle [#1685](/backlog/1685-webrouting-route-format-source-of-truth-declarative-dom-temp/) (route-format SoT) first.
- **Graduation:** on ratification, carves the URL-as-state build slices under [#1684](/backlog/1684-scaffold-the-webrouting-standard-route-format-profile-url-as/) via `/slice 1684` — the per-slice codec contract + the declaration/coordinator seam + conformance vectors; pagination's ad-hoc `urlSync` migrates onto the seam.
- **Research:** [/research/url-as-state-component-seam](/research/url-as-state-component-seam/) — prior-art survey (nuqs, TanStack Router, React Router, Vue Router) + the options tables.
