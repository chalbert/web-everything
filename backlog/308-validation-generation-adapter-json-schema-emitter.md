---
type: idea
workItem: task
parent: "085"
status: resolved
blockedBy: ["304"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: validation-generation/adapters/jsonSchema.ts
tags: []
---

# Validation-generation adapter — JSON-Schema emitter

Slice #085-E: a CustomValidationAdapter that emits JSON Schema from the validation intents (language-neutral target). Declares its intent compliance. Blocked on #304; independent of the other adapters.

## Progress

**Resolved 2026-06-11.** Shipped `validation-generation/adapters/jsonSchema.ts` — `jsonSchemaAdapter`
(`key: 'json-schema'`, `language: 'json'`) emitting a JSON Schema fragment `{ properties: { <field>:
<schema> }, required: [<field>] }` (`required` placed where JSON Schema carries it — on the object).
Constraints → standard keywords: `minLength`/`maxLength`/`pattern`, `minimum`/`maximum`/`multipleOf`,
`minItems`/`maxItems`, `format` (`url`→`uri`, plus `date` for a date `type`), `enum`, `type`. `custom`
is **not** declared (no standard keyword for an arbitrary predicate) — reported via `unsupported[]`.
Added to the barrel + plug re-export — this completes the four-adapter cluster, so
`createDefaultValidationAdapterRegistry()` now ships native-HTML (default) + Zod + Pydantic + JSON-Schema.

**Gate:** `adapters/jsonSchema.test.ts` 5 green; `tsc` clean; `check:standards` 0 errors (run at batch close).
