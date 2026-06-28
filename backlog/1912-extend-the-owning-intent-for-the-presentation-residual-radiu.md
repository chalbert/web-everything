---
kind: story
size: 3
status: open
dateOpened: "2026-06-28"
tags: []
---

# Extend the owning intent for the presentation residual — radius/border dimensions

Per #1884's ruling, the genuine residual not yet homed by any intent — corner radius (`rounded`) and border presence/weight (`bordered`) — is covered by EXTENDING the owning intent, not by a parallel vocabulary. Add a `radius` / `border` dimension to `surface` (or the appropriate owning intent) where these genuinely carry a semantic what/why. Apply the pure-decoration-edge test from #1884: values whose semantic story is thin stay raw theme tokens; only those that earn an intent get a dimension. Standardize the meta-schema, not the list (intents-open-design).
