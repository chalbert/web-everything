---
type: idea
locus: frontierui
workItem: story
size: 5
status: open
blockedBy: ["100"]
dateOpened: "2026-06-16"
tags: [requirement-as-code, adapters, gherkin, ears, interop, ingestion, evergreen]
crossRef: { url: /backlog/714-requirement-meta-schema-bdd-like-format-relationship-to-webc/, label: "Meta-schema ratified by #714" }
---

# Gherkin/EARS interop adapter for requirement-as-code — emit (deterministic) + subset ingest (lossy)

Build the format-interop adapter pair around the #714-ratified requirement meta-schema (the neutral pivot): EMIT (schema → Gherkin/EARS) is a deterministic downward projection — every typed requirement renders to a valid Given/When/Then scenario, lossless on prose, subset-trivial for EARS; INGEST (Gherkin → schema) is subset-deterministic (controlled step library → semantics/protocols lookup) + AI-assisted/lossy for free-form steps via the #475-served checker, where the unmappable residue IS the 'no ground truth' lint #100 wants. Same doctrine as #552/#426 (ingest) and #463 (forward/generation). Deferred: blocked on the #100 impl existing; sequence after slice A (authoring corpus). Adapter is impl → locus frontierui per #552.
