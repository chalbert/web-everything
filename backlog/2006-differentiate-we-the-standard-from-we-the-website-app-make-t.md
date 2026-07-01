---
kind: decision
status: open
dateOpened: "2026-07-01"
tags: []
---

# Differentiate WE-the-standard from WE-the-website-app (make the repo boundary legible)

Recurring confusion (surfaced ratifying #1948): the WE repo conflates two things under one name — WE-the-standard (zero-impl authority: definitions, meta-schemas, validate scripts, the intent catalog, pure resolver logic) and WE-the-website, a full 11ty app that merely renders WE content and carries its own build impl (e.g. we:scripts/lib/intents-loader.cjs, we:src/_data/intents.js glob-and-consume the catalog to render docs). Today those sit indistinguishable in the same repo, so every placement call inherits an ambiguity (#1913 'FUI/product' and #1948's fork were symptoms). Decide whether/how to structurally separate the WE-website-app surface from the WE-standard surface so the boundary is legible — precedent already exists (the identity-semantic-look-composable statute treats 'the WE website' as a product frontend, not WE/FUI). Prep needed before ratifying.
