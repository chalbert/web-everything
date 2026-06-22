---
kind: decision
status: open
blockedBy: []
relatedReport: reports/2026-06-22-identity-ceremony-authoring.md
dateOpened: "2026-06-13"
tags: [webidentity, configurator, passkey, fedcm, authoring, research-gated]
---

# Identity ceremony Configurator domain (plateau-app) — explore on real authoring need

**Research-gated (not parked, not `priority: low`).** Whether to add an identity-ceremony domain to the
plateau-app Technical Configurator, and what it would expose, is **under-researched** — the seam needs a
prior-art survey before the build-vs-defer call is shapeable. So this stays an **open decision** with a
**research subject** as its next action, not a hold: a guessed enrollment-config default would be *wrong*
(so not `priority: low`), and it isn't waiting on adoption (so not a `maturityGated` park) — it's waiting on
a survey we can do now.

**Next action — the research subject:** [`we:reports/2026-06-22-identity-ceremony-authoring.md`](../reports/2026-06-22-identity-ceremony-authoring.md)
/ the [`identity-ceremony-authoring`](/research/identity-ceremony-authoring/) `/research/` topic frames the
question + the prior art to survey (WebAuthn/passkey + FedCM enrollment axes · low-code identity authoring
shape · the existing data-driven Configurator domain pattern, #725). Once that lands, the fork below is
shapeable — or dissolves if no authoring consumer exists.

## The fork (shapeable after the survey)

Exploratory placeholder carved from #496 Fork 3. The credential-acquisition build (#483, resolved)
deliberately omits a Configurator domain — technical defaults ride the `CustomCredentialProvider` registry +
config-flavors. IF a real ceremony-authoring need emerges (authors tuning passkey/FedCM enrollment flows
without writing a plug), add an identity domain to the plateau-app Technical Configurator (data-driven: seed
+ provider entry, same as the file-upload domain #725). Honours bias-toward-separation + constellation
layering. The open call — build now vs hold, and *what the domain exposes* — is downstream of the survey's
answer to "which enrollment axes are author-facing, and is there a real authoring consumer yet."
