# Identity-ceremony authoring — research subject (grounds #499)

**Status: open research subject.** Opened 2026-06-22 from the #499 review: the identity-ceremony
Configurator-domain seam is under-researched, so #499 is neither `priority: low` (a guessed default would be
wrong) nor a `maturityGated` park (it's not waiting on adoption — it's waiting on a prior-art survey we can
do now). This report frames the question and the prior art to survey; it does not yet exhaust it.

## The question (#499)

The credential-acquisition build (`#483`/`#496`, both resolved) deliberately **omits** a Configurator
domain — technical defaults ride the `CustomCredentialProvider` registry + config-flavors. #499 asks: *if a
real authoring need emerges (authors tuning passkey / FedCM enrollment flows without writing a plug), what
would an identity-ceremony domain in the plateau-app Technical Configurator expose, and is the data-driven
domain pattern (seed + provider entry, like the `webvalidation`/file-upload domain `#725`) the right shape?*

The seam is **authoring**, not protocol: the credential-acquisition *protocol* and the *webidentity project*
are already their own research subjects (`we:src/_data/researchTopics/credential-acquisition-protocol.json`,
`we:src/_data/researchTopics/web-identity-project.json`). This subject is specifically *how a non-coding
author configures an enrollment ceremony*.

## Prior art to survey

- **Web platform (authoritative).** WebAuthn / passkeys registration ceremony (`navigator.credentials.create`,
  the `PublicKeyCredentialCreationOptions` surface: RP, user, authenticator-selection, attestation,
  resident-key/discoverable-credential, user-verification), and **FedCM** (`navigator.credentials.get` with an
  IdP config endpoint). These define the *axes* an authoring surface would expose. Survey: which of these
  options are author-meaningful vs impl-detail, and which are policy (UV required vs preferred) vs branding
  (RP name/icon).
- **Authoring/low-code identity tooling (benchmark).** How hosted identity platforms expose enrollment-flow
  configuration to non-coders (flow builders, enrollment-policy toggles, branded ceremony screens). Survey
  the *shape* of their author surface (form-of-knobs vs visual flow vs policy matrix), not the vendor.
- **In-repo pattern (the candidate home).** The plateau-app **Technical Configurator** data-driven domain
  (seed + provider entry), as shipped for `webvalidation`/file-upload (`#725`). Confirm whether an identity
  domain is a clean instance of that pattern or needs a new seam.

## Open survey questions (what a fuller pass closes)

1. Which `PublicKeyCredentialCreationOptions` / FedCM-config axes are **author-facing** vs impl-only? (The
   domain should expose only the author-meaningful ones.)
2. Is enrollment-ceremony authoring a **policy** surface (toggles/matrix) or a **flow** surface (ordered
   steps)? This decides the domain's UI shape.
3. Does it fit the existing data-driven Configurator domain (seed + provider entry) with **zero** new
   mechanism, or does ceremony-authoring need a seam the file-upload/webvalidation domains didn't?
4. Is there an actual authoring **consumer** yet (the #499 demand gate), or does this stay research-only
   until one appears?

## Disposition

Until this survey lands, #499 stays **open, research-gated** (not parked, not `priority: low`): the next
action is the survey above, after which the build-vs-defer fork is shapeable — or dissolves if Q4 shows no
consumer.

---

## Survey results (executed 2026-06-23)

The framing above is now answered. The survey ran the three benches (web platform · low-code identity
tooling · in-repo pattern) against the four open questions.

### Q1 — Which creation-options / FedCM axes are author-facing vs impl-only?

The `PublicKeyCredentialCreationOptions` surface splits cleanly into three tiers:

- **Author-facing POLICY axes** (a non-coder would meaningfully set these):
  - `authenticatorSelection.userVerification` — `required` / `preferred` / `discouraged`
    ([userVerification deep dive — web.dev](https://web.dev/articles/webauthn-user-verification)). This is
    the canonical policy knob: a security-vs-friction tradeoff, exactly an author call.
  - `authenticatorSelection.residentKey` / discoverable credential — `required` / `preferred` /
    `discouraged` ([Discoverable credentials deep dive — web.dev](https://web.dev/articles/webauthn-discoverable-credentials)).
    Decides usernameless sign-in; an author-meaningful UX policy.
  - `authenticatorSelection.authenticatorAttachment` — `platform` (this device) vs `cross-platform`
    (security key). A real product policy (consumer passkeys vs enterprise key requirement).
  - `attestation` — `none` / `indirect` / `direct` / `enterprise`
    ([PublicKeyCredentialCreationOptions — MDN](https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialCreationOptions)).
    Author-facing *only* in the enterprise tier; `none` is the default and most consumer authors never touch it.
  - `timeout` — a UX patience knob; author-meaningful but trivial.
- **BRANDING axes** (author-facing, but content not policy): `rp.name`, `rp.icon`, `user.displayName`.
  These are the "branded ceremony screen" surface — not a Configurator's strength (a Configurator answers
  *which strategy*, not *what's your logo*).
- **IMPL-ONLY** (never author-facing): `challenge` (server-minted nonce), `user.id` (server handle),
  `pubKeyCredParams` (COSE alg negotiation), `excludeCredentials` (dedupe list), `rp.id` (origin-derived).
  These are server/library mechanics — the `we:identity/contract.ts` provider's job, never an author's.
- **FedCM** is even thinner on the author side. The RP call is `navigator.credentials.get({ identity: {
  providers: [{ configURL, clientId, nonce, ... }] } })`; the real config lives in the IdP's **config file**
  (endpoints the browser fetches), which the RP author does not write
  ([Identity provider integration — MDN](https://developer.mozilla.org/en-US/docs/Web/API/FedCM_API/IDP_integration)).
  The only RP-author-facing FedCM axes are `configURL` + `clientId` (registration data, not a tunable
  policy) and `mediation` (`optional` / `required` / `silent`) + `context`
  ([Relying party federated sign-in — MDN](https://developer.mozilla.org/en-US/docs/Web/API/FedCM_API/RP_sign-in)).
  So FedCM contributes **one shared axis** (`mediation`) and otherwise integration constants — almost no
  Configurator surface.

**Net:** the author-facing axis set is small and *policy-shaped*: `userVerification`, `residentKey`,
`authenticatorAttachment`, `attestation` (enterprise only), `mediation`, `timeout`. Everything else is
branding (wrong tool) or impl (the provider's job).

### Q2 — Policy surface or flow surface?

**Policy.** Every author-facing axis above is a *single enumerated choice on an independent knob*
(`required`/`preferred`/`discouraged` etc.) — there is no ordering, no branching, no per-step UI. The
enrollment "ceremony" is a single `navigator.credentials.create` call; the author is not sequencing steps,
they are *choosing a policy point*. This is the exact shape the
`plateau:src/technical-configurator/types.ts` `Axis` model encodes (`Axis.values[]`, `Axis.policy`,
`plateau:src/technical-configurator/seed-file-upload.ts:20-97`) — a matrix of independent enumerated axes,
**not** an ordered-step flow. (The low-code tooling that *does* offer flow-building — Descope's visual Flow
editor — is solving a *different* problem: multi-factor orchestration and branded screens, not single-
ceremony policy. See Q-benchmark.)

### Q3 — Clean instance of the existing domain pattern, or a new seam?

**Clean instance, zero new mechanism.** Adding a domain in the plateau Technical Configurator is exactly
*one seed module + one provider entry* — verified:

- Seed: a `plateau:src/technical-configurator/seed-<id>.ts` exporting a typed `Domain`
  (`{ id, name, tagline, axes, strategies }`), e.g.
  `plateau:src/technical-configurator/seed-file-upload.ts:265-271`. Axes are
  `{ id, label, question, policy, values[] }` (`plateau:src/technical-configurator/seed-file-upload.ts:20-97`);
  strategies declare a `capabilities: Record<axisId, valueId>` placing each strategy on every axis
  (`plateau:src/technical-configurator/seed-file-upload.ts:99-263`).
- Provider entry: one `import` + one array element in the `DOMAINS` registry at
  `plateau:src/technical-configurator/provider.ts:26-48` (the comment at L47 literally says future domains
  "slot in here — no UI change"). The UI depends only on the `CapabilityProvider` seam
  (`plateau:src/technical-configurator/types.ts:82-85`), never on a seed.

An identity-ceremony domain is a *textbook* instance: the author-facing axes (Q1) map straight onto `Axis`
objects (each a policy enum), and the strategies are the credential families (passkey / FedCM / password /
digital) declaring where each sits — e.g. passkey supports `residentKey:required`, FedCM is
`request-only`/`mediation`-driven. **No new seam is needed.** This matches the #483 ruling that technical
defaults already ride the `CustomCredentialProvider` registry + config-flavors
(`we:src/_data/protocols/credential-management.json`); a Configurator domain would be a *thin decision-aid
veneer over the same axes*, not new machinery.

### Q4 — Is there an actual authoring consumer yet? (the demand gate)

**No.** Surveyed the whole constellation:

- **`we:` WE repo** — the only identity surface is the conformance demo
  `we:demos/webidentity-conformance-demo.ts`, which supplies its **own** in-demo `DemoCredentialProvider`
  (capability-gated stubs) to prove the type-only contract `we:identity/contract.ts` is realizable. It does
  **not** ask an author to tune `userVerification`/`residentKey` — it hardcodes a provider. No authoring
  need.
- **`plateau:` plateau-app** — the Technical Configurator has ~17 domains (`plateau:src/technical-configurator/provider.ts:26-48`)
  and **none** is identity/credential. The one credential-shaped module,
  `plateau:src/dev-browser/credential-source/index.ts`, is the *git-forge write-auth* seam (bridge-auth /
  GitHub-App broker / user-PAT for the fix-loop, #600) — **not** an end-user identity-enrollment authoring
  surface. It is a different problem wearing a similar word.
- **No exercise-app / flagship flow** requires an author to configure a passkey or FedCM enrollment ceremony
  without writing a plug. The demand gate the framing named (#499 Q4) is **unmet**.

### Benchmark — the low-code identity-authoring shape (for when a consumer *does* appear)

Hosted CIAM platforms confirm the two surfaces are distinct and the *policy* one is exactly a knob-matrix:

- **Clerk** reduces passkeys to a **single dashboard toggle** — pure policy, no flow
  ([Clerk auth tools guide](https://clerk.com/articles/authentication-tools-for-nextjs)).
- **Auth0** exposes passkey **policy** (enable on a connection, progressive vs local enrollment) as
  dashboard toggles, separate from any flow
  ([Configure passkey policy — Auth0](https://auth0.com/docs/authenticate/database-connections/passkeys/configure-passkey-policy)).
- **Descope** is the flow-builder outlier — a visual no-code **Flow** editor — but that solves *multi-step
  orchestration + branded screens*, not single-ceremony policy
  ([CIAM guide — guptadeepak.com](https://guptadeepak.com/ciam-compass/guides/passwordless-authentication/)).

So when a real consumer appears, the right shape is the **policy/knob-matrix** (Clerk/Auth0 model = the
`plateau:` Configurator `Axis` model), not a flow editor. This de-risks the eventual build: it's the
existing pattern, no new seam.

## Recommendation (to ratify in #499)

**Default: (b) HOLD on a concrete-consumer trigger — do NOT build now, do NOT permanently dissolve.**
Confidence: **High** on the shape (clean instance, policy-surface, axes identified); **High** on "no
consumer today" (the constellation grep is unambiguous).

The survey *strengthens* the seam's specifiability (Q1–Q3 are now answered — we know the axes, the shape,
and that it's zero-new-mechanism) while *confirming* there is no consumer (Q4). That combination is the
textbook **specifiable-but-no-demand** case: a build now would be a Configurator domain **no author can
reach**, duplicating axes the `CustomCredentialProvider` registry + config-flavors already carry
(`we:src/_data/protocols/credential-management.json`) — premature coupling of a `plateau:` product surface
to a standard-layer concept with zero pull, against bias-toward-separation and constellation-layering.

It is **not** a clean *dissolve* either: the survey proves the domain *is* cleanly buildable the moment a
consumer appears (one seed + one provider entry), so killing the option discards real, now-cheap design
work. The honest disposition is **hold with a crisp un-park trigger**: the first flagship/exercise-app flow
that needs an author to tune passkey/FedCM enrollment policy *without writing a plug*. On that trigger the
build is a ~1-day data task (seed the six author-facing axes from Q1 as a `plateau:` domain), not a fresh
research effort.
