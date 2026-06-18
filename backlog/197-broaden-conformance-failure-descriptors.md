---
type: idea
workItem: story
size: 3
parent: "097"
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: "scripts/check-standards.mjs — `fix`-tagged failure descriptors (deprecated-status·reference, invalid-status / missing-description / missing-required-field / unresolved-ref · model) across status/description/required-field/cross-ref classes; scripts/autofix/engine.mjs — order-independent brace-span anchor for the reference fixer"
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
across the other `we:check-standards.mjs` error classes so each becomes
agent-targetable.

## Scope

- Walk the `err(...)` call sites in `we:scripts/check-standards.mjs` and add a
  `descriptor` to each fixable class: `missing-description`, `invalid-status`
  (non-synonym), `missing-sourcePath`, `missing-required-field` (protocol /
  intent / backlog), `unresolved-ref` (ownedByProject / realizesIntent /
  relatedProject / parent), etc.
- For each, decide **mechanically fixable** (a reference fixer in
  `we:scripts/autofix/engine.mjs`) vs **content-generation** (deferred to the model
  fixer, [#196](/backlog/196-ai-model-fixer-provider/)). Record the call in the
  descriptor's `kind`.

## Hardening carried from #095

- The reference `deprecated-status` fixer edits surgically by anchoring on
  `"id": "<id>"` and rewriting the **first** `"<field>": "<from>"` after it —
  which assumes the field follows the id in file order (true for the current
  specs). Make the anchor order-independent (or AST/JSON-pointer based) so a fixer
  can't grab the wrong row if a spec reorders fields.

## Progress

- **Status:** resolved (2026-06-09).
- **Done:**
  - **Descriptors broadened** in `we:scripts/check-standards.mjs`. Every fixable error class now emits a
    structured descriptor carrying a `kind` plus a `fix` routing call: `reference` (mechanically
    fixable) vs `model` (content-generation, deferred to #196). Three small builders
    (`dMissingField` / `dUnresolvedRef` / `dMissingDescription`) + a `FILE` map keep the call sites
    terse. Classes now enriched:
    - `deprecated-status` → `fix:'reference'` (unchanged target; now tagged).
    - `invalid-status` (non-synonym status), `missing-description` (block/plug/research),
      `missing-required-field` (protocol/intent/capability/capability-adapter/backlog),
      `unresolved-ref` (protocol ownedByProject + realizesIntent, intent requiresCapabilities,
      capability-adapter tiers, backlog relatedProject/parent/relatedReport, block sourcePath) →
      `fix:'model'`.
  - **Hardening (carried from #095):** the reference fixer in `we:scripts/autofix/engine.mjs` no longer
    searches "forward from the id" — a new string-aware `topLevelObjectSpans()` bounds the field
    rewrite to the target row's OWN brace-span, so the edit is order-independent (field may precede
    the id) and sibling-safe (can't bleed into the next row). The id anchor is now whitespace-tolerant.
  - **Tests:** 3 new cases in `we:scripts/autofix/__tests__/engine.test.mjs` (field-before-id,
    sibling-safety with a reordered field, braces-inside-strings). 9/9 green. `check:standards` green;
    `--json` emission verified live via a throwaway broken item (descriptors emit with full shape).
- **Notes:** behavior is purely additive — `fix:'model'` descriptors have no registered deterministic
  fixer, so the engine still reports them `skipped` (correct) until #196's model fixer lands. Human
  `check:standards` output is unchanged.
