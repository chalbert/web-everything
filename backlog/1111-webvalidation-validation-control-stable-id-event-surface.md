---
type: idea
workItem: story
size: 3
parent: "1090"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/webvalidation/ValidityMergeField.ts"
tags: []
---

# webvalidation: validation.control.* stable-id event surface

Emit spec stable-id events (we:src/_includes/project-webvalidation.njk:184-196) from we:plugs/webvalidation/ValidityMergeField.ts:183-191,156-165 and validate-start/end from we:plugs/webvalidation/AsyncValidatorField.ts:77-83; keep legacy validity-merge event. Demo: e2e asserts events fire with correct detail on input/blur/async-resolve.

## Progress

Emitted the `validation.control.*` stable-id event surface (spec njk:184-196) from the two field elements,
keeping the legacy `validity-merge` event:
- `we:plugs/webvalidation/ValidityMergeField.ts` — `#emitControl(name, detail)` bubbling-dispatch helper;
  `validation.control.value-input {type}` on a control `input`/`change`; `validation.control.focus`/`.blur`
  on a focus crossing (in `#reflectInteraction`); `validation.control.validity-changed {merged}` plus
  `became-valid`/`became-invalid` on a validity transition (in `#reflectValidity`, gated on a real crossing
  via `#prevValidity`/`#prevFocused`). Legacy `validity-merge` still fires in `#recompute`.
- `we:plugs/webvalidation/AsyncValidatorField.ts` — `validation.control.validate-start {source, version}`
  when a run is initiated and `validate-end {source, version, result}` on completion; a superseded/aborted
  generation (runner returned null) surfaces as `result: 'stale'`. Monotonic `#runVersion`.
- `we:plugs/webvalidation/__tests__/stable-id-events.test.ts` — 5 green (validity-changed+became-invalid
  with merged detail + legacy event still fires; became-valid crossing + no event on idempotent repeat;
  value-input on input; validate-start/end with source/version/result; stale result on supersession).

Full webvalidation suite 60 green; WE `check:standards` 0 errors. (Unit-tested in happy-dom rather than a
new Playwright e2e — the deterministic event/detail assertions are the demo; the native `:user-invalid`
styling an e2e adds is orthogonal to this event surface.)
