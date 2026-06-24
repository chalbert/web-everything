---
kind: decision
parent: "1684"
status: resolved
dateOpened: "2026-06-23"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1684
codifiedIn: "docs/agent/platform-decisions.md#faithful-derivation-exclude-not-fabricate"
preparedDate: "2026-06-23"
locus: webeverything
tags: [webrouting, routing, sitemap, prerender, derivation]
relatedReport: reports/2026-06-23-webrouting-route-table-derivations.md
---

# webrouting route-table derivations — emitter set + dynamic-route policy

No design exists yet. The fork-existence test collapses this item's original "which artifact set ships in v1" framing: the four emitters — crawler `sitemap.xml`, IA nav-tree, prerender manifest, Speculation-Rules manifest — all derive from the one route-map projection [#1685](/backlog/1685-webrouting-route-format-source-of-truth-declarative-dom-temp/) ratified and coexist behind a swap seam, so **none is excluded**. They are **supported by default** (a pluggable emitter set); ship-order is burndown, **not a fork**. What survives — grounded in [/research/webrouting-route-table-derivations](/research/webrouting-route-table-derivations/), each with a **bold** default: **Fork 1** the per-emitter dynamic-route enumeration policy (correctness), and **Fork 2** whether the IA-tree emitter composes with the Navigation Intent `structure` axis.

## Ratified (2026-06-24)

Both forks resolve to their bold defaults; support-all stands. The fork-existence reread held on the claim turn and the red-team failed to land on either default.

- **Emitter set — support-all (ratify).** A default-less, pluggable emitter registry; all four emitters (crawler `sitemap.xml`, IA nav-tree, prerender manifest, Speculation-Rules manifest) are facades over the one #1685 route-map projection (`routes[].path`). Build-order is burndown under #1684, not a fork.
- **Fork 1 — (a)** exclude parametric routes from concrete-URL emitters by default + optional author-supplied param-source hook (`generateStaticParams`-shaped) + consume the pattern directly where the artifact supports it; **plus** a build-time skip notice (ergonomic, not a branch). Never fabricate URLs (branch (c) rejected); never force a source on pattern-preserving emitters (branch (b) rejected).
- **Fork 2 — (a)** the IA-tree emitter realizes the Navigation Intent `structure` axis (one composed home); **plus** a path-nesting fallback when no intent is declared (the degraded case of (a), not the rejected independent-derivation branch (b)).

**Graduates to #1684** via `/slice 1684`: the emitter registry + four emitters as separately-prioritized build items, plus the Fork-1 param-source hook.

## Axis framing

The concern decomposes into one ratify + two genuine merit forks, pinned to the real tree:

- **The emitter set itself** (ratify, support-all — not a fork). All four emitters read `routes[].path` from the one serializable route-map projection #1685 ratified — a derivation of `RouteDefinition` (`we:blocks/router/types.ts:131`) dropping the non-serializable `pattern: URLPattern` (`we:blocks/router/types.ts:133`) and `template: HTMLTemplateElement` (`we:blocks/router/types.ts:137`), built DOM→map by `parseRouteDefinitions()` (`we:blocks/router/types.ts:194`). They share that one kernel and cannot conflict; the composability probe (build each as a facade over the projection) **succeeds** for all four → support-all behind a pluggable emitter registry. No excluded branch ⇒ **not a fork.**
- **Dynamic-route enumeration policy** (the genuine merit fork). #1685's ratified Bounds explicitly punted this: the map "enumerates route templates, not concrete URLs — parametric-URL enumeration (`/users/:id`) needs a value source, which is #1688's scope." A parametric template cannot become concrete URLs without an external source, and the emitters disagree on how to close the gap — a *correctness* call, not scheduling. → **Fork 1.**
- **IA-tree ↔ Navigation Intent composition** (a seam call). The router declares `implementsIntent: navigation` with a `structure` dimension (`hierarchical` today, `we:src/_data/blocks/router.json:146`). The IA-tree emitter and that `structure` axis describe the same hierarchy from two ends — a real combine-vs-separate seam. → **Fork 2.**

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| Fork 1 — dynamic-route enumeration policy | **(a) exclude parametric routes from concrete-URL emitters by default + an optional author-supplied param-source hook; lower to a pattern predicate where the artifact supports it** | (b) require a param-source for every emitter (no exclusion); (c) fabricate placeholder URLs | Med-high (~75%) |
| Fork 2 — IA-tree ↔ Navigation Intent `structure` | **(a) the IA-tree emitter produces the hierarchy the Navigation Intent `structure` axis declares (one composed home)** | (b) standalone nav-tree derivation that ignores the intent | Med-high (~70%) |

## Supported by default (not decisions)

These are **ratify**, not forks — the fork-existence test finds no excluded branch:

- **The pluggable emitter set.** All four emitters (sitemap.xml, IA nav-tree, prerender manifest, Speculation-Rules manifest) are coherent derivations of the one #1685 route-map projection and coexist. Per config-extends-platform-default / most-flexible-default, webrouting ships a **default-less emitter registry** (an open set the project config extends), not a fixed emitter. New emitters (RSS, an API-route manifest) join the registry without a decision. The composability probe passes — each is a facade over `routes[].path`.
- **Speculation-Rules is native-first.** The Speculation Rules API is the committed substrate for the prefetch emitter — the router block already references it (`we:src/_data/blocks/router.json:192-197`); webrouting emits `<script type="speculationrules">`, inventing no prefetch format.
- **v1 build ordering is separately-prioritized burndown, NOT a fork.** Which emitter is built first is a backlog-ordering knob, not a design branch — both "sitemap first" and "IA-tree first" agree on the end-state (all four exist). The end-state is ratified here; the build order is filed as separately-prioritized build items under [#1684](/backlog/1684-scaffold-the-webrouting-standard-route-format-profile-url-as/) via `/slice 1684`, each carrying its own `priority`/`size`. No "defer because expensive" is framed as a design choice.

## Fork 1 — per-emitter dynamic-route enumeration policy

**Fork-existence:** a genuine merit either/or with a positively-flawed branch. A parametric template `/users/:id` cannot be lowered to concrete URLs (`/users/1`, `/users/2`) without an external value source — this is forced by construction, not a preference. The policies produce **different correct outputs for the same input**, and one branch (fabricating placeholder URLs) is *broken* — it emits 404-prone or literal-`:id` URLs that poison a sitemap's SEO. So the branches cannot coexist (a single deriver needs one default behaviour for a parametric template) and one is flawed → a real fork.

**Crux (real-tree + prior-art refs):** the route-map projection enumerates route *templates*, not URLs (#1685 Bounds; `parseRouteDefinitions` reads `template[route]` patterns at `we:blocks/router/types.ts:198`). Prior art splits sharply on closing the parametric gap: Next.js requires an author-supplied `generateStaticParams` / build-time data fetch to emit dynamic URLs; SvelteKit discovers dynamic routes via link-crawl or an explicit `entries()` generator the route author exports, and *skips* un-reached parametric routes; the Speculation Rules API offers *document rules* (`"where": { "href_matches": "/users/*" }`) that match links already in the DOM by pattern — needing **no** enumeration at all. So some emitters need a value source and some natively consume the pattern form.

**Options:**

- **(a) Exclude-by-default + optional author-supplied param-source hook + pattern-predicate where supported.** Concrete-URL emitters (sitemap URL-list, prerender-by-enumeration, Speculation URL-list) **exclude** parametric routes unless the author supplies a per-route param-source (`generateStaticParams`-shaped); pattern-preserving emitters (IA nav-tree, Speculation document-rules, crawl-discovery prerender) consume the template directly with no source. Matches every incumbent: never fabricate, enumerate only from a real source, keep patterns where the artifact supports them. Most-flexible-default — the restriction (must supply a source to get dynamic URLs) is the author's opt-in, not a mandate.
- **(b) Require a param-source for every emitter (no silent exclusion).** Every parametric route must declare a value source or the build errors. *Rejected on merit:* over-restrictive — it breaks pattern-preserving emitters (an IA nav-tree or Speculation document-rule never needs concrete IDs), forcing useless ceremony and violating most-flexible-default. A nav tree with `/users/:id` as a node is correct as-is.
- **(c) Fabricate placeholder URLs for parametric routes.** Emit `/users/:id` literally, or a synthetic `/users/0`. *Rejected — the flawed branch:* a literal `:id` URL is invalid in `sitemaps.org/0.9` and a fabricated `/users/0` is a 404-prone fiction that actively harms SEO and prerender correctness. No incumbent does this; it is the broken branch that makes this a real fork.

**Recommended default: (a) exclude-by-default + optional author param-source + pattern-predicate where supported.** It is the union of what every incumbent does, never fabricates a URL, and stays most-flexible (the param-source is opt-in). Concrete-URL emitters degrade gracefully (emit the static routes, skip the unparameterized dynamic ones); pattern-aware emitters lose nothing.

**Ratification clarification (skip is not silent):** "exclude-by-default" must not read as *silently* dropping URLs an SEO author wanted. The build slice carries a **build-time notice when a concrete-URL emitter skips a parametric route that has no param-source** — surfacing exactly the routes the author could enumerate by supplying a source. This is an ergonomic affordance on default (a), **not** a third branch (it changes no emitted artifact, only the build log), so it does not reopen the fork.

**Skeptic:** SURVIVES — an adversarial pass (2026-06-23) attacked (a) as smuggling scheduling ("exclude now, enumerate later"). It is not scheduling: exclusion vs enumeration vs fabrication produce *different artifacts at the same moment* (a sitemap with vs without the dynamic URLs vs with broken URLs) — a correctness difference independent of when built. The attack on the default itself — "exclude-by-default silently drops URLs an SEO author wants" — is answered by the opt-in param-source hook (the author enumerates when they have the data), and the alternative (error-by-default, (b)) wrongly punishes pattern-preserving emitters. Fabrication (c) stays the named broken branch.

## Fork 2 — does the IA-tree emitter compose with the Navigation Intent `structure` axis?

**Fork-existence:** a genuine combine-vs-separate seam, not support-all. The IA nav-tree hierarchy and the Navigation Intent's `structure` dimension (`we:src/_data/blocks/router.json:146`, value `hierarchical`) describe the *same* route hierarchy — they cannot independently coexist as two unrelated sources of truth for "the app's nav structure" without drift (two homes for one hierarchy = the exact drift the single-SoT rule forbids). So a choice is forced: one produces the other, or they are decoupled. The branches genuinely cannot both be canonical.

**Crux:** the Navigation Intent owns the user-perceivable `structure` axis (UX-only); the IA-tree emitter derives a concrete tree from the route-map projection. If the emitter ignores the intent, an app declaring `structure: hierarchical` and an emitted nav-tree could disagree.

**Options:**

- **(a) The IA-tree emitter produces the hierarchy the Navigation Intent `structure` axis declares.** The emitter is the concrete realization of the intent's `structure` dimension over the route table — one composed home, the intent stays the UX declaration and the emitter the derived artifact. Bias-toward-separation is satisfied by composition (intent = axis, emitter = derivation), and single-SoT holds.
- **(b) Standalone nav-tree derivation that ignores the intent.** The emitter builds a tree purely from path nesting, unaware of `structure`. *Rejected on merit:* creates two unreconciled homes for the nav hierarchy → drift between the declared UX axis and the emitted tree; violates single-SoT and the compose-don't-duplicate bias.

**Recommended default: (a) compose with the Navigation Intent `structure` axis.** The emitter realizes the intent's declared structure over the route table — no second source of truth.

**Ratification clarification (intentless fallback):** when an app declares **no** navigation intent, the emitter has no `structure` axis to realize and falls back to pure path-nesting. This is **(a)'s degraded case, not branch (b)** — (b) is "ignore a *declared* intent and derive independently," which is the drift this fork rejects; deriving from path-nesting *in the absence of any declaration* is the only coherent default and introduces no second home for a declared hierarchy.

**Skeptic:** SURVIVES — attacked as a false fork ("just support both — emit a tree, let the intent be advisory"). It fails: "advisory" is exactly the two-unreconciled-homes drift the single-SoT rule forbids; a declared `structure: hierarchical` that the emitted tree can silently contradict is the flaw. Composition (a) is the only branch with one source of truth, so the fork is real and (a) is forced.

---

## Context

- **Derivation source (settled upstream):** [#1685](/backlog/1685-webrouting-route-format-source-of-truth-declarative-dom-temp/) ratified the serializable route-map projection (DOM→map) every emitter reads — `routes[].path` from `RouteDefinition` minus the non-serializable `pattern` + `template`. #1685's Bounds explicitly assigned parametric-URL enumeration to *this* item; Fork 1 is that assignment.
- **No overlap with the docs-site sitemap:** `we:src/sitemap.njk` is the **11ty documentation site's** own SEO sitemap — it iterates `collections.all` (every rendered docs page) per #774/#770's rendered-site a11y gate, emitting `sitemaps.org/0.9`. It is the docs build's artifact, with a different producer / input / consumer; it has nothing to do with app routing or the route table. The #1688 emitter derives an *app's* route table into a sitemap. No collision.
- **Native-first substrates:** Speculation Rules API (`we:src/_data/blocks/router.json:192-197`) for the prefetch emitter; `sitemaps.org/0.9` for the crawler sitemap (consumed, not re-specified, matching `we:src/sitemap.njk`'s own stance). The IA nav-tree mirrors `@11ty/eleventy-navigation`'s hierarchical-tree + breadcrumb model.
- **Graduation:** on ratification, carve the emitter build slices under [#1684](/backlog/1684-scaffold-the-webrouting-standard-route-format-profile-url-as/) via `/slice 1684` — the emitter registry + the four emitters as separately-prioritized build items (each its own `priority`/`size`, ordered by burndown), plus the dynamic-route param-source hook the Fork-1 default introduces. A Technical Configurator card is *not* spun out: these are deriver outputs, not project-facing technical strategy knobs (the technical-config home is [#1687](/backlog/1687-webrouting-technical-config-home-schema-in-webrouting-vs-a-p/)'s scope).
- **Research:** [/research/webrouting-route-table-derivations](/research/webrouting-route-table-derivations/) — the emitter→prior-art→dynamic-route-handling table (Next, SvelteKit, Speculation Rules, `@11ty/eleventy-navigation`).
