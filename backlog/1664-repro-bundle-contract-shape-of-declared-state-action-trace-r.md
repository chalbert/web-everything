---
kind: story
size: 5
parent: "1663"
status: open
locus: webeverything
dateOpened: "2026-06-23"
tags: []
---

# Repro-bundle contract — shape of declared state, action trace, rules, ownership

Define the repro-bundle CONTRACT in Web Everything — the shape of data every layer agrees on. Specify the serializable schema for a bundle's four parts: the declared-state snapshot (which providers/contexts held what value), the ordered action trace (the semantic intents/transitions that produced it), the declared-rules reference (the page's conformance/visibility/validation rules in force), and ownership (who owns each node, so the bundle self-routes). Ships as a WE we:contract.ts plus conformance vectors and a JSON schema, with serialization and versioning. Foundational and agent-ready now — no dependency on the capture mechanism; it only fixes the shape the FUI viewer and plateau tool consume.
