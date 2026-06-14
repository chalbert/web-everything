# Credential-Acquisition Protocol — build-design prior art (deferred `webidentity`)

**Backlog:** [#496 — webidentity build-design decision](../backlog/496-webidentity-build-design-credential-acquisition-protocol-con.md) (blocks the deferred build epic [#483](../backlog/483-webidentity-project-credential-acquisition-protocol-deferred.md))
**Date:** 2026-06-13
**Status of design:** none — this is the design-first step-1 survey that grounds #496's build-level forks.
**Builds on:** [#012 / Web Identity Project survey](2026-06-11-webidentity-project.md) (settled the *meta*-shape) and its published [Web Identity Project](/research/web-identity-project/) research topic.

## The question

#012 settled **what** `webidentity` is: a project owning **one** `credential-acquisition` protocol, with passkey/WebAuthn · FedCM · Digital Credentials · password as swappable providers behind a `CustomCredentialProvider` seam, identity *producing* the auth-state predicate that Guard's access-gate *consumes* (Forks 1/3/4), and the thin UX intent pulled forward (Fork 2-A, shipped as #482). What it did **not** settle is **how to build** the deferred protocol. This survey grounds three build-level forks: (1) the **provider-seam contract shape**, (2) the protocol's **lifecycle scope** (acquisition-only vs the fuller credential lifecycle), and (3) whether a **Configurator domain** is in-scope.

The external identity landscape (WebAuthn L3 / FedCM / Digital Credentials / Credential Management) is already surveyed in the #012 report — not repeated here. The new ground is two-fold: the **full `CredentialsContainer` method surface** (which #012 touched only at `get()`), and the **internal provider-seam precedent** (Guard / Lifecycle / Validation) that dictates the contract shape.

## Finding 1 — the credential lifecycle is four methods, with per-family asymmetric support

`navigator.credentials` ([CredentialsContainer — MDN](https://developer.mozilla.org/en-US/docs/Web/API/CredentialsContainer)) exposes **four** methods, not one. #012 modelled only `get()`:

| Method | Ceremony | Passkey (WebAuthn) | Password | FedCM (federated) | Digital |
|---|---|---|---|---|---|
| **`get()`** | acquisition / authentication | ✅ | ✅ | ✅ | ✅ |
| **`create()`** | enrollment / registration | ✅ (new passkey) | ✅ (capture pair) | ❌ (enroll is out-of-band at the IdP) | ❌ (issued by a wallet/issuer) |
| **`store()`** | persist after auth | ❌ (authenticator self-stores) | ✅ | ❌ | ❌ |
| **`preventSilentAccess()`** | sign-out (origin-global flag, blocks auto re-login) | n/a (origin-wide) | ✅ | ✅ | n/a |

**The load-bearing finding:** the lifecycle is **asymmetric by family**. Acquisition (`get`) is universal; **enrollment (`create`) exists only for passkey + password**; FedCM and Digital Credentials are **get-only** (enrollment happens off-platform at the IdP/issuer); `preventSilentAccess()` is an origin-global sign-out switch. So a protocol that fixed a single flat "credential" contract would force get-only families to stub out `create`/`store`. This is exactly the shape Guard solved with **members** — *"deny-outcomes are NOT unified; each member owns its own family"* ([protocols.json:96](../src/_data/protocols.json#L96)).

## Finding 2 — every WE project owns a protocol with one swappable `CustomXProvider` seam

The internal precedent is uniform and load-bearing for Fork 1. Across the constellation, a project owns **one** protocol that fixes **one** seam resolved by a swappable provider, *native-first default → project override → custom plug*:

- **Guard** — *"resolved by a swappable `CustomGuardProvider` (default → project override → custom plug)… async, server-authoritative (the front-end is a UX mirror, never enforcement), and revocable"* ([protocols.json:94-96](../src/_data/protocols.json#L94)). The **identical trust boundary** identity carries.
- **Lifecycle** — *"resolved by a swappable `CustomLifecycleProvider` registry… the transition map is the only lock: data-defined and portable, so a workflow engine plugs in behind the provider"*, and it **delegates** authorization to Guard and persistence to its own concern ([protocols.json lifecycle entry](../src/_data/protocols.json)).
- **Validation** (`CustomValidation`), **Change Tracking** (`CustomChangeStrategy`, *"a strategy registry with per-scope selection"*), **Localization** (`CustomTranslationProvider`, *"a provider registry with namespace + fallback-chain resolution"*), **Anchor Positioning** (`CustomPositioner`), **Render Strategy** (`CustomRenderStrategy`).

**Implication:** `CustomCredentialProvider` is not greenfield — it is the same registry+provider pattern, with Guard's *async, server-authoritative, revocable* contract shape (identity, like Guard, crosses the trust boundary; the front-end only *gathers* a credential the server then verifies — #012 Finding 2). The only genuinely open design is **what the contract's method set is** (Finding 1's lifecycle) and **how the demo stays server-less** (Finding 3).

## Finding 3 — server-less demoability needs a mock provider; that is also doctrine

#012 and #483 both deferred *because* "ceremonies need real server counterparts to demo." But the provider seam dissolves this: a protocol ships a **native-first default** (`navigator.credentials` passthrough) **plus a mock/in-memory conformance provider** that returns a canned typed credential (a fake `PublicKeyCredential` / `PasswordCredential`) with no RP server — so every conformance fixture and demo runs offline, exactly as other protocols ship a default + a conformance playground. Real RP-backed providers (a SimpleWebAuthn server harness) become an opt-in adapter demo later, not a precondition. This is the established native-first-default + opt-in-adapter layering ([[feedback_native_first_default]]) and is what makes the eventual build **sliceable with every slice demoable** (the exact condition the `/slice 483` run flagged as failing).

## Finding 4 — "Configurator domain" is a separable, possibly-omittable scope

#012 Fork-2 lumped "the full protocol + provider contract + **Configurator domain**" into the deferral. But the Configurator is a **plateau-app** (product-layer) concern, a different repo/layer in the constellation, and the platform already has a **config-flavors** mechanism for technical defaults: the Auto-Define-Strategy protocol explicitly states *"the tool carries no default: the default-strategy selection comes from the platform config a project extends, shipped in flavors"* ([protocols.json auto-define entry](../src/_data/protocols.json)). So a technical mediation/provider default can ride config-flavors without a bespoke Configurator domain. Whether identity warrants its *own* Configurator domain (a guided ceremony-config authoring surface) is a real, separable question — not automatically in-scope for the standard-layer build.

## The three build-level forks (carried into #496)

### Fork 1 — `CustomCredentialProvider` seam: one registry-resolved contract, default = native passthrough + mock

- **(A — recommended) One `CustomCredentialProvider` contract, registry-resolved per requested family**, `default → project override → custom plug` (the Guard pattern); the protocol's dispatcher fans a request to the providers registered for the requested `credentials:[…]` families. **Default provider = native `navigator.credentials` passthrough; a mock in-memory provider ships for server-less conformance.** Ceremony libraries (SimpleWebAuthn/Hanko) are swappable plugs. Mirrors `CustomGuardProvider`/`CustomLifecycleProvider`; async + server-authoritative + revocable.
- **(B) A single monolithic provider** that branches on family internally — loses the swap-one-family-out interop story (the platform's whole point). Rejected.
- **(C) Per-family contracts** (`CustomPasskeyProvider`, `CustomFedCMProvider`…) — fragments the seam; contradicts #012 Fork-4's single-protocol ruling. Rejected.

### Fork 2 — lifecycle scope: acquisition-only vs request/enrollment/session members

- **(A — recommended) Model the lifecycle as protocol members** (the Guard pattern), each declaring which families support it: **`credential-request`** (`get` — all families), **`credential-enrollment`** (`create`/`store` — passkey + password), **`session-mediation`** (`preventSilentAccess` sign-out — origin-global). Keeps **one** protocol; admits enrollment/sign-out as siblings rather than stubbed methods on a flat contract. Keep the protocol id **`credential-acquisition`** (acquisition is the headline member; the native anchor is the Credential Management API).
- **(B) Acquisition-only**; enrollment + sign-out out of scope. Cleaner name match but leaves passkey **registration homeless** — and you cannot demo passkey sign-in without first enrolling one. Rejected as too thin.
- **(C) Flat single-contract protocol** with all four methods — forces get-only families (FedCM/digital) to stub `create`/`store`; contradicts the member pattern Guard established. Rejected.

### Fork 3 — Configurator domain: defer/omit (provider + flavors suffice) vs in-scope

- **(A — recommended) Omit the Configurator domain from this build; technical defaults ride the provider registry + config-flavors** (the Auto-Define-Strategy precedent). Add an identity Configurator domain to plateau-app **only if** a real ceremony-authoring need emerges, carved then as a plateau-app item. Honors bias-toward-separation + constellation layering.
- **(B) Include a Configurator domain in this epic.** Couples a plateau-app product surface into a standard-layer build; heavier; premature. Rejected for now.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · provider seam** | one `CustomCredentialProvider`, registry-resolved per family; default = native passthrough + mock conformance provider | monolithic / per-family contracts *(rejected)* | **High** — uniform Guard/Lifecycle/Validation precedent |
| **2 · lifecycle scope** | members: `credential-request` · `credential-enrollment` · `session-mediation` | acquisition-only *(too thin)* | **Med-high** — grounded in the asymmetric `CredentialsContainer` surface |
| **3 · Configurator domain** | omit; provider + config-flavors suffice; carve to plateau-app only on real need | include in this epic *(premature)* | **Med** — separation doctrine, but a real authoring need could reopen it |

## Cross-references

- Decision: [#496 build-design](../backlog/496-webidentity-build-design-credential-acquisition-protocol-con.md) → blocks [#483 deferred epic](../backlog/483-webidentity-project-credential-acquisition-protocol-deferred.md)
- Upstream meta-decision: [#012](../backlog/012-gap-5-webidentity-project.md) (Forks 1/3/4 + timing settled) · shipped thin intent [#482](../backlog/482-web-identity-thin-intent-mediation-credential-request-auth-s.md)
- Provider-seam precedent: [Guard #272](../backlog/272-guard-protocol-predicate-gated-transitions-and-presence-open.md) · Lifecycle · Validation · Change Tracking ([protocols.json](../src/_data/protocols.json))
- Distinct gaps (do not merge): [#009 `webpermissions`](../backlog/009-gap-13-webpermissions-project.md) · [#178 access-control](../backlog/178-access-control-authorization-gate.md) (downstream consumer of the auth-state predicate)

## Sources

- [CredentialsContainer — MDN](https://developer.mozilla.org/en-US/docs/Web/API/CredentialsContainer) (`get`/`create`/`store`/`preventSilentAccess`)
- [Web Authentication API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API) · [WebAuthn L3 — W3C](https://www.w3.org/TR/webauthn-3/) (the `create()` registration vs `get()` authentication ceremony)
- [FedCM API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/FedCM_API) · [Digital Credentials — W3C](https://www.w3.org/TR/digital-credentials/) (get-only families; enrollment off-platform)
- Internal precedent: `src/_data/protocols.json` (Guard, Lifecycle, Validation, Change Tracking, Auto-Define-Strategy) · `src/_data/projects.json` (webguards, weblifecycle, webvalidation)
