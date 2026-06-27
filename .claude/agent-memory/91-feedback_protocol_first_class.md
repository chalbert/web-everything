---
name: Protocol is a first-class entity
description: In Web Everything, Protocol is a top-level entity alongside Intent/Block/Plug/Adapter — never a block.type. Owned by a Web Project, surfaced via /protocols/ tile index.
type: feedback
originSessionId: 401816cf-8ea8-48b6-b194-6bfa15bb0a3b
---
Protocols are first-class standards entities, not block types. The block.type vocabulary is Store · Parser · Behavior · Directive · Component · Module — **Protocol is not in that list**.

Each protocol:
- has an entry in `src/_data/protocols.json` with `id`, `name`, `summary`, `status`, `ownedByProject`, `anchor`, optional `realizesIntent`
- has its normative body inside the owning project partial `src/_includes/project-{ownedByProject}.njk`, inside a `<section id="protocol-{anchor}">`
- is surfaced on the `/protocols/` tile index (filterable by Project + Status), which deep-links into the project page anchor

**Why:** During the prior standard-authoring pass, Copilot codified `Protocol` as a `block.type` in design-first.md without the user noticing. The user's design intent is "blocks ship code; protocols ship contracts" — conformance references belong with the Web Project that owns the domain, not in the block catalog. Two blocks (Validation, Error Recovery) had to be migrated; four other protocol-shaped contracts were buried inside project pages with no discovery surface.

**How to apply:** When authoring a new conformance contract: (1) identify or create the owning Web Project, (2) add the contract as a `<section id="protocol-{slug}">` inside `project-{id}.njk`, (3) register it in `protocols.json`. Do NOT add it to `blocks.json` with `type: "Protocol"` — `check-standards.mjs` rejects that type, and a new validator requires the protocol's anchor to actually exist in the project partial. Validation lives in its own `webvalidation` project (distinct from `webreliability` per the "input invalidity ≠ mechanism failure" boundary).
