---
type: idea
workItem: task
parent: "085"
status: resolved
blockedBy: ["304"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: validation-generation/adapters/pydantic.ts
tags: []
---

# Validation-generation adapter — Pydantic model emitter

Slice #085-D: a CustomValidationAdapter that emits a Pydantic model from the validation intents (Python target). Declares its intent compliance. Blocked on #304; independent of the other adapters.

## Progress

**Resolved 2026-06-11.** Shipped `validation-generation/adapters/pydantic.ts` — `pydanticAdapter`
(`key: 'pydantic'`, `language: 'python'`) emitting a Pydantic v2 field line: constraints → `Field(...)`
args (`min_length`/`max_length`/`pattern=r"…"`/`ge`/`le`/`multiple_of`), and `format`/`enum`/collection
intents → the field *type* (`EmailStr`/`HttpUrl`/`Literal[…]`/`list`); a non-`required` field becomes
`Optional[T] = None` (or `Field(None, …)`). `custom` is **not** declared — an arbitrary predicate needs a
separate `@field_validator`, so it is reported via `unsupported[]` rather than faked onto the field line.
Added to the barrel + plug re-export.

**Gate:** `adapters/pydantic.test.ts` 5 green; `tsc` clean; `check:standards` 0 errors (run at batch close).
