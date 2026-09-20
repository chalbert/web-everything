---
bornAs: x7reezo
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/operations/dispatch-lane-io.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Dispatch clones and background workers run in untrusted checkouts, so committed permissions are ignored

FOUND 2026-09-20. The session-start report lists 7 of 74 checkouts as not trusted, so the committed permission allow-list is ignored there (the worker log said: ignoring 20 permissions.allow entries, this workspace has not been trusted) and a background agent stalls on a prompt with nobody to answer. Throwaway clones made for dispatch and fixes are new checkouts, so each starts untrusted. The build must not edit trust silently: the operator applies the bootstrap install. DESIGN TO SETTLE: dispatch only from a trusted maintained clone, or a bootstrap step that trusts a named clone on the operator approval, and how a stalled-on-trust worker is detected. ACCEPTANCE: dispatch from an untrusted checkout warns before spawning; the maintained dispatch clone is trusted after one operator action.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
