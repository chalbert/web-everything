---
type: idea
workItem: story
size: 3
status: resolved
blockedBy: ["304"]
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
tags: [validation, intents, protocol, adapters, rfc9457, field-errors]
relatedProject: webvalidation
relatedReport: reports/2026-06-06-validation-generation-protocol-adapters.md
crossRef: { url: /projects/webvalidation/, label: Web Validation project }
---

# Validation field-error shape intent (pointer + rule + message)

RFC 9457 (application/problem+json) standardizes the error *envelope* but leaves the field-level error shape undefined — a gap the Web Validation vocabulary can claim. Define a candidate intent for a per-field error: a JSON-Pointer to the offending field, the rule/intent that failed, and a human message. Parked out of #085 v1, whose Mode-2 service emits RFC 9457 envelopes with an ad-hoc field shape. Standardizing it lets every adapter emit and every consumer parse field errors uniformly. Slots into the #304 intent enumeration / `CustomValidationAdapterRegistry` as an additive intent.

## Progress (2026-06-13) — resolved

New [we:validation-generation/fieldError.ts](../validation-generation/fieldError.ts) — the field-error shape, dependency-free TS model beside the #304 generation vocabulary, re-exported from the `webvalidation` plug ([we:index.ts](../plugs/webvalidation/index.ts)):

- **`ValidationFieldError`** `{ pointer, rule, message }` — `pointer` is an RFC 6901 JSON-Pointer to the offending field (validated by `isJsonPointer`, with `~0`/`~1` escapes), `rule` is a `ValidationIntentId` linking the failure back to the constraint vocabulary (arbitrary rules use `validation.intent.custom`), `message` is human-readable. The **output** counterpart of a `ValidationConstraint` input.
- **`ValidationProblemDetails`** — the RFC 9457 envelope (`type`/`title`/`status`/`detail`/`instance`, all optional per spec) + the `errors` field-level extension RFC 9457 leaves undefined. Plus `PROBLEM_JSON_MEDIA_TYPE`, a `fieldError()` constructor, `isValidationFieldError`/`assertValidationFieldError` guards + `ValidationFieldErrorContractError`.

**Classification:** a **data contract, not a constraint intent** — deliberately *not* added to `VALIDATION_INTENTS` (that enumerates what can be *constrained*; this is the *failure* shape). It references a `ValidationIntentId` but isn't one — the same code-model-not-`we:intents.json` reasoning the generation plane already follows (#266 precedent). No concrete consumer repoint exists today (the Mode-2 generation service emits *code*, not field-validation results — the "ad-hoc field shape" it parked was hypothetical); the shape now stands ready for the runtime emit path / an app's API boundary to adopt. 8 new unit tests; gate green; no new tsc errors.
