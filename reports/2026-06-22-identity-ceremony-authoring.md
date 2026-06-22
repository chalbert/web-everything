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
