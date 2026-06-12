---
type: idea
workItem: story
size: 2
parent: "085"
status: resolved
blockedBy: ["304"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: validation-generation/adapters/nativeHtml.ts
tags: []
---

# Validation-generation adapter — native-HTML constraints

Slice #085-B: a CustomValidationAdapter that materializes the validation intents as native HTML Constraint Validation attributes (required/min/max/pattern/…). The reference adapter proving the registry contract. Blocked on the foundation slice #304 (intents + registry); independent of the other adapters.

## Progress

**Resolved 2026-06-11.** Shipped `validation-generation/adapters/nativeHtml.ts` — `nativeHtmlAdapter`
(`key: 'native-html'`, `language: 'html'`) mapping the neutral intents to native constraint attributes:
`required`, `minlength`/`maxlength`, `pattern`, `min`/`max`/`step`, and `type`/`format` → input `type`
(`email`/`url`/`number`/`date`/…). Honestly scoped: collection sizing (`min-items`/`max-items`), `enum`
(structural — `<select>`/radio, not an input attribute), and `custom` (needs `setCustomValidity`) are
**not** in `intents[]`, so `emit()` reports them via `unsupported[]` — never a silent drop. Attribute
values are HTML-escaped.

Also added `validation-generation/adapters/index.ts` — the shipped-adapters barrel +
`createDefaultValidationAdapterRegistry()` (native-first: native-HTML is the default), which the Zod
(#306) / Pydantic (#307) / JSON-Schema (#308) slices extend as they land. Re-exported from the
`webvalidation` plug.

**Gate:** `adapters/nativeHtml.test.ts` 5 green; `tsc` clean; `check:standards` 0 errors (run at batch close).
