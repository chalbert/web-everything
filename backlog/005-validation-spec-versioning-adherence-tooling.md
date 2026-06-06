---
type: idea
status: open
dateOpened: '2026-05-30'
tags:
  - validation
  - spec-versioning
  - capability-manifest
  - conformance
  - tooling
relatedReport: reports/2026-05-30-validation-spec-versioning-adherence.md
relatedProject: webvalidation
---

# Build validation spec-versioning + capability-adherence meta-layer

A brief proposes a "declare + verify capabilities" meta-layer so any validation implementation can declare {specVersion, conformanceLevel, features[], concerns{}} and have out-of-capability usage detected rather than silently no-op. Unbuilt deliverables: a semver scheme over the vocabulary, a capability manifest schema (resolving OP-19 — static export vs element property vs injector provider; leaning static export), a build-time check:validation-adherence tool, a runtime dev-mode guard, an adherence report format, and partial-impl test fixtures. Also resolves OP-18 (Core/mandatory features) and OP-20 (withGateValidation vs native checkValidity). Meant to generalize to any WE standard with optional features.
