---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
codifiedIn: "one-off"
preparedDate: "2026-06-13"
relatedReport: reports/2026-06-13-credential-acquisition-protocol-build-design.md
tags: [identity, auth, protocol, provider-seam, build-design]
---

# webidentity build-design — credential-acquisition protocol contract, provider seam & lifecycle scope

Build-design decision gating the deferred `webidentity` epic (#483). No build design exists yet — #012 settled only the *meta*-shape (a project owning one `credential-acquisition` protocol; families as a request dimension; identity feeds Guard) and shipped the thin UX intent (#482). This decision settles the **build**, across **3 forks** grounded in the published [Credential-Acquisition Protocol](/research/credential-acquisition-protocol/) research topic ([related report](../reports/2026-06-13-credential-acquisition-protocol-build-design.md)) — each carries a **bold** recommended default. This is the fork-readiness the `/slice 483` analysis flagged as missing; ratifying it unblocks #483 to be sliced into demoable build slices.

## What #012 already settled (do not re-open)

Forks 1/3/4 + timing of [#012](/backlog/012-gap-5-webidentity-project/) are resolved: it **is** a `webidentity` project owning **one** `credential-acquisition` protocol ([we:projects.json:235 webguards precedent](../src/_data/projects.json#L235)); families are **one request dimension** (`credentials:[passkey|federated|digital|password]`), not three standards; identity **produces** the auth-state predicate and Guard's access-gate **consumes** it (#272). The thin mediation/credential-request/auth-state intent shipped as #482. None of that is in scope here.

## Axis framing

The remaining concern decomposes into three orthogonal build axes. **(1) The provider-seam contract** is the central crux but the *least* uncertain: every WE project owns one protocol fixing one seam resolved by a swappable `CustomXProvider`, native-first default → project override → custom plug — Guard's `CustomGuardProvider` ([we:protocols.json:96](../src/_data/protocols.json#L96)), Lifecycle's `CustomLifecycleProvider` ([we:protocols.json lifecycle](../src/_data/protocols.json)), plus Validation/Change-Tracking/Localization/Anchor-Positioning. Identity reuses Guard's *async, server-authoritative, revocable* contract verbatim (the browser only gathers; the server verifies — [#012 report Finding 2](../reports/2026-06-11-webidentity-project.md)). **(2) The lifecycle scope** is the genuinely open axis: the `CredentialsContainer` surface is **four** methods with **asymmetric** family support — `get()` universal, `create()`/`store()` only for passkey+password, `preventSilentAccess()` an origin-global sign-out ([CredentialsContainer — MDN](https://developer.mozilla.org/en-US/docs/Web/API/CredentialsContainer)) — so a flat single contract forces get-only families to stub methods, the exact problem Guard's **member** structure solves ([we:protocols.json:96](../src/_data/protocols.json#L96)). **(3) The Configurator domain** is a separable scope/layer call: it is a plateau-app product concern, and technical defaults can ride the existing **config-flavors** mechanism the Auto-Define-Strategy protocol established (*"the tool carries no default; the default comes from the platform config a project extends, shipped in flavors"* — [we:protocols.json auto-define](../src/_data/protocols.json)).

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · provider seam** | one `CustomCredentialProvider`, registry-resolved per family; default = native passthrough **+ a mock conformance provider** | monolithic / per-family contracts *(rejected)* | **High** — uniform Guard/Lifecycle/Validation precedent |
| **2 · lifecycle scope** | members: `credential-request` · `credential-enrollment` · `session-mediation` | acquisition-only *(too thin)* | **Med-high** — grounded in the asymmetric `CredentialsContainer` surface |
| **3 · Configurator domain** | omit; provider + config-flavors suffice; carve to plateau-app only on real need | include in this epic *(premature)* | **Med** — separation doctrine, but a real authoring need could reopen it |

## Per-fork classification (the 7-question pass)

- **Which layer?** Standard layer (WE) for the project + protocol + `CustomCredentialProvider` seam; the Configurator (Fork 3) is a **plateau-app** product-layer concern — a literal layer-split, hence Fork 3.
- **Protocol or intent dimension?** Protocol — a technical, server-authoritative contract (the Guard twin), not a UX preference. Settled #012-Fork-1.
- **Expose the whole axis?** Families are a request dimension (settled #012-Fork-4); the lifecycle ops are exposed as an **open member set** (Fork 2-A), mirroring Guard's open members.
- **Fixed mechanic or dimension?** The provider is a **DI dimension** (swappable registry); the member set stays **open** (a family declares which members it supports).
- **DI-injectable?** Yes — `CustomCredentialProvider` registry, default → project → plug. This is a **runtime-DI standard seam** (the running standard consults it), like Guard/Lifecycle — not a devtools provider.
- **Most-permissive default?** Accept all declared families (settled #012-Fork-4); default provider = native `navigator.credentials` passthrough (most-available), plus a mock for offline conformance.
- **Seam between intents?** Identity **produces** the auth-state predicate, Guard **consumes** it (settled #012-Fork-3); composes Loader/Feedback via the shipped #482 intent. Bias-toward-separation honoured throughout.

## Fork 1 — `CustomCredentialProvider` seam: one registry-resolved contract, default = native passthrough + mock

**Crux:** what is the provider contract, and how does dispatch by family work? The registry mechanics are precedent ([we:protocols.json:94-96](../src/_data/protocols.json#L94)); the open part is keeping the seam *single* while families differ.

- **(A — recommended) One `CustomCredentialProvider` contract, registry-resolved per requested family**, `default → project override → custom plug` (the Guard pattern); the protocol's dispatcher fans a request to the providers registered for the requested `credentials:[…]` families. **Default provider = native `navigator.credentials` passthrough; a mock in-memory provider ships for server-less conformance** (returns a canned typed credential, no RP server). Ceremony libs (SimpleWebAuthn/Hanko) are swappable plugs. Async + server-authoritative + revocable, like Guard.
- **(B) A single monolithic provider** that branches on family internally. Loses the swap-one-family-out interop story — the platform's whole point. *Rejected.*
- **(C) Per-family contracts** (`CustomPasskeyProvider`, `CustomFedCMProvider`…). Fragments the seam; contradicts #012-Fork-4's single-protocol ruling. *Rejected.*

**Default: A.** *Sub-decision:* ship the mock conformance provider as part of the protocol's first slice so every downstream slice is demoable (the `/slice 483` demoability blocker).

## Fork 2 — lifecycle scope: members (request · enrollment · session-mediation) vs acquisition-only

**Crux:** `CredentialsContainer` is `get`/`create`/`store`/`preventSilentAccess`, with support **asymmetric by family** — `get` universal; `create`/`store` only passkey+password; FedCM/digital get-only; `preventSilentAccess` origin-global ([CredentialsContainer — MDN](https://developer.mozilla.org/en-US/docs/Web/API/CredentialsContainer)). One contract or members?

- **(A — recommended) Model the lifecycle as protocol members** (the Guard pattern), each declaring its supporting families: **`credential-request`** (`get` — all families), **`credential-enrollment`** (`create`/`store` — passkey + password), **`session-mediation`** (`preventSilentAccess` sign-out — origin-global). One protocol; enrollment/sign-out are siblings, not stubbed methods. Keep the protocol id **`credential-acquisition`** (acquisition is the headline member; the Credential Management API is the native anchor).
- **(B) Acquisition-only**; enrollment + sign-out out of scope. Cleaner name match, but leaves passkey **registration homeless** — and you cannot demo passkey sign-in without first enrolling one. *Rejected — too thin.*
- **(C) Flat single-contract protocol** with all four methods on one surface. Forces get-only families (FedCM/digital) to stub `create`/`store`; contradicts the member pattern Guard established. *Rejected.*

**Default: A.** *Sub-decision (naming):* keep `credential-acquisition` over `credential-management` — acquisition is the primary member and the existing #012/#483 naming; rename only if the member set later outgrows it.

## Fork 3 — Configurator domain: omit (provider + config-flavors suffice) vs in-scope

**Crux:** #012-Fork-2 lumped "Configurator domain" into the deferral, but it is a plateau-app concern and config-flavors already carry technical defaults ([we:protocols.json auto-define](../src/_data/protocols.json)).

- **(A — recommended) Omit the Configurator domain from this build; technical defaults ride the provider registry + config-flavors.** Add an identity Configurator domain to plateau-app **only if** a real ceremony-authoring need emerges, carved then as a plateau-app item. Honours bias-toward-separation/decoupling + constellation layering.
- **(B) Include a Configurator domain in this epic.** Couples a plateau-app product surface into a standard-layer build; heavier; premature. *Rejected for now.*

**Default: A.**

## Ruling (2026-06-13)

All three defaults ratified, with **one override** on Fork 2's naming sub-decision and Fork 3 carved to a non-blocking placeholder.

- **Fork 1 — `CustomCredentialProvider` seam → A.** One registry-resolved contract per family, `default → project override → custom plug` (the Guard pattern at [we:protocols.json:102-107](../src/_data/protocols.json#L102)); default provider = native `navigator.credentials` passthrough. **The mock conformance provider ships in the protocol's first slice** (sub-decision ratified) so every downstream #483 slice is demoable without an RP server. *Build note:* dispatch is **2-D** — fan by *family* (Fork 1) and by *member* (Fork 2); the dispatcher spec must state both axes explicitly.
- **Fork 2 — lifecycle scope → A (members), with naming OVERRIDE.** Three members, each declaring its supporting families: `credential-request` (`get` — all), `credential-enrollment` (`create`/`store` — passkey + password), `session-mediation` (`preventSilentAccess` — origin-global). **Protocol id renamed `credential-acquisition` → `credential-management`.** Rationale: once the member set expanded past get-only, the protocol *is* the full Credential Management API surface (request + enrollment + sign-out); "acquisition" undersold two of three members, and the native anchor is literally the Credential Management API. Rename cost is low now (everything is concept-stage; nothing built references the id). #483's scope inherits `credential-management`.
- **Fork 3 — Configurator domain → A (omit), captured as non-blocking [#499](/backlog/499-identity-ceremony-configurator-domain-plateau-app-explore-on/).** Omitted from this build; technical defaults ride the provider registry + config-flavors. Kept alive as an explicit explore-on-real-need idea (blocked-by #483) so the option isn't lost, per the requester.

On this ruling, #483 is fork-clean: its scope is the standard-layer build — `webidentity` project entry, the `credential-management` protocol with the three members, the `CustomCredentialProvider` seam, native-passthrough default + mock conformance provider — which `/slice 483` can now decompose into demoable slices. Full survey + sources in the [related report](../reports/2026-06-13-credential-acquisition-protocol-build-design.md).
