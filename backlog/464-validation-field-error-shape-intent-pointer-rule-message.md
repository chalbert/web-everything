---
type: idea
workItem: story
size: 3
status: open
blockedBy: ["304"]
dateOpened: "2026-06-13"
tags: [validation, intents, protocol, adapters, rfc9457, field-errors]
relatedProject: webvalidation
relatedReport: reports/2026-06-06-validation-generation-protocol-adapters.md
crossRef: { url: /projects/webvalidation/, label: Web Validation project }
---

# Validation field-error shape intent (pointer + rule + message)

RFC 9457 (application/problem+json) standardizes the error *envelope* but leaves the field-level error shape undefined — a gap the Web Validation vocabulary can claim. Define a candidate intent for a per-field error: a JSON-Pointer to the offending field, the rule/intent that failed, and a human message. Parked out of #085 v1, whose Mode-2 service emits RFC 9457 envelopes with an ad-hoc field shape. Standardizing it lets every adapter emit and every consumer parse field errors uniformly. Slots into the #304 intent enumeration / `CustomValidationAdapterRegistry` as an additive intent.
