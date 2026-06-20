---
kind: story
locus: plateau-app
size: 5
status: resolved
blockedBy: ["328"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: plateau-app/src/technical-configurator/nl-schema.ts (buildRequirementsSchema + isValidRequirements + makeConstrainedNLProvider)
tags: [technical-configurator, natural-language, schema, constrained-decoding, ai-agnostic, plateau]
---

# Per-domain schema generator from the configurator seed + constrained decoding

Derive a per-domain JSON-schema (axis-id keys, value-id enums) from the active configurator domain's seed and run the NL provider under native structured-outputs / constrained decoding so the model cannot emit off-vocabulary keys or values. Because the schema is machine-derived from the seed, new domains auto-track without hand-maintenance. Ratified in #096 (Fork 3): structural reliability over statistical — constrained decoding makes the registry the hard boundary the output is bound to. Blocked on the NL provider seam (#328) it constrains.

## Progress

Resolved 2026-06-14 (batch). Built the per-domain schema generator in plateau-app
`plateau:src/technical-configurator/nl-schema.ts`:
- `buildRequirementsSchema(domain)` — derives a JSON-Schema (Draft 2020-12) from the seed: axis ids → object keys, value ids → `enum`-locked `string[]` items, `additionalProperties: false`. New domains auto-track (zero hand-maintenance). This is the artifact a native structured-outputs API binds the model to.
- `isValidRequirements(raw, domain)` — strict structural check (the hard boundary); complements the pre-existing lossy `normalizeRequirements`.
- `makeConstrainedNLProvider({ id, label, complete })` — factory realizing "run the NL provider under constrained decoding": derives the schema, hands it to the BYO model call, and defends in depth via `normalizeRequirements`. Keeps every BYO provider a thin adapter.

Per #096 (Fork 3): structural reliability over statistical — the capability registry is now the hard boundary the output is bound to. The actual BYO-AI-key model integration is tier-1 self-run, out of scope (the seam is ready for it). 5 new unit tests; 66 plateau-app tests green, type-clean.
