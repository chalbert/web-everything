---
kind: task
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
tags: []
---

# composesBehaviors block-protocol field + x-webeverything projection + trait-manifest resolution assertion

Fork 2 of #933. Add a composesBehaviors field to the block manifest (we:src/_data/blocks/<id>.json) recording the WE traits a block CONSUMES — distinct from the traits it PROVIDES. Project it into CEM x-webeverything beside the existing composesIntents/traits fields (we:scripts/gen-cem.mjs:188), and assert each entry resolves against the trait manifest we:src/_data/traits.json. Name mirrors the existing composesIntents; composesTraits is rejected (The Map collision, we:src/_data/traits.json:29). Gives the #933 gate's declaration arm a precise signal.

## Progress (batch-2026-06-18) — resolved

- **Projection.** `weExtension` in [we:scripts/gen-cem.mjs:188](../scripts/gen-cem.mjs#L188) now carries
  `composesBehaviors` into `x-webeverything` beside `composesIntents`/`traits`. Pure projection, no
  fabrication; `gen:cem` re-run is a no-op diff today (no block consumes yet).
- **Resolution assertion.** New §3b in [we:scripts/check-standards.mjs](../scripts/check-standards.mjs)
  (after the status/type enums). The resolution target is the **de-facto behavior registry = the union of
  every block's provided `traits[].name`** — `we:src/_data/traits.json` is the standard's *prose* on The
  Map (no flat name list), so the resolvable manifest is the declared `traits[]` surface across blocks
  (the only sound, non-fork reading; matches the §validateDesignSystem comment that "behavioral traits"
  = the named traits, not a JSON list). Each `composesBehaviors` entry (string or `{name}`) must resolve
  to a provided trait; an unresolved entry is the #933 "compose, don't hand-roll" red.
- **`composesTraits` rejected.** A block declaring the legacy field name errors with a fix-it pointer to
  `composesBehaviors` (The Map collision, we:src/_data/traits.json#L29).
- Gate green for this changeset (the one red is #949, a concurrent session's untracked file — out of
  scope per the batch scoped-stop rule).
