---
name: project_intents_open_design
description: Intents must be an open/extensible system — never a finished standard; custom non-standard intents must coexist conflict-free
metadata: 
  node_type: memory
  type: project
  originSessionId: 28e04c1a-ad5a-46b0-9674-e24ee1d03762
---

Firm directional constraint for the intent system (stated 2026-05-31):

1. **Open design — never finished.** Intents must always allow new ways to describe UX (new intents, new dimensions on existing intents, new values). We cannot treat the standard as complete/static. Additive evolution must be non-breaking.
2. **Non-standard / custom intents.** Any team must be able to author their own UX pattern as an intent and ship it **without conflicting with current OR future standardized intents.** Collision-freedom must be structural, not by luck.

**Why:** A UX vocabulary can never be exhaustively enumerated; locking it freezes innovation. Teams need to extend without forking the standard.

**Decided so far:**
- **Marker = vendor prefix `@vendor/name`** (user chose this 2026-06-01), applied **uniformly across three granularities of "custom": intent id, dimension key, and value.** A token is custom iff it starts with `@` + contains `/`; standards never use `@`. This is the structural collision-proof partition (custom-elements / CSS `@property` lesson).
- **Why not "any dash = custom" (the first instinct):** the dash rule works for intent *ids* (standards are dash-free except `type-ahead`), but FAILS at the *value* level because standard values are pervasively kebab (`top-start`, `limited-data`, `prefix-then-cycle`) — a dashed value is indistinguishable from a standard one. The `@vendor/` marker is the only thing that's collision-proof AND vendor-scoped at every level. Dash stays a readability convention only.
- **Implementation defined separately:** the intent/tool declares only *vocabulary* (the custom token/slot); the actual behavior is a provider/adapter registered by the app (Frontier UI / Plateau / consuming app), never in the WE spec. Pure design-first.
- **Dimensions open by default** (matches existing `… | string` / `[custom]` typing); a dimension may later opt into a closed enum.

**Still open:** exact injector-key mapping for a vendor-prefixed custom *intent* id (`customContexts:@acme/swipeIntent`?); whether custom values/dimensions are registered ad-hoc in the tool vs declared in a `custom-intents.json` the app owns.

**How to apply:**
- **Standardize the meta-schema, not the list.** The stable contract is the *shape* of an intent definition (the "@property of UX preferences"); the set of intents stays open. Aligns with [[feedback_native_first_default]] (native/standard defaults, custom extensions).
- `check:standards` enforces standard ids/dimension-keys/values never start with `@` (reserving the custom space).
- **Runtime registry**: a `CustomIntentRegistry` (matches repo's `Custom[Name]Registry` + provider-contract pattern, see [[feedback_catalog_auto_render]]) so teams register intent definitions at runtime, merged with the curated `intents.json`.
- **Self-describing definitions** are the *enabler*: a tool that has never seen a custom intent must render it from the definition alone → intent schema must carry friendly labels, per-value descriptions, and arity (single vs multi-select). This is why "enrich the schema" is required, not optional polish.
- **Promotion path**: custom → standard via id alias + deprecation.

Connects to the [[reference_repo_constellation]] intent-configurator prototype (plateau-app), which currently reads `intents.json` directly and must evolve to read the merged (standard + custom) registry.
