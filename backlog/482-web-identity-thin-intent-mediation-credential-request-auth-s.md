---
type: idea
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: intent:web-identity
tags: []
---

# Web Identity thin intent — mediation, credential-request & auth-state signal (UX-only)

Author the thin, UX-only Web Identity intent graduated from #012's Fork 2-A: a declarative seam for credential mediation, a credential-request surface, and an auth-state signal (signed-in/out + identity descriptor) — composing the existing Loader and Feedback intents, no provider/ceremony/protocol surface. Native anchor: the `navigator.credentials.get` mediation model + typed credential union. Consumed near-term by the live Guard presence-gate (#272) and the active loan-app permission phase (#379), anchoring their auth-state shape to the standard rather than an ad-hoc local one. The full `webidentity` project + protocol stay deferred (#483). Agent-ready: shape settled, intents.json authoring infra proven.
