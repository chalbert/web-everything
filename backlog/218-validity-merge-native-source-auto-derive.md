---
type: issue
workItem: story
size: 5
status: open
dateOpened: '2026-06-08'
blockedBy: ["215"]
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
