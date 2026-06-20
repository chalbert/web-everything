---
kind: story
size: 3
parent: "1022"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:identity/contract.ts"
tags: []
---

# webidentity contract — credential-management types in @webeverything

Slice A of webidentity impl epic #1022. Define the credential-management contract (credential provider + thin intent types) in @webeverything per the resolved #012/#482/#483 design. Type-only crosses the seam. Foundation slice — B and C build on it.

## Progress

Shipped `we:identity/contract.ts` — the pure-contract half (compile-erased, future
`@webeverything/contracts/credential-management`): `CustomCredentialProvider` (the `acquire(request):
Promise<CredentialResult>` provider seam, the only lock; async/trust-crossing + revocable `subscribe`),
`CredentialFamily`, `CredentialMember` (1:1 native API map), `CredentialMediation`, `CredentialRequest`,
`CredentialResult`. Mirrors the seam specified + ruled (#496) in
`we:src/_includes/project-webidentity.njk` (#012/#482/#483 design). Native passthrough + mock
conformance providers + `customCredentials` registry stay impl (→ FUI). Result kept thin to leave room
for the 3 downstream open questions (RP/IdP config locus, multi-family disagreement, embedded-context
session-mediation).
