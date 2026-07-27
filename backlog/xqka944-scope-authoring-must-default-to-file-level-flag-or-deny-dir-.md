---
kind: story
size: 3
parent: "2612"
scope:
  - we:scripts/check-standards.mjs
  - we:scripts/__tests__/check-standards.test.mjs
status: open
dateOpened: "2026-07-27"
tags: []
---

# Scope authoring must default to file-level — flag or deny dir-level scopes at authoring unless justified

Close the source leak behind the #2619/#2679 finer-lease principle: new backlog items keep being authored with directory-level scope: prefixes (e.g. we:scripts/readiness/, we:scripts/conveyor/, plateau-app:src/), which re-create the exact cross-item serialization that finer leases were meant to remove — a whole wave stalls behind one broad dir-scope even when the items are file-disjoint. The rescope-wave2 pass had to hand-narrow #2665/#2684/#2661 from whole dirs down to the specific files each build touches; without an authoring-time guard that manual patching recurs every wave. Build a check (a check:standards lint plus/or a backlog write-path guard) that FLAGS a scope: entry which is a bare directory prefix (ends in / with no filename) and requires it to be either narrowed to specific files or explicitly justified — an item that genuinely spans a directory or is inherently cross-cutting (an integration item touching a whole module) carries a short scope-rationale note and is allowed. Default to file-level; make dir-level the deliberate, justified exception rather than the silent default. Ground the rule in the assessed touch-set: soundness first — the guard must never push an author to UNDER-scope (a scope narrower than the real write-set breaches at build time).
