---
kind: story
size: 5
status: resolved
blockedBy: ["288"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: "protocol:guard"
tags: []
---

# Implement the CustomGuardRegistry plug and native-first default guard provider

Build the shared runtime seam the Guard protocol (#288) specifies but does not implement: the CustomGuardRegistry global plug (window.customGuards) hosting the CustomGuardProvider contract — evaluate(region, event, context): Promise<GuardDecision> plus the optional subscribe() revocation signal — and the native-first default provider (cancelable browser primitives for exit: beforeunload, Navigation API intercept, dialog cancel; permissive for access). Both guard member intents (exit guard #273, access control #178) are UX-only and delegate to this provider, so the registry+provider is shared infrastructure neither member owns. Mirrors the CustomPositioningRegistry plug, but async/trust-crossing per the #288 rulings.
