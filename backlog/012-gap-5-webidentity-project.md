---
type: decision
workItem: story
size: 5
status: open
dateOpened: "2026-05-31"
tags: [gap-analysis, project, protocol, identity, auth]
relatedReport: reports/2026-06-11-webidentity-project.md
preparedDate: "2026-06-11"
---

# Decide on Identity/Auth project — `webidentity` (gap #5)

No auth, session, authorization, or credential story anywhere in the constellation. Modern native-first identity is real: the Credential Management API, WebAuthn/Passkeys, FedCM, and the Digital Credentials API. The triage note called this "Project + Protocol… heaviest to spec and least UI-shaped" and ranked it #5 ("later") — but that was an unresearched guess. No design exists yet. The four forks below are grounded in a prior-art survey (Credential Management dispatcher, WebAuthn L3, FedCM, Digital Credentials, plus SimpleWebAuthn/Hanko/Passwordless.ID), published as the [Web Identity Project](/research/web-identity-project/) research topic. Each names a recommended default in **bold**.

## Triage context (preserved)

- **Kind**: Project + Protocol (original guess — fork 1 re-tests it)
- **Native anchor**: Credential Management, WebAuthn/Passkeys, FedCM, Digital Credentials, Permissions API
- **Native-first**: ▲ high · **Gap**: ▲ high · **Effort**: ▲ high
- **Rank**: 5 — later (original; fork 2 re-tests the defer call)

## Axis framing

The survey's load-bearing finding is that the platform **already factored identity** into one normalized seam plus N swappable mechanisms: `navigator.credentials.get({ password, publicKey, identity, digital })` is a single browser-mediated **dispatcher** returning a typed credential (`PasswordCredential` / `PublicKeyCredential` / `IdentityCredential` / `DigitalCredential`) under one `mediation` model. That is structurally a **protocol with a provider/predicate seam** — the exact shape WE minted for the Guard protocol ([protocols.json:94](../src/_data/protocols.json#L94)), whose summary already states the trust boundary identity shares: enforcement is server-side, the front-end is a UX mirror ([protocols.json:96](../src/_data/protocols.json#L96)). The four forks are orthogonal: **standard kind** (project/protocol vs intent vs heavy-project), **timing** (defer vs pull-forward the thin UX slice), **access-gate home** (own vs feed #178), and **surface shape** (one protocol vs per-family). The thin UX slice is small and composes existing Loader and Feedback intents ([intents.json:1022](../src/_data/intents.json#L1022)); the access-gate concern lands on the Guard protocol, not here, because #178 is already its member ([backlog/178:38](../backlog/178-access-control-authorization-gate.md#L38)) and identity is #178's *upstream* (identity → authorization). The Permissions-API gap is **#009** and is explicitly a different concern ([backlog/178:14](../backlog/178-access-control-authorization-gate.md#L14)).

### Recommended path at a glance

Ratify all four rows, or override just the one you'd change. The **confidence** column says where judgment is actually needed vs. where to nod.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · standard kind** | `webidentity` **project** owning one credential-acquisition **protocol** (dispatcher seam + swappable providers) | bare intent *(rejected)* | **High** — mirrors platform factoring + webvalidation/webguards |
| **2 · timing** | split: thin **intent now** (mediation + credential-request + auth-state), **protocol deferred** | defer entirely | **Med-high** — cheap slice has a real consumer (#178) |
| **3 · access-gate home** | identity **produces** the auth-state predicate; **#178 Guard gate consumes** it | identity ships its own gate *(rejected)* | **High** — Guard #272 already owns presence-gating |
| **4 · surface shape** | one protocol, `credentials: [passkey\|federated\|digital\|password]` request dimension | three per-family standards *(rejected)* | **High** — single `navigator.credentials` dispatcher |

## Fork 1 — what kind of standard is `webidentity`?

The triage said "Project + Protocol." The survey shows the platform already factored identity into one dispatcher seam + N swappable credential mechanisms — a provider/credential contract whose only lock is that seam ([protocols.json:94](../src/_data/protocols.json#L94)).

- **(A — recommended) A `webidentity` project that owns one `credential-acquisition` protocol.** The `navigator.credentials.get` dispatcher + mediation model is the normalized seam; WebAuthn / FedCM / Digital Credentials / password are swappable providers behind a `CustomCredentialProvider` contract. Mirrors `webvalidation`→Validation and `webguards`→Guard ([projects.json:168](../src/_data/projects.json#L168); [protocols.json:94](../src/_data/protocols.json#L94)). Project = home, protocol = lock, ceremony libs = providers.
- **(B) A bare intent, no project.** Too small — discards the swappable-mechanism interop story that is the whole point of the platform's dispatcher design. *Rejected.*
- **(C) A heavy "auth project" with a baked method + session/token management.** Crosses into security/enforcement WE must not own; maximizes lock-in. *Rejected* per [[feedback_minimize_lock_in_protocol_only_lock]].

## Fork 2 — defer the whole thing, or pull forward the thin UX slice?

The triage ranked it #5 "later" because it looked heavy. The protocol+ceremony *is* heavy, but the UX intent slice (mediation + credential-request + auth-state) is small and unblocks #178 ([intents.json:1022](../src/_data/intents.json#L1022)).

- **(A — recommended) Split-timing: author the thin `mediation`/credential-request intent now** (UX-only, composes Loader/Feedback), and **defer** the full protocol + provider contract + Configurator domain. #178's access provider needs an auth-state predicate to gate on; the intent supplies that seam without committing to the heavy build.
- **(B) Defer entirely** until after data/i18n/theme. Honors the original rank but leaves #178 with no upstream identity signal. *Rejected* — the cheap slice has a concrete downstream consumer.
- **(C) Build the full project+protocol now.** Highest effort, lowest near-term leverage; the ceremonies need real server counterparts to demo. *Rejected.*

## Fork 3 — does identity own its own access-gate, or feed #178's?

"Signed-in / signed-out" is both an *identity* state and an *authorization* predicate — risk of two homes both gating presence.

- **(A — recommended) Identity produces an auth-state signal; #178's Guard access-gate consumes it.** No new gate in `webidentity`. The Guard protocol's predicate/provider seam already gates presence ([protocols.json:96](../src/_data/protocols.json#L96)); auth-state is one predicate feeding it. Per [[feedback_bias_separation_decoupling]].
- **(B) `webidentity` ships its own `<signed-in>`/`<signed-out>` gate element.** Duplicates Guard's machinery; React's `SignInGate` is exactly the case #272 folded into its access-gate member. *Rejected.*

## Fork 4 — one credential surface, or per-family standards?

WebAuthn, FedCM, and Digital Credentials are distinct specs with distinct payloads. One surface or three?

- **(A — recommended) One `credential-acquisition` protocol with a `credentials: [passkey | federated | digital | password]` request dimension; each family is a provider behind the shared seam.** Matches the platform: one `navigator.credentials.get` call, a union request object, typed responses. Most-flexible default = accept all declared families, per [[feedback_most_flexible_default]].
- **(B) Three separate standards (`webpasskey`, `webfedcm`, `webwallet`).** Fragments what the platform deliberately unified behind one dispatcher; triples the surface. *Rejected.*

## Open call

Ratify the four defaults above (or override individually), then graduate: fork 2-A spins off the thin `mediation`/credential-request intent as an agent-ready authoring build, with the full `webidentity` project + `credential-acquisition` protocol deferred. Full survey + sources in the [related report](../reports/2026-06-11-webidentity-project.md).

## Resolution (partial) — 2026-06-11

- **Fork 1 — `webidentity` project owning one `credential-acquisition` protocol**: the platform already factored identity into a single `navigator.credentials.get` dispatcher seam + N swappable credential mechanisms — a provider/predicate shape mirroring `webvalidation`→Validation and `webguards`→Guard, so project = home, protocol = lock, ceremony libs = providers (not a bare intent, which discards the interop story).
- **Fork 3 — identity produces the auth-state signal; #178's Guard gate consumes it**: signed-in/out is an authorization predicate the Guard protocol's presence-gating seam already owns (#272), so identity feeds it one predicate rather than minting a duplicate `<signed-in>`/`<signed-out>` gate.
- **Fork 4 — one protocol with a `credentials: [passkey | federated | digital | password]` request dimension**: matches the platform's single dispatcher + union request + typed responses; most-flexible default accepts all declared families behind the shared seam, rather than fragmenting into three per-family standards.

**Open — needs a human call:** timing (Fork 2) — pull the thin `mediation`/credential-request UX intent forward now (it has a concrete downstream consumer in #178) vs defer the whole protocol/project until after data/i18n/theme — because this is a roadmap/sequencing bet, not a structural one; the shape forks are settled but *when* to spend the slice is the human's prioritization call.
