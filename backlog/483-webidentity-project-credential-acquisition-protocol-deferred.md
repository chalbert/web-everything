---
type: idea
workItem: epic
status: open
blockedBy: []
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
tags: []
---

# webidentity project + credential-acquisition protocol (deferred)

Deferred build graduated from #012's Fork 2-A: the full `webidentity` project owning one credential protocol — the `navigator.credentials` dispatcher as the normalized contract, with passkey/WebAuthn, FedCM, digital-credential, and password as swappable providers behind a `CustomCredentialProvider` seam (mirrors webvalidation→Validation, webguards→Guard); one protocol with a `credentials:[…]` request dimension; identity feeds Guard's gate. The thin intent (#482) shipped; build-design **#496 is ratified** — registry-resolved provider + mock conformance provider in slice 1; three members (`credential-request`/`credential-enrollment`/`session-mediation`); Configurator omitted → non-blocking #499. **#496 renamed the protocol `credential-acquisition` → `credential-management`**; this epic inherits that id. Fork-clean and unblocked — `/slice` can now decompose it.
