---
type: idea
workItem: epic
status: open
blockedBy: ["482"]
dateOpened: "2026-06-13"
tags: []
---

# webidentity project + credential-acquisition protocol (deferred)

Deferred build graduated from #012's Fork 2-A: the full `webidentity` project owning one `credential-acquisition` protocol — the `navigator.credentials.get` dispatcher + mediation model as the normalized contract, with passkey/WebAuthn, federated/FedCM, digital-credential, and password as swappable providers behind a `CustomCredentialProvider` seam (mirrors webvalidation→Validation, webguards→Guard). One protocol, `credentials:[passkey|federated|digital|password]` request dimension (Fork 4); identity feeds Guard's presence-gate rather than minting its own (Fork 3). Deferred behind data/i18n/theme per triage rank #5 — ceremonies need real server counterparts to demo. Blocked on the thin intent (#482), which prototypes the seam this formalizes. Needs sizing + fork-readiness first.
