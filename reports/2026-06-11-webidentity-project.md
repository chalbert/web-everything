# Web Identity — project / protocol / intent shape (gap #5)

**Backlog:** [#012 — Decide on Identity/Auth project `webidentity`](../backlog/012-gap-5-webidentity-project.md)
**Date:** 2026-06-11
**Status of design:** none — this report is the design-first step-1 prior-art survey that grounds #012's forks.

## The question

Gap-analysis item #012 asks whether Identity/Auth should be a Web Everything **project**, a **protocol**, an **intent**, or **deferred** — and what shape. The triage note ("Project + Protocol… heaviest to spec and least UI-shaped… rank behind data/i18n/theme") was an unresearched guess. This survey tests it against the real web-platform identity landscape (W3C / MDN / Chrome) and the WE constellation, and reshapes the call into four orthogonal forks each carrying a recommended default.

It also nails down three relationships the item left vague: to **#009 `webpermissions`** (the browser Permissions API — a *different* gap), to **#178 access-control** (app-level authorization, now a member of the Guard protocol #272), and to the existing **`feedback`/session** surfaces.

## Finding 1 — the platform has ALREADY unified identity behind one dispatcher: `navigator.credentials.get()`

The single most consequential finding. The Credential Management API's `navigator.credentials.get()` is not one auth method — it is a **browser-mediated dispatcher** that routes a request to whichever credential family can satisfy it, returning a typed `Credential` subclass:

| Credential family | Returned type | What it is | Platform status (2026) |
|---|---|---|---|
| **Passwords** | `PasswordCredential` | autofill of stored password pairs | shipped (Chromium) |
| **WebAuthn / Passkeys** | `PublicKeyCredential` | device-bound public-key auth (FIDO2); biometric/hardware trust anchor, private key never leaves device | [WebAuthn L3](https://www.w3.org/TR/webauthn-3/) — broad cross-browser support |
| **Federated (FedCM)** | `IdentityCredential` | privacy-preserving "Sign in with X" without third-party cookies/redirects | [FedCM](https://www.w3.org/TR/fedcm/) — Chrome 117+; Google made it mandatory for One Tap Aug 2025; Firefox building; Safari none planned |
| **Digital Credentials** | `DigitalCredential` | wallet-held verifiable identity (mDoc / ISO 18013-5, OpenID4VP, SD-JWT) — gov ID, age verification | [Digital Credentials](https://www.w3.org/TR/digital-credentials/) — Chrome 141 + iOS 26 Safari (Oct 2025) |

All four are invoked through the **same** `navigator.credentials.get({ password, publicKey, identity, digital })` call and `mediation` model (`silent | optional | required | conditional`, plus the proposed `immediate`). The browser owns the account-chooser UI; the site receives a typed credential and verifies it server-side.

**Implication:** the platform itself has factored identity into *one normalized seam (the dispatcher + mediation model) with N swappable credential mechanisms behind it.* That is structurally a **protocol with a provider/predicate seam** — the exact shape WE already minted for the Guard protocol (#272). It is emphatically **not** one monolithic "auth project" with a baked method.

## Finding 2 — authentication is back-end-authoritative; the front-end is a thin UX mirror

Every credential family terminates in **server-side verification**: the RP server validates the WebAuthn assertion signature, exchanges the FedCM token with the IdP, or decrypts/validates the mDoc response. The browser API only *gathers* a credential. Sessions, token storage, refresh, and authorization are entirely off-platform (cookies / `Authorization` headers / app logic).

This is the **identical trust-boundary** already stated for the Guard protocol: *"enforcement is server-side; the front-end is a UX mirror, never the enforcement point"* ([we:protocols.json:96](../src/_data/protocols.json#L96)) and for #178 access-control ([backlog/178:22](../backlog/178-access-control-authorization-gate.md#L22)). WE's job is therefore **not** to standardize auth (a security domain it must not own) but to standardize the *UX-only declarative surface* over the platform's gather-a-credential seam.

## Finding 3 — the boundary with #009, #178, #129 is clean (three distinct gaps, do not merge)

The item conflated four concerns the platform keeps separate:

- **#012 (this) — Identity / credential acquisition.** *Who is the user; prove it.* Native anchor = Credential Management / WebAuthn / FedCM / Digital Credentials. **Open.**
- **#009 `webpermissions` — browser capability grants.** *May the page use the camera / send notifications?* Native anchor = Permissions / Notifications / Push API. A **different** gap; #178 already states the two "should not be conflated" ([backlog/178:14](../backlog/178-access-control-authorization-gate.md#L14)).
- **#178 access-control — app-level authorization.** *Is this (already-identified) user allowed here?* Already resolved as the **entry-guard + access-gate member of the Guard protocol #272** ([backlog/178:38](../backlog/178-access-control-authorization-gate.md#L38)). Identity is its *upstream*: authz consumes an identity the auth surface produced.
- **#129/#273 navigation/exit guards.** Orthogonal (loss-of-state on teardown).

So #012 sits cleanly *above* #178 in the dependency order: **identity (who) → authorization (allowed)**. They share the Guard protocol's provider-seam *pattern* but carry different predicates (a credential vs a policy).

## Finding 4 — libraries exist precisely because the raw ceremony is verbose; that is the adapter case

The WebAuthn registration/authentication "ceremony" (challenge, `create()`/`get()`, attestation/assertion verification, base64url ArrayBuffer juggling) is notoriously fiddly, which is why a library ecosystem exists: **SimpleWebAuthn** (`@simplewebauthn/browser` + `/server`, the de-facto JS choice), `@github/webauthn-json` (thin ArrayBuffer↔JSON helper), **Passwordless.ID/webauthn** (dependency-free), and full passwordless SDKs (**Hanko**, MojoAuth) that bundle recovery/session/user-management. FedCM and Digital Credentials are newer and thinner but follow the same "wrap the raw ceremony" shape.

**Implication:** this is a textbook WE layering — a **native-first default** (the raw `navigator.credentials` ceremony behind a declarative element) with **opt-in adapters** (SimpleWebAuthn et al.) plugged behind the same provider contract, per [[feedback_native_first_default]]. It also confirms the protocol shape: the only durable lock is the provider/credential contract, and the ceremony libraries are swappable implementations of it.

## Finding 5 — the UX-shaped slice is small and intent-friendly

Most of identity is technical (ceremonies, token verification, session storage) → belongs in a **Technical Configurator** domain, not an intent ([[feedback_intent_ux_only_technical_to_configurator]]). What *is* UX-shaped and intent-worthy is narrow but real:

- **mediation** — `silent | optional | required | conditional | immediate` (the user-perceivable autofill-vs-modal-vs-nothing axis; borrow the platform enum verbatim).
- **credential-request declaration** — *which* families a sign-in surface will accept (passkey / federated / digital / password), driving the browser chooser.
- **auth-state presence** — signed-in / signed-out / pending as a gate predicate (this is where identity feeds #178's access provider).

These are thin and compose existing intents (Loader for the in-flight ceremony; Feedback for failure tone — [we:intents.json:1022](../src/_data/intents.json#L1022)). They do **not** justify a heavy standalone project up front.

## Forks (carried into #012)

### Fork 1 — what kind of standard is `webidentity`?

**Crux:** the triage said "Project + Protocol." Finding 1 shows the platform already factored identity into *one dispatcher seam + N swappable credential mechanisms* — a provider/predicate contract whose only lock is that seam.

- **(A — recommended) A `webidentity` *project* that owns one `credential-acquisition` Protocol** (the `navigator.credentials.get` dispatcher + mediation model as the normalized seam; WebAuthn / FedCM / Digital Credentials / password as swappable credential providers behind a `CustomCredentialProvider` contract). Mirrors `webvalidation`→Validation protocol and `webguards`→Guard protocol ([we:projects.json:168](../src/_data/projects.json#L168); [we:protocols.json:94](../src/_data/protocols.json#L94)). The project is the *home*; the protocol is the *lock*; ceremony libs are providers.
- **(B) A bare intent, no project.** Too small — discards the swappable-mechanism interop story that is the whole point of the platform's dispatcher design. Rejected.
- **(C) A heavy "auth project" with a baked method + session/token management.** Crosses into security/enforcement WE must not own (Finding 2); maximizes lock-in. Rejected per [[feedback_minimize_lock_in_protocol_only_lock]].

**Default: A** — project-owns-one-protocol, matching the platform's own factoring.

### Fork 2 — defer the whole thing, or pull forward the thin UX slice?

**Crux:** the triage ranked it #5 "later" because it looked heavy. Finding 5 shows the *protocol+ceremony* is heavy but the *UX intent slice* (mediation + credential-request + auth-state) is small and unblocks #178.

- **(A — recommended) Split-timing: author the thin `mediation`/credential-request **intent** now (cheap, UX-only, composes Loader/Feedback), and *defer* the full protocol + provider contract + Configurator domain.** #178's access provider needs an auth-state predicate to gate on; the intent supplies that seam without committing to the heavy build.
- **(B) Defer entirely until after data/i18n/theme.** Honors the original rank but leaves #178 with no upstream identity signal. Rejected — the cheap slice has a concrete downstream consumer.
- **(C) Build the full project+protocol now.** Highest effort, lowest near-term leverage; the credential ceremonies need real server counterparts to demo. Rejected.

**Default: A** — pull the thin intent forward, defer the heavy protocol.

### Fork 3 — does identity own its own access-gate, or feed #178's?

**Crux:** "signed-in / signed-out" is both an *identity* state and an *authorization* predicate. Risk of two homes both gating presence.

- **(A — recommended) Identity *produces* an auth-state signal; #178's Guard access-gate *consumes* it.** No new gate in `webidentity`. The Guard protocol's predicate/provider seam already gates presence ([we:protocols.json:96](../src/_data/protocols.json#L96)); auth-state is just one predicate feeding it. Bias toward separation/decoupling [[feedback_bias_separation_decoupling]].
- **(B) `webidentity` ships its own `<signed-in>`/`<signed-out>` gate element.** Duplicates Guard's machinery; React's `SignInGate` is exactly the case #272 folded into the access-gate member. Rejected.

**Default: A** — identity emits the predicate, Guard gates on it.

### Fork 4 — one credential surface, or per-family standards?

**Crux:** WebAuthn, FedCM, and Digital Credentials are distinct specs with distinct payloads. Model them as one surface or three?

- **(A — recommended) One `credential-acquisition` protocol with a `credentials: [passkey | federated | digital | password]` request dimension; each family is a provider behind the shared seam.** Matches the platform: one `navigator.credentials.get` call, a union request object, typed responses. Most-flexible default = accept all declared families [[feedback_most_flexible_default]].
- **(B) Three separate standards (`webpasskey`, `webfedcm`, `webwallet`).** Fragments what the platform deliberately unified behind one dispatcher; triples the surface. Rejected.

**Default: A** — one protocol, families as providers/request-dimension.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · standard kind** | `webidentity` **project** owning one credential-acquisition **protocol** (dispatcher seam + swappable providers) | bare intent *(rejected)* | **High** — mirrors platform factoring + webvalidation/webguards precedent |
| **2 · timing** | split: thin **intent now** (mediation + credential-request + auth-state), **protocol deferred** | defer entirely | **Med-high** — cheap slice has a real consumer (#178) |
| **3 · access-gate home** | identity **produces** auth-state predicate; **#178 Guard gate consumes** it | identity ships its own gate *(rejected)* | **High** — Guard #272 already owns presence-gating |
| **4 · surface shape** | one protocol, `credentials: [passkey\|federated\|digital\|password]` request dimension | three per-family standards *(rejected)* | **High** — single `navigator.credentials` dispatcher |

## Cross-references

- Decision: [#012 — `webidentity` project](../backlog/012-gap-5-webidentity-project.md)
- Distinct gaps: [#009 `webpermissions`](../backlog/009-gap-13-webpermissions-project.md) (browser Permissions API) · [#178 access-control](../backlog/178-access-control-authorization-gate.md) (app authorization, downstream consumer)
- Reused machinery: [Guard protocol #272](../backlog/272-guard-protocol-predicate-gated-transitions-and-presence-open.md) (provider/predicate seam, server-authoritative trust boundary)
- Composes: [Loader](/intents/loader/) (in-flight ceremony) · [Feedback](/intents/feedback/) (failure tone)

## Sources

- [Web Authentication API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API) · [WebAuthn L3 — W3C](https://www.w3.org/TR/webauthn-3/)
- [CredentialsContainer.get() — MDN](https://developer.mozilla.org/en-US/docs/Web/API/CredentialsContainer/get) · [PublicKeyCredential — MDN](https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredential)
- [FedCM API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/FedCM_API) · [FedCM — W3C](https://www.w3.org/TR/fedcm/) · [FedCM is shipping — Privacy Sandbox](https://privacysandbox.google.com/blog/fedcm-shipping)
- [Digital Credentials — W3C](https://www.w3.org/TR/digital-credentials/) · [Digital Credentials API shipped — Chrome](https://developer.chrome.com/blog/digital-credentials-api-shipped) · [Modernize authentication with passkeys, digital credentials — Chrome (IO26)](https://developer.chrome.com/blog/io26-web-identity)
- Libraries: [SimpleWebAuthn](https://simplewebauthn.dev/) · [@github/webauthn-json](https://github.com/github/webauthn-json) · [passwordless-id/webauthn](https://github.com/passwordless-id/webauthn) · [Hanko](https://www.hanko.io/)
