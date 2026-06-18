---
type: issue
workItem: story
size: 5
status: resolved
dateOpened: '2026-06-08'
blockedBy: ["215"]
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
graduatedTo: plugs/webvalidation/ValidityMergeField.ts
tags:
  - validation
  - validity-model
  - runtime
  - element-internals
  - native-first
relatedReport: reports/2026-05-30-form-validation-standard-assessment.md
relatedProject: webvalidation
parent: "215"
---

# `<validity-merge-field>` — auto-derive the `native` source from the inner control's `ValidityState`

#215 shipped the runtime `customValidityMerge` plug and the `<validity-merge-field>`
form-associated control, but every source — including `native` — is currently fed by
hand via `setSource('native', …)`. The platform's own constraint validation on the
inner form control (`required`, `type=email`, `pattern`, `min`/`max`, …) is the
canonical producer of the `native` source and should feed it **automatically**, so a
dev only wires the *non-native* sources (schema/async/manual).

**Build:**
- On `connectedCallback` (and on the inner control's `input`/`change`/`invalid`
  events), read the inner control's
  [`ValidityState`](https://developer.mozilla.org/en-US/docs/Web/API/ValidityState)
  and map it to a `SourceResult` for the `native` source: `valid` when
  `validity.valid`, else `invalid` with `validationMessage` as the message, `idle`
  when the control is absent / not yet edited.
- Feed that into the orchestrator on every change so the native constraint participates
  in the merge with zero hand-authoring — the native-first default in practice.
- Respect the existing precedence (`native` leads in source-reduction); a manually-set
  `native` source via `setSource` still overrides the auto-derived one (explicit wins).
- Demo: extend the Validity Merge Playground so the inner `<input>` carries a real
  `type=email required` constraint and the `native` row reflects it live as you type,
  with the other three sources still toggled manually.

Depends on #215 (the control + plug). The `async` source's auto-wiring to an in-flight
check is the separate `CustomValidatorResolution` plane (#214). See #004 OP-1.

## Progress

- **Status:** resolved (2026-06-10)
- **Built in `we:plugs/webvalidation/ValidityMergeField.ts`:** the `native` source is now auto-derived
  from the inner control's `ValidityState`. On `connectedCallback` and on the control's
  `input`/`change`/`invalid` events the control's validity is mapped to the `native` source — `valid`
  when `validity.valid`, `invalid` (carrying `validationMessage`) otherwise, `idle` while the control
  is absent or untouched (an interaction gate so a `required` field doesn't fail before the user types).
  Listeners are (re)synced on connect and detached on disconnect.
- **Explicit-wins precedence:** `setSource('native', …)` sets a manual flag that suppresses the
  auto-derive; `clearSource('native')` releases it and immediately re-derives from the control. The
  auto path feeds the orchestrator directly so it never trips the manual flag. Native still leads in
  source-reduction precedence (unchanged from #215).
- **Tests:** 5 new cases in `we:ValidityMergeField.test.ts` (idle-until-touched → invalid; derives valid;
  participates with manual sources; explicit native wins; `clearSource` resumes auto-derive). All 13
  ValidityMergeField tests green; full unit suite green (1978 passed).
- **Demo:** Validity Merge Playground now uses a real `type=email required` inner control; the `native`
  row is a live auto-derived badge (the other three sources stay manually toggled), plus a new
  conformance check asserting the #218 derivation. (`demos/validity-merge-demo.{ts,css}`.)

### Known limitation / follow-on

The interaction listeners wire to the inner control found at `connectedCallback`. A control that is
**added/swapped after connect** (dynamic light DOM) won't auto-rewire — acceptable for the reference
impl (the control is expected in markup at connect) but a `MutationObserver`-based re-sync would close
it. Captured here rather than spun out (small, not blocking anything).
