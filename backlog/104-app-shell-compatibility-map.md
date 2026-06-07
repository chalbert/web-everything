---
type: idea
status: open
dateOpened: "2026-06-06"
tags: [app-shell, micro-frontend, micro-apps, meta-framework, compatibility-map, spa, routing, evergreen, dashboard, platform]
relatedReport: reports/2026-06-06-front-end-platform-book.md
crossRef: { url: /backlog/099-evergreen-app-vision/, label: "Evergreen app (#099)" }
---

# App shell + micro-app compatibility map — a thin meta-framework that loads independent apps as one SPA, with a compatibility chart

A **minimal-dependency app shell** (meta-framework / "App Shell") that manages loading + routing of pages, where each page is an independently-developed **micro-app**. On navigation, the shell decides whether the next page can load **inside the same SPA** (compatible) or needs a **hard refresh** (incompatible), and avoids re-loading code already present. The Platform then exposes a **compatibility map** showing which pages can coexist — surfacing the apps that would benefit from conversion. From the essay's *Micro Apps / Ideal micro-apps setup* sections.

## Why it matters for the evergreen vision

This is how an evergreen app ([#099](/backlog/099-evergreen-app-vision/)) tolerates apps updating at different speeds: an app that *didn't* update still runs — in the worst case on an **older app shell** — and is **flagged on the dashboard**, with the specific incompatibilities highlighted so an intervention can be planned. Compatibility degrades gracefully instead of breaking. Over time, shared design patterns + the Platform API/Web-Component layer (the "frameworkless future") shrink the incompatible set.

## The ideal setup (essay's checklist)

- Abstract container with little/no dependency; owns loading + routing only.
- Each micro-app declares a **compatibility chart**; the shell (or the MaaS for the new page) decides same-SPA vs. hard-refresh and dedupes already-loaded bundles.
- Standardized features in **framework-agnostic pure JS**, served as Platform-level MaaS — the more in this layer, the longer apps stay compatible.
- **Adapters** convert older setups to new APIs *without loading the old implementation* → APIs are **dependency-injected** (the constellation already does this via webinjectors).
- MaaS with **version ranges**, auto-updatable apps, Web Components for the base UI layer.

## Relationship to existing work

- **#092 (relationship graph)** supplies the cross-app introspection the compatibility map renders on; the compatibility map is arguably a *view* of that graph (which app on which shell/API version, where it's incompatible).
- **Adapters / webinjectors** are exactly the "convert old → new via DI, don't load the old impl" mechanism the essay asks for.
- Honors the constellation's "loose collection of SPAs ≠ microfrontend" caution — this is the genuine single-SPA-multiple-teams shape.

## Open questions

- Is this a **project/protocol** in the standard (an "app shell + compatibility" contract micro-apps declare against) or a **Plateau product**? Likely both: a thin protocol for declaring compatibility, the live map as a Plateau dashboard (#092).
- Define the **compatibility chart** schema (what a micro-app declares: required shell version, required Platform API ranges, conflicting globals). This is the core design work.
- Memory management for a long-lived single SPA (can't load forever even if conflicts are managed) — an eviction story the essay flags but leaves open.
