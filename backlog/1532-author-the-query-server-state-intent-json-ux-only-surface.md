---
kind: story
size: 2
parent: "1460"
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "we:src/_data/intents/query.json"
tags: []
---

# Author the query (server-state) intent JSON — UX-only surface

Author we:src/_data/intents/query.json: the UX-only query (server-state) intent surface — fetchPolicy (cache-first / network-only / cache-and-network) + staleness display composing the loader intent. Mirrors the 48-line we:src/_data/intents/mutation.json shape; transcribable from the #1419 ruling. Self-registers via the we:src/_data/intents.js glob loader (no registry index, no -descriptions njk). Foundational slice A of #1460; independent of the provider contract (B).
