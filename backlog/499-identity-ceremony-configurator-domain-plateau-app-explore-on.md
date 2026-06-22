---
kind: decision
status: open
blockedBy: []
dateOpened: "2026-06-13"
tags: []
---

# Identity ceremony Configurator domain (plateau-app) — explore on real authoring need

**Decision (un-parked 2026-06-22 — parking is not a prioritisation escape):** Whether to build the identity-ceremony Configurator domain now, or hold until a consumer needs it.

> **Blocker cleared 2026-06-16:** #483 (its former `blockedBy`) is resolved, so this is no
> longer DAG-blocked. It stays parked purely on the **demand gate** below — unpark only when a
> real ceremony-authoring need surfaces, not pre-emptively.

Exploratory, non-blocking placeholder carved from #496 Fork 3. The credential-acquisition/credential-management build (#483) deliberately omits a Configurator domain — technical defaults ride the CustomCredentialProvider registry + config-flavors. IF a real ceremony-authoring need emerges (e.g. authors wanting to tune passkey/FedCM enrollment flows without writing a plug), add an identity domain to the plateau-app Technical Configurator (data-driven: seed + provider entry, same as the file-upload domain). Kept so the option isn't lost; reopen only when an actual authoring pain surfaces, not pre-emptively. Honours bias-toward-separation + constellation layering.
