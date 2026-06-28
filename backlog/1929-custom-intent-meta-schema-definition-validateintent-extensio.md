---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: "we:scripts/check-standards-rules.mjs"
tags: []
---

# Custom-intent meta-schema definition + validateIntent extension (WE)

Realize #1913's ratified meta-schema in WE (zero-impl carve, #1282): define the custom-intent schema (owner:intent id, optional additive extends, dimensions, mustUnderstand, provenance) and extend validateIntent in check-standards to enforce the ruling — reject bare cross-author ids/values, closed-enum widening (#1337), and inherited-dimension override; allow owner:value-namespaced additions to open-numbered dimensions. Definition + validate-script only; no runtime loader.
