---
kind: story
size: 2
parent: "1250"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:plugs/webvalidation/AsyncValidatorField.ts"
tags: []
---

# Reconcile fui:plugs/webvalidation/AsyncValidatorField.ts up to WE (#1111 events)

Hand-merge fui:plugs/webvalidation/AsyncValidatorField.ts up to we:plugs/webvalidation/AsyncValidatorField.ts (+20: #1111 #runVersion run counter :68-69, validate-start/end emission :122-135, #emitControl() :137-140), preserving FUI's #ensureRunner().validate(...). Contract-anchored audit first (#1270 principle 1). Independent — no commitment-policy dependency.

## Progress (2026-06-20, batch-2026-06-20-1344-1342)

**Contract-anchored audit (#1270 principle 1):** diffed `fui:plugs/webvalidation/AsyncValidatorField.ts`
against the WE source-of-truth `we:plugs/webvalidation/AsyncValidatorField.ts` — FUI was a strict subset,
the only delta being the three #1111 additions; both sides already share `#ensureRunner().validate(...)`,
so nothing FUI-unique was at risk. Applied exactly the three hunks:

- `#runVersion = 0` monotonic run counter.
- `validate()` now wraps `#ensureRunner().validate(...)` with `validate-start` (before) + `validate-end`
  (`.then`) emission, where a `null` (superseded/aborted) generation surfaces as `result: 'stale'`.
- `#emitControl(name, detail)` dispatching a bubbling `validation.control.${name}` CustomEvent.

`diff` is now **byte-identical** to the WE file. `npx vitest run plugs/webvalidation` → **50 passed**.
