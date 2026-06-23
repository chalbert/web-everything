# webrouting Route-Table Derivations — Which Emitters, and How Each Handles Dynamic Routes

**Point:** The four candidate emitters (crawler `sitemap.xml`, in-app IA nav-tree, prerender/static-render manifest, Speculation-Rules prefetch manifest) all derive from the one canonical route-map projection #1685 ratified, all coexist behind a swap seam, and none is flawed — so "which ships in v1" is **burndown ordering, not a merit fork**. The single genuine merit fork is the **dynamic-route enumeration policy**: parametric route templates (`/users/:id`) cannot become concrete URLs without an external value source, and prior art splits on how to handle that gap (enumerate-via-generator vs emit-templates vs document-rules). A second, smaller seam call is whether the IA-tree emitter composes with the Navigation Intent `structure` axis.

---

## The derivation source (settled upstream by #1685)

#1685 ratified **(c) both, one derived**: declarative-DOM `<template route>` stays the authoring source-of-truth, and webrouting derives a serializable **route-map projection** of `RouteDefinition` — `path`, `guard`, `guardLeave`, `loader`, `outlet`, `isErrorBoundary` — dropping the non-serializable `pattern: URLPattern` (`we:blocks/router/types.ts:133`) and `template: HTMLTemplateElement` (`we:blocks/router/types.ts:137`). The projection is built DOM→map by running the existing `parseRouteDefinitions()` (`we:blocks/router/types.ts:194`, `querySelectorAll('template[route]')` at `:198`) — possibly under a headless DOM. #1685's ratified **Bounds** already nail the hard constraint this item inherits: *the map enumerates route templates, not concrete URLs — parametric-URL enumeration (`/users/:id`) needs a value source, which is #1688's scope.* So #1688 owns exactly the question #1685 punted: per-emitter, what does the deriver do with a parametric template?

Every emitter reads `routes[].path` from that one stable projection. None re-parses the DOM independently. That is the shared-kernel that makes the emitter set composable rather than rival.

## The four emitters — prior art and dynamic-route handling

| Emitter | What it produces | Prior art | How it handles a parametric route (`/users/:id`) |
| --- | --- | --- | --- |
| Crawler `sitemap.xml` | sitemaps.org/0.9 `<urlset>` of concrete URLs for SEO | Next.js `sitemap.(js|ts)` special file; `next-sitemap`; `svelte-sitemap`; `@quasibit/eleventy-plugin-sitemap` | **Must enumerate to concrete URLs.** Next requires `generateStaticParams` / a build-time data fetch mapping params→URLs; `svelte-sitemap` scans only prerendered (already-concrete) routes. Parametric templates with no value source are **excluded by construction** — a sitemap cannot contain `/users/:id`. |
| In-app IA nav-tree / map | structured route tree for breadcrumbs, menus, nav blocks | `@11ty/eleventy-navigation` (hierarchical tree + `eleventyNavigationBreadcrumb`); React-Router route objects; Angular route config | **Keeps the template form.** A nav tree is structural — `/users/:id` is a node *as a pattern*; it never needs concrete IDs. No value source required; dynamic routes are first-class nodes. |
| Prerender / static-render manifest | the list of routes to statically render at build | Next prerender-manifest; SvelteKit `prerender.entries` + `entries()` generators; `adapter-static` | **Enumerate or skip.** SvelteKit prerenders non-dynamic routes by default and discovers dynamic ones two ways: **crawl** (follow links found on prerendered pages) or an explicit **`entries()` generator** the route author exports. Un-reached parametric routes are skipped unless an `entries()` source is supplied. |
| Speculation-Rules prefetch manifest | `<script type="speculationrules">` JSON (prefetch/prerender) | MDN Speculation Rules API; corewebvitals.io generator; Chrome prerender docs | **Two native modes, one needs NO enumeration.** *URL-List rules* (`"urls": [...]`) need concrete URLs (same value-source problem). *Document rules* (`"where": { "href_matches": "/users/*" }`) match links **already in the DOM at runtime** by URL pattern — so a parametric template lowers directly to a document-rule predicate with **no value source at all**. This is the one emitter that natively dissolves the dynamic-route gap. |

## The crux this surfaces — dynamic-route enumeration is a correctness fork, not scheduling

The table shows the parametric-route gap is real and the emitters **do not agree** on how to close it:

- **Concrete-URL emitters** (sitemap URL-list, prerender-by-enumeration, Speculation URL-list) cannot enumerate `/users/:id` without an external value source. Prior art's universal answer is an **author-supplied params/entries generator** (Next `generateStaticParams`, SvelteKit `entries()`), never magic.
- **Pattern-preserving emitters** (IA nav-tree, Speculation document-rules, crawl-discovery prerender) need **no** value source — they consume the template form directly.

So the deriver needs a policy for parametric templates. Three coherent policies:
1. **Exclude** parametric routes from concrete-URL emitters silently (the safe sitemap default — never emit a 404-prone or fabricated URL).
2. **Enumerate via an optional author-supplied param-source** hook (`generateStaticParams`-shaped), per route, when the author wants those URLs.
3. **Lower to a pattern predicate** where the artifact supports it (Speculation document-rules, IA-tree) — no enumeration needed.

These are not "do it now vs later" — they are *different correct outputs* for the same input, and picking wrong means a sitemap full of literal `:id` strings (broken SEO) or a silently-empty prerender list. That is the genuine merit fork (Fork 1 below).

## The IA-tree composition seam

`@11ty/eleventy-navigation` and React-Router both model navigation as a **hierarchical tree** distinct from a flat URL list. The router block already declares an `implementsIntent: navigation` with a `structure` dimension (`hierarchical` today, `we:src/_data/blocks/router.json:146`). The IA-tree emitter and the Navigation Intent's `structure` axis describe the same hierarchy from two ends. The seam call (Fork 2): does the IA-tree emitter **produce** the structure the Navigation Intent's `structure` axis declares (one home, composed), or is the nav-tree a standalone derivation that ignores the intent? Bias-toward-separation + the existing intent axis favor composing — but it's a real seam to pin.

## No overlap with the docs-site sitemap

`we:src/sitemap.njk` is the **11ty documentation site's** SEO sitemap — it iterates `collections.all` (every rendered docs page) per #774/#770's rendered-site a11y gate, emitting `sitemaps.org/0.9`. It has **nothing** to do with app routing or the route table; it is the docs build's own artifact. The #1688 sitemap emitter derives an *app's* route table into a sitemap — a different producer, different input, different consumer. No collision.

## Conclusion for the prep

The standing test collapses the item's "which emitters ship in v1" framing: all four emitters are coherent, derive from the one #1685 projection, and coexist behind a pluggable emitter-set seam — so they are **support-all (ratify the pluggable set)**, and v1-vs-later is separately-prioritized burndown ordering, **not a fork**. What survives as genuine merit calls: **Fork 1** — the dynamic-route enumeration policy (a correctness call) — and **Fork 2** — whether the IA-tree emitter composes with the Navigation Intent `structure` axis (a seam call).
