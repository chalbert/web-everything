---
kind: task
parent: "085"
status: resolved
blockedBy: ["304"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: validation-generation/adapters/zod.ts
tags: []
---

# Validation-generation adapter — Zod schema emitter

Slice #085-C: a CustomValidationAdapter that emits a Zod schema from the validation intents (TypeScript runtime-validation target). Declares which intents it complies with. Blocked on #304; independent of the other adapters.

## Progress

**Resolved 2026-06-11.** Shipped `we:validation-generation/adapters/zod.ts` — `zodAdapter`
(`key: 'zod'`, `language: 'typescript'`) emitting a `z.…` schema expression. Zod carries the **whole**
vocabulary, so all 13 intents are declared: string base with `.min`/`.max`/`.regex`/`.email`/`.url`/
`.uuid`/`.datetime`; numeric base (`type`) with `.min`/`.max`/`.multipleOf`; `enum` → `z.enum([…])`;
collection sizing → `z.array(z.unknown()).min/.max`; the `custom` escape hatch → `.refine(<predicate>,
message)`; and `.optional()` for any field without a `required` intent. Emits source text (a schema
declaration), not a live schema — generation is the job, running it is the consumer's. Added to the
shipped-adapters barrel + plug re-export.

**Gate:** `we:adapters/zod.test.ts` 6 green; `tsc` clean; `check:standards` 0 errors (run at batch close).
