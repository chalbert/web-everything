---
type: idea
workItem: story
size: 3
parent: "005"
status: open
dateOpened: "2026-06-10"
tags: []
---

# Validation capability-manifest schema + semver scheme (ratify OP-18/19/20)

The foundation slice of the validation spec-versioning meta-layer: define the capability-manifest schema {specVersion, conformanceLevel, features[], concerns{}} and the semver scheme over the validation vocabulary, ratifying OP-18 (Core/mandatory features), OP-19 (manifest exposure — lean static export) and OP-20 (withGateValidation vs native checkValidity) as it lands. Every downstream slice (build-time check, runtime guard, report format, fixtures) consumes this artifact, so it gates them all.
