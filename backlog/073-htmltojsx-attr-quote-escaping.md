---
type: issue
status: open
dateOpened: "2026-06-06"
tags: [jsx, adapters, htmlToJsx, transform, bug]
relatedReport: reports/2026-06-03-jsx-adapter-feature-mapping.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# htmlToJsx does not escape double-quotes inside attribute values

`blocks/renderers/jsx/htmlToJsx.ts` serializes every attribute as `name="value"` without escaping a `"` that occurs *inside* the value. So an attribute whose value contains double quotes produces malformed output: the input `broadcast-detail='{"theme": "dark"}'` transforms to `broadcast-detail="{"theme": "dark"}"` — the inner `"` closes the attribute early, breaking both the JSX and any round-trip.

Surfaced while rolling `autoToggle` onto block pages ([069-jsx-autotoggle-rollout](/backlog/069-jsx-autotoggle-rollout/)): the broadcast block's `broadcast-detail='{…}'` JSON example had to be swapped for a quote-free one to avoid emitting broken JSX. JSON-valued attributes (`broadcast-detail`, `resource-action-detail`, etc.) are common enough that this needs a real fix.

Fix: in the attribute serializer, emit JSX-correct quoting — either escape inner `"` to `&quot;`, or switch the wrapping quote to `'` when the value contains `"` (and to a `{'…'}` expression if it contains both). Add a fixture with a JSON-valued attribute to `__fixtures__/mapping-cases.tsx` and the conformance suite so it round-trips. Until then, `autoToggle` examples must avoid `"`-containing attribute values.
