---
type: issue
workItem: story
size: 5
parent: "081"
status: open
dateOpened: "2026-06-13"
tags: []
---

# MaaS polyglot SoT — neutral contract + serve-path IR as the authority (project to OpenAPI)

Ratified in #463 (fork b): elevate the language-neutral contract to the source of truth for the polyglot MaaS origin. Author a serve-path IR/spec over protocols.json#maas-versioning (content-hash identity, SRI, immutable-artifact + short-TTL-pointer cache semantics) and project it to OpenAPI for the HTTP-GET shape (verbs, Cache-Control, ETag/SRI). The #461 JS Fetch origin (fetchHandler.ts) becomes the reference implementation, NOT the definition — when the contract and #461 disagree, the contract wins and #461 is fixed. This neutral authority is what every per-language target and the generation adapter derive from; no language (including JS) is privileged.
