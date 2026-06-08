---
type: idea
workItem: story
size: 3
parent: "097"
status: open
dateOpened: "2026-06-08"
tags: [conformance, auto-fix, agent, check-standards, machine-readable, descriptors, provider-registry, webcases]
relatedProject: webcases
crossRef: { url: /backlog/095-conformance-auto-fix-agent/, label: "Conformance auto-fix agent (#095)" }
---

# Broaden machine-readable failure descriptors across check:standards classes

`check:standards --json` (added in [#095](/backlog/095-conformance-auto-fix-agent/))
emits structured failure descriptors, but the MVP enriches **only the
`deprecated-status` class** — every other error is still `{ message }` text. The
auto-fix agent can only target a failure that carries a descriptor, so the set of
fixable classes is gated by this enrichment. This item widens descriptor coverage
across the other `check-standards.mjs` error classes so each becomes
agent-targetable.

## Scope

- Walk the `err(...)` call sites in `scripts/check-standards.mjs` and add a
  `descriptor` to each fixable class: `missing-description`, `invalid-status`
  (non-synonym), `missing-sourcePath`, `missing-required-field` (protocol /
  intent / backlog), `unresolved-ref` (ownedByProject / realizesIntent /
  relatedProject / parent), etc.
- For each, decide **mechanically fixable** (a reference fixer in
  `scripts/autofix/engine.mjs`) vs **content-generation** (deferred to the model
  fixer, [#196](/backlog/196-ai-model-fixer-provider/)). Record the call in the
  descriptor's `kind`.

## Hardening carried from #095

- The reference `deprecated-status` fixer edits surgically by anchoring on
  `"id": "<id>"` and rewriting the **first** `"<field>": "<from>"` after it —
  which assumes the field follows the id in file order (true for the current
  specs). Make the anchor order-independent (or AST/JSON-pointer based) so a fixer
  can't grab the wrong row if a spec reorders fields.
