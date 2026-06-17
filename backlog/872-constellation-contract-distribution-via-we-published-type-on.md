---
type: idea
workItem: epic
status: open
dateOpened: "2026-06-17"
tags: []
---

# Constellation contract distribution via WE-published type-only contract packages

Establish @webeverything/contracts — a WE-published, type-only package (per-protocol subpath exports) that FUI depends on (FUI→WE arrow), superseding byte-replication (#694/#170) as the binding mechanism for FUI-on-WE-contracts. Ratified direction (origin #834): the literal form of 'no contract, no implementation', endorsed by #239, not excluded by #700 (which ruled only the WE→FUI arrow). Applies to ALL contracts (guard, validators, positioning, the #694 families). This umbrella holds the build stories plus risk-mitigation (version-skew drift gate, publish/CI pipeline, dev-time wiring). Byte-copies (incl. #834/#836 guard) migrate to package imports once this lands.
