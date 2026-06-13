---
type: idea
locus: plateau-app
workItem: story
size: 5
status: open
blockedBy: ["328"]
dateOpened: "2026-06-11"
tags: [technical-configurator, natural-language, schema, constrained-decoding, ai-agnostic, plateau]
---

# Per-domain schema generator from the configurator seed + constrained decoding

Derive a per-domain JSON-schema (axis-id keys, value-id enums) from the active configurator domain's seed and run the NL provider under native structured-outputs / constrained decoding so the model cannot emit off-vocabulary keys or values. Because the schema is machine-derived from the seed, new domains auto-track without hand-maintenance. Ratified in #096 (Fork 3): structural reliability over statistical — constrained decoding makes the registry the hard boundary the output is bound to. Blocked on the NL provider seam (#328) it constrains.
