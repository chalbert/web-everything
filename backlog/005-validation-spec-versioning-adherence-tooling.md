---
kind: epic
status: resolved
dateOpened: '2026-05-30'
dateResolved: "2026-06-11"
graduatedTo: none
tags:
  - validation
  - spec-versioning
  - capability-manifest
  - conformance
  - tooling
relatedReport: reports/2026-05-30-validation-spec-versioning-adherence.md
relatedProject: webvalidation
---

# Validation spec-versioning + capability-adherence meta-layer

Umbrella for the "declare + verify capabilities" meta-layer so any validation implementation can declare `{specVersion, conformanceLevel, features[], concerns{}}` and have out-of-capability usage detected rather than silently no-op. Sliced 2026-06-10 into a foundation + four independent consumers: **#266** capability-manifest schema + semver scheme (ratifies OP-18/19/20) — gates the rest; then **#267** build-time `check:validation-adherence`, **#268** runtime dev-mode guard, **#269** adherence report format, and **#270** partial-impl conformance fixtures (each `blockedBy` #266, otherwise independent). Generalizes to any WE standard with optional features; #085/#191 depend on it (the manifest they need is #266).
