---
type: decision
workItem: story
size: 5
parent: "099"
status: resolved
dateOpened: "2026-06-06"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
preparedDate: "2026-06-11"
tags: [app-shell, micro-frontend, micro-apps, meta-framework, compatibility-map, spa, routing, evergreen, dashboard, platform]
relatedReport: reports/2026-06-11-app-shell-compatibility-map.md
crossRef: { url: /backlog/099-evergreen-app-vision/, label: "Evergreen app (#099)" }
---

# App shell + micro-app compatibility map — a thin meta-framework that loads independent apps as one SPA, with a compatibility chart

A **minimal-dependency app shell** (meta-framework / "App Shell") that manages loading + routing of pages, where each page is an independently-developed **micro-app**. On navigation, the shell decides whether the next page can load **inside the same SPA** (compatible) or needs a **hard refresh** (incompatible), and avoids re-loading code already present. The Platform then exposes a **compatibility map** showing which pages can coexist — surfacing the apps that would benefit from conversion. From the essay's *Micro Apps / Ideal micro-apps setup* sections (`we:reports/2026-06-06-front-end-platform-book.md:364-423`).

**Digest.** **Resolved 2026-06-13** — all three forks ratified at their recommended defaults (see *Resolution (final)*). **Home:** a thin `app-shell-compatibility` **protocol** owned by **webmanifests** + the live map as a **Plateau** view of the #092 graph. **Schema:** declare a **flat** manifest (npm-`peerDependencies`-shaped provider ranges + OSGi-namespaced `globals`/`tagNames`/`routes` claims) and **compute** a BCD-style 3-state matrix as the view. **Eviction:** mirror the Storage model (best-effort/persistent + LRU). Grounded in the [App Shell + Micro-App Compatibility Map](/research/app-shell-compatibility-map/) survey (deepened 2026-06-13: Module Federation 2.0, Native Federation, Piral, qiankun, Luigi, Bit, OSGi, Kubernetes version-skew, BCD). The deep pass corrected an earlier "nobody ships a declared chart" framing — the genuine novelty is a declared *coexistence* contract covering the **DOM dimension** no version-sharing tool models. Successor builds: **#501** (protocol + schema) and **#502** (Plateau map).

## Why it matters for the evergreen vision

This is how an evergreen app ([#099](/backlog/099-evergreen-app-vision/)) tolerates apps updating at different speeds: an app that *didn't* update still runs — in the worst case on an **older app shell** — and is **flagged on the dashboard**, with the specific incompatibilities highlighted so an intervention can be planned (`we:reports/2026-06-06-front-end-platform-book.md:1426`). Compatibility degrades gracefully instead of breaking. Over time, shared design patterns + the Platform API/Web-Component layer (the "frameworkless future") shrink the incompatible set.

## Axis framing — three orthogonal forks pinned to the tree

The survey separates three independent axes that don't collapse into each other:

- **Home** — *where the artifact lives*. WE's settled stance is that **npm/git stay the source of bytes and versions** and Plateau is a **control plane over provider↔consumer relationships** ([we:092-provider-consumer-graph-platform-manager.md:17](/backlog/092-provider-consumer-graph-platform-manager/)). So the declared *chart* is a standards artifact (a protocol), and the live *map* is a view over that graph (a Plateau product). The two are not the same decision.
- **Schema** — *what an app declares*. The forward-looking dual of the **`changelog-manifest`** protocol ([we:protocols.json:86](../src/_data/protocols.json#L86)), which already standardizes per-module semver severity + migration linkage. The chart says not *what changed* but *what I require to run here*. The deep pass pins the shape concretely: a declared block follows **npm `peerDependencies`/`engines` + semver** (plugin-needs-host is the exact analog), **plus OSGi-`Require-Capability`-style namespaced claims** (`globals`/`tagNames`/`routes`) for the DOM dimension version-sharing tools ignore; the rendered matrix follows MDN **browser-compat-data** (`support` map, ranged versions, `partial_implementation`, `status`) — but BCD is *curated/computed, never declared by implementers*, which decides the altitude (declare flat, compute the matrix).
- **Eviction** — *what unmounts under pressure*. Orthogonal to both: the long-lived-SPA memory problem the essay leaves open (`we:reports/2026-06-06-front-end-platform-book.md:406`). The platform's **Storage eviction model** (best-effort/persistent classes + LRU under a quota) is the borrowable default.

Adapters-via-DI (**webinjectors**, [#094](/backlog/094-ai-upgrader-tools/)) is a *fixed mechanic* across all three, not a fork: converting an old setup to the new API without loading the old impl is what makes "hard refresh" the last resort.

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · home** | split: thin `app-shell-compatibility` **protocol** (webmanifests) + live map as **Plateau** view of #092 | single home (protocol-only or product-only) *(rejected)* | **High** — matches the bytes-vs-control-plane stance |
| **2 · schema** | declare **flat** (npm-`peerDependencies`-shaped `providers` ranges + OSGi-namespaced `claims` for globals/tag-names/routes); **compute** the BCD-style matrix as the rendered view, with 3 states + asymmetric skew window | full BCD-style support matrix as the *declared* artifact | **High** — flat-vs-rich altitude is now strongly grounded (BCD is curated-not-declared); the DOM-claims namespace set is the part still to confirm |
| **3 · eviction** | borrow the **Storage model** — best-effort/persistent classes + LRU under a mounted-app budget; unmount via lifecycle, keep bundle cached | bespoke policy / no eviction | **Med** — model is sound; budget + pin policy need ratifying |

## Fork 1 — where does this live: protocol vs. Plateau product?

**Crux.** WE refuses project-facing formats and re-hosting; npm/git stay the source of bytes, and Plateau is the **control plane over provider↔consumer relationships** ([we:092-provider-consumer-graph-platform-manager.md:17](/backlog/092-provider-consumer-graph-platform-manager/)). The compatibility *chart* is something micro-apps declare against — a contract — while the compatibility *map* is a cross-app introspection view that *renders on the #092 graph* (which app, on which shell/API version, where incompatible).

- **(A — recommended) Split the home.** A thin **`app-shell-compatibility` protocol** owned by **webmanifests** (alongside `changelog-manifest`, [we:protocols.json:86](../src/_data/protocols.json#L86)) defines the declared chart; the **live map is a Plateau dashboard** view of the #092 graph. Each artifact sits where it belongs — the escapable standards lock is the protocol, the product is zero-lock devtooling. Cost: two homes to set up, but they're genuinely different concerns. **The deep pass reinforces this exact shape:** MF2's lesson is that *one* manifest (`we:mf-manifest.json`) is the single integration seam read by both the runtime resolver *and* the visualization — so the protocol is one artifact, two consumers (resolver + map), not a format per consumer. And **Zephyr Cloud** (a deployment/version control plane built *over* MF's manifest — immutable versions, promote/rollback) is concrete proof the Plateau-dashboard leg is a viable, valuable product, not a hypothetical.
- **(B) Single home.** Protocol-only (no live product) or product-only (a Plateau feature with an ad-hoc internal format). Cheaper now; collapses two legitimate end-states and either yields no live map or buries the contract inside a product as lock-in. *Rejected* — bias toward separation; the bytes-vs-control-plane line is already drawn in #092.

## Fork 2 — the compatibility-chart schema

**Crux.** What does a micro-app *declare*, and at what altitude? Prior art splits between a lightweight declared manifest and a rich computed matrix. The deep pass settles the *direction* (declare flat) with high confidence and surfaces the genuine remaining call: **which dimensions the declared manifest covers, and the render-state model.**

- **(A — recommended) Declare flat, render rich-computed.** Each app declares a **flat requirement manifest** with two parts:
  - **`providers`** — a Module-Federation-`shared`-shaped / npm-`peerDependencies`-shaped block: required shell range + required provider ranges as **semver** (`changelog-manifest` vocabulary), each marked **`singleton` vs isolatable** and **mandatory vs optional** (npm `peerDependenciesMeta`). Singleton providers force a range *intersection* across all active apps (OSGi `uses` lesson); isolatable ones can get per-app versions via import-map scopes.
  - **`claims`** — OSGi-`Require-Capability`-style **namespaced** claims for the DOM dimension that version-sharing tools (MF, Native Federation, single-spa) do **not** model: `globals` (`window.*`), `tagNames` (`customElements.define` collisions), `routes`. A second claimant on the same key is a *namespace collision*, detected separately from version mismatch. **This is the novel contribution** — no surveyed tool declares it.

  The Platform **computes** the BCD-style matrix as the *rendered map view* — because BCD is itself curated/computed, never declared by implementers ([BCD repo](https://github.com/mdn/browser-compat-data)). The matrix carries **three states** (`supported` / `supported-but-flagged-degraded` / `unsupported`), borrowing BCD's `partial_implementation` and **Kubernetes version-skew**'s asymmetry — *shell newer than declared* = forward-compat zone (allow/flag); *shell older than required* = hard fail (the essay's "older shell, flagged on the dashboard", `we:reports/2026-06-06-front-end-platform-book.md:1426`). Cost: two representations (declared vs. computed), but they serve different readers.
- **(B) Declare the full matrix.** Apps author the full BCD-style support matrix directly. *Rejected* — overweight to author and hand-maintain; BCD's matrix is a *generated/curated* artifact, not something each app declares. The declared layer should be minimal; nuance is computed.
- **Sub-decision (ratify with this fork):** the **`claims` namespace set** (is `globals`/`tagNames`/`routes` complete, or also CSS-namespace / storage-keys?) and whether the **gate strictness is a warn-vs-block policy knob** (npm `engine-strict` / MF `strictVersion` are both advisory-by-default — the platform default should likely be warn, block as opt-in).
- **Sub-decision (defer):** exact `status`/Baseline surfacing on the map (which apps are pinned to deprecated providers) — borrow BCD `status` but settle field names when authoring.

## Fork 3 — memory / eviction model for the long-lived SPA

**Crux.** The essay states the problem and leaves it open: *"you cannot load stuff infinitely, even if conflicts are managed"* (`we:reports/2026-06-06-front-end-platform-book.md:406`). The platform already specifies a graceful-degradation eviction model — the **Storage API eviction model** ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)): two persistence classes (best-effort, evictable; persistent, opt-in, skipped) with **LRU** eviction under a quota.

- **(A — recommended) Mirror the Storage model as a policy dimension.** A mounted micro-app has a **persistence class** (pin the current route / keep-alive opt-in; background pages evictable by default), an **LRU policy** under a **mounted-app budget**, and **unmount = single-spa's `unmount` lifecycle** (tear down, release global/tag claims, keep the bundle cached for fast re-mount). LRU is the default; pinning is the author opt-in (most-flexible default; the restriction is opt-in). Degrades gracefully, exactly like storage.
- **(B) Bespoke policy or no eviction.** Invent a custom heuristic, or punt (the essay's non-answer). *Rejected* — reinvents a solved web-platform model and forgoes the borrowed vocabulary; "no eviction" reintroduces the unbounded-memory failure the fork exists to solve.
- **Sub-decision (ratify):** the budget unit (count of mounted apps vs. a heap estimate) and whether the pinned/keep-alive class is per-route or author-declared on the chart (Fork 2).

## Open questions carried into authoring

- Fork 1: confirm the protocol name (`app-shell-compatibility`?) and that **webmanifests** is its home (vs. a new project).
- Fork 2: confirm the **`claims` namespace set** (globals/tagNames/routes — complete?), the warn-vs-block strictness default, and the BCD `status`/Baseline surfacing.
- Fork 3: ratify the budget unit and the pin/keep-alive declaration site.

## Resolution (partial) — 2026-06-11

- **Fork 3 — mirror the Storage eviction model as a policy dimension**: ratified. A mounted micro-app carries a persistence class (background pages best-effort/evictable by default; current route / keep-alive opt-in pinned), LRU eviction under a mounted-app budget, and unmount via single-spa's `unmount` lifecycle (tear down, release global/tag claims, keep the bundle cached). LRU is the default and pinning is the author opt-in (most-flexible-default — the restriction is opt-in), borrowing the platform's own Storage persistence model rather than inventing a heuristic. (The budget unit and pin declaration site remain a follow-on settle within this ratified model.)

## Resolution (final) — 2026-06-13

All three forks ratified at their recommended defaults (the human call on the two open pins came in on 2026-06-13, after the deep prior-art pass).

- **Fork 1 — home (ratified):** split. A thin **`app-shell-compatibility` protocol** owned by **webmanifests** (sibling to `changelog-manifest`, [we:protocols.json:86](../src/_data/protocols.json#L86)) is the declared standards artifact; the **live compatibility map is a Plateau dashboard** rendered as a view over the #092 provider↔consumer graph. One manifest, two consumers (runtime resolver + map) — the MF2 `we:mf-manifest.json` seam lesson. Successor build → **#501** (protocol + schema, agent-ready) and **#502** (Plateau map, blocked by #501 + #092).
- **Fork 2 — schema altitude (ratified):** **declare flat, render rich-computed.** The declared per-app manifest = an npm-`peerDependencies`/MF-`shared`-shaped **`providers`** block (semver ranges, each `singleton`-vs-isolatable + mandatory-vs-optional) **plus OSGi-`Require-Capability`-style namespaced `claims`** for the DOM dimension (`globals` / `tagNames` / `routes`) — the novel contribution no version-sharing tool declares. The Platform **computes** the BCD-style support matrix as the map view (BCD is curated/computed, never declared), carrying **three states** (`supported` / `flagged-degraded` / `unsupported`) and an **asymmetric** skew window (shell-newer = forward-compat; shell-older = fail), per Kubernetes version-skew. Gate strictness is a **warn-by-default policy knob** (block opt-in), per npm `engine-strict` / MF `strictVersion`. Singleton providers force a range *intersection* across all active apps (OSGi `uses`); isolatable ones use import-map scopes for per-app versions.
- **Fork 3 — eviction (ratified 2026-06-11):** mirror the Storage model — best-effort/persistent persistence classes + LRU under a mounted-app budget, unmount via single-spa's `unmount` lifecycle (release global/tag claims, keep the bundle cached). LRU default; pin/keep-alive is the author opt-in.

**Deferred (settle when authoring #501):** the exact `claims` namespace completeness (whether CSS-namespace / storage-keys join globals/tag-names/routes), the BCD `status`/Baseline surfacing + field names, and Fork 3's budget unit (mounted-app count vs heap estimate) + pin declaration site.

## Deep prior-art pass — 2026-06-13

Completed a thorough second-round survey (Module Federation 1→2, the `we:mf-manifest.json` schema + runtime version-resolution algorithm + DevTools graph; Native Federation; Piral; qiankun; Luigi; Bit; @originjs/vite-plugin-federation; npm `peerDependencies`/`engines`; OSGi `uses`/Require-Capability; Kubernetes version-skew; import-map scopes; BCD curation model; Zephyr Cloud). Folded into [the report](../reports/2026-06-11-app-shell-compatibility-map.md) (rev. 2026-06-13, Findings 1, 2, 3a–3d, 6, 7). Net effect on the open pins: **Fork 1 reinforced** (the "one manifest, two consumers" MF2 seam lesson + Zephyr as proof of the product leg), **Fork 2 sharpened and raised to High confidence on direction**, with the real call narrowed to the DOM-`claims` namespace set. No change to the recommended *shape* of either pin — the research strengthened the existing recommendations rather than overturning them.

## Progress

- **Status:** active — decision discussion. Fork 3 ratified; Forks 1 & 2 awaiting the human call.
- **Branch:** docs/standard-authoring-workflow
- **Done:** Deep prior-art pass (2026-06-13) complete; report rev. 2026-06-13, this card, and the `/research/` topic all updated with the MF/competitor/classic-resolver findings and the corrected novelty framing.
- **Next:** User ratifies (or overrides) Pin 1 (protocol name + webmanifests home) and Pin 2 (declare-flat altitude + the `claims` namespace set + warn-vs-block default). On ratification → close out (`active → resolved`), record the ruling, and spin the agent-ready successor build (protocol entry in `we:protocols.json` + schema authoring).
- **Notes:** No build artifact produced this turn — research + card only. The successor build becomes Tier-A once both pins are pinned.
