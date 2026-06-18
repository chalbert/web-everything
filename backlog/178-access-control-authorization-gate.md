---
type: decision
workItem: story
size: 5
status: resolved
blockedBy: ["288"]
dateOpened: "2026-06-07"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
preparedDate: "2026-06-11"
relatedReport: reports/2026-06-11-access-control-authorization-gate.md
tags: [access-control, authorization, feature-flags, route-guard, declarative, candidate, harvest]
crossRef: { url: /backlog/272-guard-protocol-predicate-gated-transitions-and-presence-open/, label: "Guard protocol (#272)" }
---

# Access control — declarative authorization / feature-flag gate

## Digest

Declarative authorization / feature-flag gate, grounded in a [prior-art survey](/research/access-control-authorization-gate/). The **home fork is already ruled** (entry member of the Guard protocol #272, not its own project — kept below). Four open **member-design** forks, each with a **bold** default: **A — two surfaces (routing entry guard + rendering access gate) off one authz provider**; **B — the UX names the deny family `hide|redirect|forbid|cloak`, but 403-vs-404 lives behind the provider**; **C — feature-flags are an authority *kind* resolved through the same provider seam**; **D — restate (not re-decide) the UX-mirror trust boundary**.

## Axis framing

The survey's load-bearing finding is that authorization is **universally factored into two surfaces fed by one ability source** — a navigation-entry route guard (Angular `CanActivate`, React Router loader `throw redirect`, Vue `router.beforeEach`) and a render-time element gate (CASL `<Can>`) — that share only the predicate. That predicate-provider seam is **already minted**: the Guard protocol fixes *"a predicate/policy attached to a region… resolved by a swappable CustomGuardProvider… async, server-authoritative (the front-end is a UX mirror, never enforcement), and revocable"* and already names access control as its entry member, stating *"entry guard → hide|redirect|forbid|cloak, where the 403-vs-404 disclosure call lives behind the provider"* ([we:protocols.json:96](../src/_data/protocols.json#L96), owned by webguards — [we:projects.json:235](../src/_data/projects.json#L235)). So this member does **not** re-define provider/predicate/deny machinery; it sits on it. The sibling exit guard already demonstrates the shape — same provider, a different deny-outcome (`confirm`), composing the Navigation API's `route`-scope interception ([we:intents.json:2037](../src/_data/intents.json#L2037)) — and the route-guard surface here reuses that same Navigation-API substrate the Navigation intent owns ([we:intents.json:1139](../src/_data/intents.json#L1139), [we:intents.json:1696](../src/_data/intents.json#L1696)). The trust boundary is identical to the #012 identity finding ([backlog/012:25](/backlog/012-gap-5-webidentity-project/)); the build is gated on authoring the protocol itself ([#288](/backlog/288-author-the-guard-protocol-standard-provider-predicate-seam/)). This is **app-level authorization**, distinct from [#009 `webpermissions`](/backlog/009-gap-13-webpermissions-project/) (the browser Permissions API — camera/geolocation) — a different concern that must not be conflated.

### Recommended path at a glance

The home row is ruled (kept for context). Ratify the four member-design rows, or override just the one you'd change. The **confidence** column says where judgment is actually needed vs. where to nod.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **0 · home (ruled)** | entry member of the Guard protocol (#272) | own project *(rejected)* | **Settled** — protocol-is-first-class + #129 settlement |
| **A · surfaces** | **two surfaces** (routing entry guard + rendering access gate) off **one** authz provider | one surface, or two members *(rejected)* | **High** — unanimous across CASL/Angular/RR/Vue |
| **B · deny-outcome** | UX names `hide\|redirect\|forbid\|cloak`; **403-vs-404 decided behind the provider** | author-chosen 403/404 dimension *(rejected)* | **High** — RFC 9110 existence-hiding is security, not UX |
| **C · feature flags** | an authority **kind** resolved via the same provider seam | a separate flag machinery *(rejected)* | **Med-high** — same abstraction, different stakes |
| **D · trust boundary** | **restate** front-end=mirror / back-end=authoritative | re-specify enforcement here *(rejected)* | **High** — inherited from Guard protocol + #012 |

## Fork 0 — where does access control live? (RULED — kept for context)

**Home is decided: the entry member of the Guard protocol ([#272](/backlog/272-guard-protocol-predicate-gated-transitions-and-presence-open/)), not its own project** — protocol-is-first-class + the #129 settlement (2026-06-10: access control is the *entry* mirror of the *exit* guard #129→#273). So "intent vs block vs project" resolves to "a member of an existing first-class protocol": build it on #272's predicate-provider seam + deny-outcome machinery ([we:protocols.json:96](../src/_data/protocols.json#L96)), don't redefine it. Feature-flags-as-authority and the Navigation-API grounding are design detail *within* that home. **Item stays open**: `blockedBy` [#288](/backlog/288-author-the-guard-protocol-standard-provider-predicate-seam/) (authoring the protocol), and authoring the member (the two surfaces below) is the remaining build.

> **Provenance:** surfaced during a final review of the legacy `plateau` repo (`we:access-control.md` — its richest concept). **Plateau is not a model and must not be consulted or copied** — design fresh.

## Fork A — one member, two surfaces (routing entry guard + rendering access gate)

**Crux.** Every surveyed stack keeps navigation-entry authorization (Angular `CanActivate`, React Router loader `throw redirect`, Vue `beforeEach`) separate from render-time authorization (CASL `<Can>` / `$can`), with one shared ability source feeding both ([report finding 1](../reports/2026-06-11-access-control-authorization-gate.md)). The question: does the member expose both, just one, or split into two members?

- **(A — recommended) Two surfaces, one provider.** Author *both*: a **routing entry guard** (deny → a navigation outcome) and a **rendering access gate** (deny → render-or-hide a subtree, the CASL `<Can>` element-level case), sharing one authz provider resolved off the Guard seam. The two surfaces are the natural decomposition the whole ecosystem confirms; one provider keeps the ability source single-sourced (isomorphic, like CASL).
- **(B) One surface only** (route guard *or* element gate). Cheaper, but every surveyed library ships both because they serve genuinely different needs (a guarded route vs. a hidden button); dropping one forces authors back to ad-hoc `v-if`/conditional rendering. *Rejected.*
- **(C) Two separate members** under the protocol. Over-splits one provider into two homes for no benefit and risks the two surfaces drifting out of sync on the ability source. *Rejected.*

## Fork B — deny-outcome family, and where the 403-vs-404 call lives

**Crux.** Entry-deny outcomes collapse to a small named family — redirect (login/fallback), block (cancel in place), or render a forbidden/not-found view. RFC 9110 sanctions **existence hiding**: a `403` confirms the resource exists (enumerable by an attacker), so a server MAY return `404` to cloak it ([report finding 2](../reports/2026-06-11-access-control-authorization-gate.md)). Is forbid-vs-cloak a UX-author dimension or a security decision?

- **(A — recommended) UX names the family; the provider owns 403-vs-404.** The intent surfaces `hide | redirect | forbid | cloak` as the deny-outcome vocabulary, but **which fires — especially `forbid` (403) vs `cloak` (404) — is decided behind the guard provider**, because existence-hiding is a security/threat-model call, not a styling choice. This is verbatim what the protocol summary already mandates ([we:protocols.json:96](../src/_data/protocols.json#L96)), so the member just adopts it.
- **(B) Expose 403-vs-404 as a UX-author dimension.** Lets an author pick per-route, but invites a UX author to make a security disclosure decision without the threat model, and fragments the existence-hiding policy across call sites. *Rejected.*

## Fork C — feature flags as an authority kind

**Crux.** Feature flags and authorization provably **abstract the same concept** (a gate over subject + context → boolean), and LaunchDarkly ships entitlements as long-lived flag targeting — but the stakes differ sharply: flags are temporary and low-consequence, authorization is permanent and a leak is a regulator problem, and a client-side flag is *not* a control unless coupled to a backend ([report finding 5](../reports/2026-06-11-access-control-authorization-gate.md)). How is a feature flag modeled here?

- **(A — recommended) An authority *kind*, resolved through the same provider seam.** The gate resolves a set of **authorities** — `authorization` (role/group), `feature-flag`, `process` (a step reachable only after a prior action), `validity` (proceed only when a form is valid) — each an open, extensible kind. A flag source is **one `CustomGuardProvider`** behind the same async predicate (OPA, CASL, and a flag SDK are interchangeable provider impls — [report finding 4](../reports/2026-06-11-access-control-authorization-gate.md)). It inherits the same UX-mirror trust boundary; it is **not** separate machinery and **not** a license to enforce on the client. Default the taxonomy to the **most permissive open set** (custom authority kinds allowed).
- **(B) A separate feature-flag machinery** (its own evaluation/source model beside the gate). Duplicates the provider seam and tempts treating client flags as enforcement, the exact anti-pattern the sources warn against. *Rejected.*

## Fork D — the trust boundary (restate, don't re-decide)

**Crux.** Every source repeats the warning unprompted (Angular: *"Never rely on client-side guards as the sole source of access control… enforce server-side"*; CASL is isomorphic so the *same* ability runs server- and client-side — [report finding 3](../reports/2026-06-11-access-control-authorization-gate.md)). The Guard protocol already fixes this boundary, and #012 identity landed on the identical one ([backlog/012:25](/backlog/012-gap-5-webidentity-project/)).

- **(A — recommended) Restate, don't re-decide.** The member declares explicitly that the front-end gate is a **UX mirror** and the **back-end is authoritative** — inherited verbatim from the Guard protocol ([we:protocols.json:96](../src/_data/protocols.json#L96)), so the standard is never mistaken for security. No new enforcement contract is authored here.
- **(B) Re-specify enforcement at the member level.** Redundant with the protocol and risks a subtly divergent restatement that implies the client gate enforces. *Rejected.*

## Resolution — ratified 2026-06-11

Fork 0 (home) stays as already ruled: access control is the **entry member of the Guard protocol
(#272)**, not its own project. The four member-design forks are ratified to their bold defaults.

- **Fork A — A (two surfaces, one provider):** author both a routing entry guard (deny → navigation outcome) and a rendering access gate (deny → render-or-hide a subtree, the CASL `<Can>` case), sharing one authz provider off the Guard seam — the natural decomposition every surveyed stack confirms, single-sourced.
- **Fork B — A (UX names `hide|redirect|forbid|cloak`; 403-vs-404 behind the provider):** the deny-family vocabulary is UX, but which fires — `forbid` (403) vs `cloak` (404) — is a security/existence-hiding call decided behind the guard provider, verbatim what the protocol already mandates.
- **Fork C — A (feature-flags as an authority *kind*):** flags resolve through the same provider seam as `authorization`/`process`/`validity` authorities (interchangeable provider impls), inheriting the UX-mirror trust boundary; not separate machinery, not a license to enforce on the client; taxonomy defaults to the most-permissive open set.
- **Fork D — A (restate, don't re-decide the trust boundary):** the member declares the front-end gate a UX mirror and the back-end authoritative, inherited verbatim from the Guard protocol and #012 — no new enforcement contract authored here.

**Follow-on builds (not yet scaffolded):**

- Author the two-surface access-control member (route guard + render gate) on the Guard seam, with the `hide|redirect|forbid|cloak` deny-family and authority-kind taxonomy · story/size 5 · blockedBy: #288 → #338

## Progress

**Status:** resolved 2026-06-11 — member-design forks A–D ratified to their bold defaults; Fork 0 (home) kept as previously ruled (entry member of the Guard protocol #272). `blockedBy` [#288](/backlog/288-author-the-guard-protocol-standard-provider-predicate-seam/) is retained: the Guard protocol must be authored before its member, so the two-surface build is recorded as a follow-on (above), not scaffolded here.
