# Access control — authorization gate — prior-art survey

**Date**: 2026-06-11
**Point**: Web-platform and library prior art for the *entry* member of the Guard protocol (#272/#288) — declarative app-level authorization. The home fork (intent vs block vs project) is already resolved (a member of the Guard protocol); this survey grounds the **member design**: the two surfaces (routing entry guard + rendering access gate), the deny-outcome family (403-vs-404 existence hiding), and feature-flags-as-authority.
**Backlog item**: `/backlog/178-access-control-authorization-gate/`
---

## Question

`access-control` is the settled *entry* mirror of the *exit* guard (#129→#273): built **on** the Guard protocol's predicate-provider seam, not as its own project ([protocols.json:94](../src/_data/protocols.json#L94), [backlog/178:38](../backlog/178-access-control-authorization-gate.md#L38)). What remains open is *how to author the member*. Before authoring, survey prior art per [design-first.md](../docs/agent/design-first.md) step 1 so the surfaces, deny-outcomes, and authority vocabulary reuse platform/ecosystem terms instead of coining new ones — and so the trust boundary is stated identically to the #012 identity finding (front-end is a UX mirror; the back-end is authoritative).

## Key findings

### 1. Authorization is universally factored into TWO surfaces — a route guard and an element-level gate

Every surveyed stack keeps **navigation-entry** authorization separate from **render-time** authorization, with one shared ability/policy source feeding both:

- **Route guard (entry):** Angular `CanActivate` returns `true | false | UrlTree` — a `UrlTree`/`RedirectCommand` cancels the navigation and starts a redirect ([angular.dev route-guards](https://angular.dev/guide/routing/route-guards)). React Router resolves authorization in a route **loader** that `throw redirect('/login')` before the route renders ([react-router #9327](https://github.com/remix-run/react-router/discussions/9327)); v7 hoists it into route **middleware** that runs before loaders. Vue Router uses **navigation guards** (`router.beforeEach`, per-route `beforeEnter`) reading declarative `meta: { requiresAuth }` and returning a redirect location ([Vue Router navigation-guards](https://router.vuejs.org/guide/advanced/navigation-guards.html), [meta fields](https://router.vuejs.org/guide/advanced/meta.html)).
- **Element gate (render):** CASL's `<Can I="update" a="Post">…</Can>` component (React) / `$can` + `<Can>` (Vue) conditionally renders a subtree from the same `Ability` instance used server-side ([casl.js.org](https://casl.js.org/v6/en/package/casl-vue/), [stalniy/casl](https://github.com/stalniy/casl)).

**Implication:** the member is genuinely **two surfaces off one authz provider** — a routing entry guard (deny → navigation outcome) and a rendering access gate (deny → render-or-hide a subtree). They are not the same control; they share only the predicate. This is exactly the two-surface split #178 already sketched.

### 2. The route guard's deny-branch is a small, named outcome family — and 403-vs-404 is a security call, not a styling one

Across frameworks the entry-deny outcomes collapse to: **redirect** (to login / fallback — Angular `UrlTree`, RR `redirect`, Vue redirect location), **block/cancel** (Angular `false` cancels navigation in place), or **render a forbidden/not-found view**. The load-bearing one is the **forbidden-vs-not-found** choice:

- RFC 9110 explicitly sanctions existence hiding: *"An origin server that wishes to 'hide' the current existence of a forbidden target resource MAY instead respond with a status code of 404."* Returning **403 confirms the resource exists**, which is information leakage an attacker can use to enumerate protected resources ([lockmedown](https://lockmedown.com/when-should-you-return-404-instead-of-403-http-status-code/), [authress](https://authress.io/knowledge-base/articles/choosing-the-right-http-error-code-401-403-404)).
- So the UX-only intent should name the *intent* outcomes (`hide | redirect | forbid | cloak`), but **which one fires — especially forbid (403) vs cloak (404) — is a security decision that belongs behind the guard provider**, not a UX-author dimension. This is exactly what the Guard protocol summary already states: *"the 403-vs-404 disclosure call lives behind the provider"* ([protocols.json:96](../src/_data/protocols.json#L96)).

### 3. The trust boundary is identical to the identity finding — the front-end gate is a UX mirror, never enforcement

Every source repeats the warning, unprompted: Angular — *"Never rely on client-side guards as the sole source of access control… Always enforce user authorization server-side"* ([angular.dev](https://angular.dev/guide/routing/route-guards)). CASL is *isomorphic* precisely so the **same** ability object runs on the server (the enforcement point) and the client (the mirror) ([stalniy/casl](https://github.com/stalniy/casl)). This is the same boundary the Guard protocol already fixes (*"async, server-authoritative… the front-end is a UX mirror, never enforcement, and revocable"* — [protocols.json:96](../src/_data/protocols.json#L96)) and the same one the #012 identity survey landed on ([backlog/012:25](../backlog/012-gap-5-webidentity-project.md#L25)). The member must restate it, not re-decide it.

### 4. Policy engines (OPA) are the back-end provider impl, not a front-end concern — they validate the provider seam

OPA externalizes authorization: the app is a **Policy Enforcement Point (PEP)** that queries a **Policy Decision Point (PDP)** with JSON input and gets an allow/deny decision back; Rego policies change without touching application code ([openpolicyagent.org](https://www.openpolicyagent.org/docs), [AWS PDP-by-OPA](https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-api-access-authorization/opa.html)). This is structurally **the Guard provider seam**: the guarded surface (PEP) stays untouched while the policy source (PDP) is swapped. OPA/CASL/a feature-flag SDK are all just different `CustomGuardProvider` implementations behind the same async predicate — which is why the member should not bake a policy model, only consume the provider's verdict.

### 5. Feature-flags-as-authority — the same abstraction, materially different stakes (so: an authority *kind*, not the same machinery)

A widely-cited argument holds that feature flags and authorization **abstract the same concept**: a gate evaluated against subject + context returning a boolean ([ntietz.com](https://ntietz.com/blog/feature-flags-and-authorization/), [lobste.rs](https://lobste.rs/s/tjtxpt/feature_flags_authorization_are_same)). LaunchDarkly even ships **entitlements** as long-lived flag targeting ([LaunchDarkly entitlements](https://launchdarkly.com/docs/guides/flags/entitlements)). But the same sources draw a sharp line:

- **Failure stakes differ:** *"If a feature flag shows someone the wrong promotion… it isn't usually an existential risk. On the other hand, if you show users other people's data, that can cause serious headaches with regulators"* ([ntietz.com](https://ntietz.com/blog/feature-flags-and-authorization/)).
- **Permanence differs:** flags are temporary (vanish at launch); authorization is permanent (lasts as long as the data).
- **Client-side flags are not a control:** *"A client-side feature flag alone is not a sufficient control for locking users out of functionality… assuming it's coupled to a backend feature flag"* ([LaunchDarkly hardening](https://launchdarkly.com/blog/keeping-client-side-feature-flags-secure/)).

**Implication:** feature-flags-as-authority is real and should be a first-class **authority kind** the gate can resolve — but it resolves *through the same provider seam* (a flag SDK is one `CustomGuardProvider`), and it inherits the identical UX-mirror trust boundary. It is **not** a separate machinery and **not** a license to enforce on the client.

### 6. No native authorization primitive — but the Navigation API is the native route-guard substrate

There is no browser authorization API (the Permissions API is a *different* concern — camera/geolocation, owned by #009, explicitly not this — [backlog/178:14](../backlog/178-access-control-authorization-gate.md#L14)). But the **Navigation API**'s `navigate` event (`intercept()` / `event.preventDefault()` + redirect) is the native substrate for the route-guard surface — the same primitive the Navigation Intent already names as its SPA-grade enhancement over the History API ([intents.json:1696](../src/_data/intents.json#L1696)) and that the exit guard's `route` scope already intercepts ([intents.json:2037](../src/_data/intents.json#L2037)). So the entry guard composes the existing navigation machinery; it does not invent it.

## Recommendation (to ratify in #178)

The home fork stays ruled (entry member of the Guard protocol #272/#288, not its own project). The member-design forks:

1. **Two surfaces, one provider (Fork A).** Author *both* the routing entry guard and the rendering access gate as one member sharing one authz provider — don't split into two members or collapse to one surface.
2. **Deny-outcome: UX names the family, the provider owns 403-vs-404 (Fork B).** The intent exposes `hide | redirect | forbid | cloak`; the forbid(403)-vs-cloak(404) existence-hiding choice is decided **behind the provider** (security, not UX), per [protocols.json:96](../src/_data/protocols.json#L96).
3. **Feature flags = an authority kind, not separate machinery (Fork C).** A flag source is one `CustomGuardProvider`; it inherits the UX-mirror trust boundary. Default the authority taxonomy to the open set (`authorization | feature-flag | process | validity`).
4. **Restate, don't re-decide, the trust boundary (Fork D).** The member declares the front-end is a UX mirror and the back-end is authoritative — inherited verbatim from the Guard protocol and the #012 identity finding.

## Files Created/Modified

| File | Action |
| --- | --- |
| `reports/2026-06-11-access-control-authorization-gate.md` | Created (this report) |
| `src/_includes/research-descriptions/access-control-authorization-gate.njk` | Created (research-topic description) |
| `backlog/178-access-control-authorization-gate.md` | Restructured into prepared-fork shape (home ruling preserved) |
