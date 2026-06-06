---
type: decision
status: open
dateOpened: '2026-05-30'
tags:
  - validation
  - conformance
  - validity-model
  - interop
  - design-decision
relatedReport: reports/2026-05-30-form-validation-standard-assessment.md
relatedProject: webvalidation
---

# Settle validation validity-model and conformance-tier open points

The form-validation interop design closed the meta-intent factoring but left two core decisions open. OP-1: should control validity be a source-reduction (merge native + schema + custom via a MergedValidity reduction — more robust) or a flat invalid flag (simpler)? Draft leans source-reduction, awaiting confirmation. OP-11: confirm the proposed L0/L1/L2 conformance tier model (Intent-aware → State & event → Shape & concern) as normative. Both are flagged "await confirmation" and gate any real engine/adapter build.
