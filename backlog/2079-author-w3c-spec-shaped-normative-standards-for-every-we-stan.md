---
kind: epic
status: open
dateOpened: "2026-07-02"
tags: []
---

# Author W3C-spec-shaped normative standards for every WE standard

Umbrella for bringing every in-scope WE standard into the full W3C/WHATWG-spec register — MUST/MUST-NOT/SHOULD
conformance language, an explicit conformance-class + error model (what an implementor builds **and** what error
to throw on each invalid input), IDL/interface definitions, and a processing model. Sliced 2026-07-02 into the
gating decision [#2096](/backlog/2096-spec-register-home-skeleton-house-style-and-scope-policy-for/) (spec home +
skeleton house style + scope policy) and the pilot
[#2097](/backlog/2097-pilot-normative-spec-customnoderegistry-2074-in-the-ratified/) (CustomNodeRegistry in the
ratified skeleton); the per-category authoring waves are carved after those land.

"Every current standard" enumerates to **279 registry entries** — 81 blocks / 98 intents / 59 plugs / 41
protocols (`we:src/_data/{blocks,intents,plugs,protocols}/`) — with zero RFC-2119 language in any of them today
and write-up depth ranging from real prose (blocks) to 10-line stubs (plugs). Which of those owe a spec at which
maturity tier is #2096's scope-policy fork, so the authoring waves (per-category sub-epics) are deliberately not
scaffolded yet: re-run `/slice 2079` once #2096 resolves and #2097 calibrates effort-per-spec
(we:reports/2026-07-02-backlog-split-analysis.md).

The [#2074 conformance table](/backlog/2074-customnoderegistry-node-kind-extensibility-standard/) — the
enumerated well-formed combinations plus the typed `define()` errors for the rejected ones — is the **shape
template**: normative "these cases are valid; these throw this error" prose is exactly what every standard needs.
For later — a big, deliberate documentation program, not urgent build work.
