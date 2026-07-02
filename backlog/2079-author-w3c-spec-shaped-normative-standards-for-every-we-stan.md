---
kind: epic
size: 13
status: open
dateOpened: "2026-07-02"
tags: []
---

# Author W3C-spec-shaped normative standards for every WE standard

WE standards today live as descriptive prose + JSON descriptors. This epic writes each one up in the full
W3C/WHATWG-spec register: MUST/MUST-NOT/SHOULD conformance language, an explicit conformance-class + error model
(what an implementor builds **and** what error to throw on each invalid input), IDL/interface definitions, and a
processing model. Scope is every current standard, one spec-shaped write-up each.

The #2074 CustomNodeRegistry conformance table — the enumerated well-formed combinations plus the typed
`define()` errors for the rejected ones — is the **shape template**: normative "these cases are valid; these throw
this error" prose is exactly what every standard needs. First slice is the common **spec skeleton + house style**
(section order, the RFC-2119 boilerplate, the error-model convention); after that, one slice per standard. For
later — a big, deliberate documentation program, not urgent build work.
