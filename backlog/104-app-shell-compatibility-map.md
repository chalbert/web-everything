---
type: decision
workItem: story
size: 5
parent: "099"
status: open
dateOpened: "2026-06-06"
preparedDate: "2026-06-11"
tags: [app-shell, micro-frontend, micro-apps, meta-framework, compatibility-map, spa, routing, evergreen, dashboard, platform]
relatedReport: reports/2026-06-11-app-shell-compatibility-map.md
crossRef: { url: /backlog/099-evergreen-app-vision/, label: "Evergreen app (#099)" }
---

# App shell + micro-app compatibility map — a thin meta-framework that loads independent apps as one SPA, with a compatibility chart

A **minimal-dependency app shell** (meta-framework / "App Shell") that manages loading + routing of pages, where each page is an independently-developed **micro-app**. On navigation, the shell decides whether the next page can load **inside the same SPA** (compatible) or needs a **hard refresh** (incompatible), and avoids re-loading code already present. The Platform then exposes a **compatibility map** showing which pages can coexist — surfacing the apps that would benefit from conversion. From the essay's *Micro Apps / Ideal micro-apps setup* sections (`reports/2026-06-06-front-end-platform-book.md:364-423`).

**Digest.** No design exists yet. The three forks below — **home** (protocol vs. Plateau product), the **compatibility-chart schema**, and the **memory-eviction model** — are grounded in the published [App Shell + Micro-App Compatibility Map](/research/app-shell-compatibility-map/) survey (single-spa, Module Federation, import maps; MDN browser-compat-data; the Storage eviction model). Each fork carries a recommended default in **bold**, defaulting to existing platform/constellation vocabulary over new coinage. Ratify all three, or override only the one you'd change.

## Why it matters for the evergreen vision

This is how an evergreen app ([#099](/backlog/099-evergreen-app-vision/)) tolerates apps updating at different speeds: an app that *didn't* update still runs — in the worst case on an **older app shell** — and is **flagged on the dashboard**, with the specific incompatibilities highlighted so an intervention can be planned (`reports/2026-06-06-front-end-platform-book.md:1426`). Compatibility degrades gracefully instead of breaking. Over time, shared design patterns + the Platform API/Web-Component layer (the "frameworkless future") shrink the incompatible set.

## Axis framing — three orthogonal forks pinned to the tree

The survey separates three independent axes that don't collapse into each other:

- **Home** — *where the artifact lives*. WE's settled stance is that **npm/git stay the source of bytes and versions** and Plateau is a **control plane over provider↔consumer relationships** ([092-provider-consumer-graph-platform-manager.md:17](092-provider-consumer-graph-platform-manager.md)). So the declared *chart* is a standards artifact (a protocol), and the live *map* is a view over that graph (a Plateau product). The two are not the same decision.
- **Schema** — *what an app declares*. The forward-looking dual of the **`changelog-manifest`** protocol ([protocols.json:86](../src/_data/protocols.json#L86)), which already standardizes per-module semver severity + migration linkage. The chart says not *what changed* but *what I require to run here*. Prior art for the matrix shape is MDN **browser-compat-data**: a `support` map keyed by agent, statements carrying ranged versions + `partial_implementation` + `status`.
- **Eviction** — *what unmounts under pressure*. Orthogonal to both: the long-lived-SPA memory problem the essay leaves open (`reports/2026-06-06-front-end-platform-book.md:406`). The platform's **Storage eviction model** (best-effort/persistent classes + LRU under a quota) is the borrowable default.

Adapters-via-DI (**webinjectors**, [#094](/backlog/094-ai-upgrader-tools/)) is a *fixed mechanic* across all three, not a fork: converting an old setup to the new API without loading the old impl is what makes "hard refresh" the last resort.

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · home** | split: thin `app-shell-compatibility` **protocol** (webmanifests) + live map as **Plateau** view of #092 | single home (protocol-only or product-only) *(rejected)* | **High** — matches the bytes-vs-control-plane stance |
| **2 · schema** | declare a **flat requirement manifest** (shell range + provider ranges + conflicting globals, semver per changelog-manifest); compute the BCD-style matrix as the rendered view | full BCD-style support matrix as the *declared* artifact | **Med-high** — flat declaration is grounded; render altitude is the real call |
| **3 · eviction** | borrow the **Storage model** — best-effort/persistent classes + LRU under a mounted-app budget; unmount via lifecycle, keep bundle cached | bespoke policy / no eviction | **Med** — model is sound; budget + pin policy need ratifying |

## Fork 1 — where does this live: protocol vs. Plateau product?

**Crux.** WE refuses project-facing formats and re-hosting; npm/git stay the source of bytes, and Plateau is the **control plane over provider↔consumer relationships** ([092-provider-consumer-graph-platform-manager.md:17](092-provider-consumer-graph-platform-manager.md)). The compatibility *chart* is something micro-apps declare against — a contract — while the compatibility *map* is a cross-app introspection view that *renders on the #092 graph* (which app, on which shell/API version, where incompatible).

- **(A — recommended) Split the home.** A thin **`app-shell-compatibility` protocol** owned by **webmanifests** (alongside `changelog-manifest`, [protocols.json:86](../src/_data/protocols.json#L86)) defines the declared chart; the **live map is a Plateau dashboard** view of the #092 graph. Each artifact sits where it belongs — the escapable standards lock is the protocol, the product is zero-lock devtooling. Cost: two homes to set up, but they're genuinely different concerns.
- **(B) Single home.** Protocol-only (no live product) or product-only (a Plateau feature with an ad-hoc internal format). Cheaper now; collapses two legitimate end-states and either yields no live map or buries the contract inside a product as lock-in. *Rejected* — bias toward separation; the bytes-vs-control-plane line is already drawn in #092.

## Fork 2 — the compatibility-chart schema

**Crux.** What does a micro-app *declare*, and at what altitude? Prior art splits between a lightweight declared manifest and a rich computed matrix. MDN **browser-compat-data** ([compat-data-schema](https://github.com/mdn/browser-compat-data/blob/main/schemas/compat-data-schema.md)) is the reference matrix shape: a `support` map keyed by agent, each statement carrying `version_added` (incl. ranged `"≤50"`), `version_removed`, `partial_implementation`, `flags`, and a `status` object. The recurring incompatibility sources to encode are: required **shell/Platform-API version**, required **provider/shared-dependency ranges**, and **conflicting-global** claims (tag names, routes, globals).

- **(A — recommended) Declare flat, render rich.** Each app declares a **flat requirement manifest** — required shell range + required provider ranges + conflicting-global claims, using **semver ranges** per `changelog-manifest`. The Platform **computes** a BCD-style support matrix (per-provider ranged/partial/status statements) as the *rendered map view*. Borrow BCD's `partial_implementation` nuance so a page can be **degraded-compatible** (runs, flagged), not just binary — this is the essay's "older shell, flagged on the dashboard" (`reports/2026-06-06-front-end-platform-book.md:1426`). Cost: two representations (declared vs. computed), but they serve different readers.
- **(B) Declare the full matrix.** Apps author the full BCD-style support matrix directly. *Rejected* — overweight to author and hand-maintain; BCD's matrix is a *generated/curated* artifact, not something each app declares. The declared layer should be minimal; nuance is computed.
- **Sub-decision (defer):** exact `status`/Baseline surfacing on the map (which apps are pinned to deprecated providers) — borrow BCD `status` but settle field names when authoring.

## Fork 3 — memory / eviction model for the long-lived SPA

**Crux.** The essay states the problem and leaves it open: *"you cannot load stuff infinitely, even if conflicts are managed"* (`reports/2026-06-06-front-end-platform-book.md:406`). The platform already specifies a graceful-degradation eviction model — the **Storage API eviction model** ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)): two persistence classes (best-effort, evictable; persistent, opt-in, skipped) with **LRU** eviction under a quota.

- **(A — recommended) Mirror the Storage model as a policy dimension.** A mounted micro-app has a **persistence class** (pin the current route / keep-alive opt-in; background pages evictable by default), an **LRU policy** under a **mounted-app budget**, and **unmount = single-spa's `unmount` lifecycle** (tear down, release global/tag claims, keep the bundle cached for fast re-mount). LRU is the default; pinning is the author opt-in (most-flexible default; the restriction is opt-in). Degrades gracefully, exactly like storage.
- **(B) Bespoke policy or no eviction.** Invent a custom heuristic, or punt (the essay's non-answer). *Rejected* — reinvents a solved web-platform model and forgoes the borrowed vocabulary; "no eviction" reintroduces the unbounded-memory failure the fork exists to solve.
- **Sub-decision (ratify):** the budget unit (count of mounted apps vs. a heap estimate) and whether the pinned/keep-alive class is per-route or author-declared on the chart (Fork 2).

## Open questions carried into authoring

- Fork 1: confirm the protocol name and that **webmanifests** is its home (vs. a new project).
- Fork 2: settle the flat-manifest field set (shell range / provider ranges / conflicting-global shape) and the BCD `status`/Baseline surfacing.
- Fork 3: ratify the budget unit and the pin/keep-alive declaration site.

## Resolution (partial) — 2026-06-11

- **Fork 3 — mirror the Storage eviction model as a policy dimension**: ratified. A mounted micro-app carries a persistence class (background pages best-effort/evictable by default; current route / keep-alive opt-in pinned), LRU eviction under a mounted-app budget, and unmount via single-spa's `unmount` lifecycle (tear down, release global/tag claims, keep the bundle cached). LRU is the default and pinning is the author opt-in (most-flexible-default — the restriction is opt-in), borrowing the platform's own Storage persistence model rather than inventing a heuristic. (The budget unit and pin declaration site remain a follow-on settle within this ratified model.)

**Open — needs a human call (two pins):**

1. **Fork 1 — the home**: the bytes-vs-control-plane *split* in shape is sound, but the concrete commit stays open — the protocol's **name** and whether it's owned by **webmanifests** (alongside `changelog-manifest`, [protocols.json:86](../src/_data/protocols.json#L86)) vs. a net-new project. This is a naming + project-scope decision on shared registries, so it needs a human ruling.
2. **Fork 2 — the compatibility-chart schema altitude**: "declare a flat requirement manifest (shell range + provider ranges + conflicting-global claims) + compute a rich BCD-style matrix as the rendered view" is a genuine altitude call (declared-flat vs. declared-rich), not a mechanical default — the flat-declaration direction is grounded, but where the rich/computed layer sits and the `partial_implementation`/`status` surfacing are a real design judgment to confirm.
