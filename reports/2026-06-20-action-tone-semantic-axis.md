# Action Intent — is `destructive` a prominence tier or a separate semantic-tone axis?

**Date**: 2026-06-20
**Point**: Prep research for decision #1337 (carved out of #1324). `destructive` is a nominal danger
semantic mis-seated in the ordinal `level` (prominence) enum; relocate it to its own open-numbered
semantic-tone dimension on Action Intent — the third application of the #1318/#1324 orthogonal-axis move.
**Research page**: `/research/action-tone-semantic-axis/`

---

## Question

Action Intent (`we:src/_data/intents/action.json:10-18`) declares
`level: primary | secondary | tertiary | destructive` as "the semantic weight determining visual
prominence." Three values are an *ordinal* prominence scale; `destructive` (line 16) is a *nominal*
consequence semantic. Does `destructive` belong on `level`, or is it one member of a separate axis?

## Findings

1. **No design system models danger as a prominence tier.** Every benchmark gives danger its own nominal
   axis that also carries success/warning/info: Bootstrap contextual (`success|danger|warning|info|…`),
   Material 3 color roles + `error`, Blueprint `intent={none|primary|success|warning|danger}`, Chakra
   `colorScheme`/`status`, Ant `status`/`danger`, Fluent severity, Radix `color`. Folding the single
   member `destructive` into `level` is the lone outlier and reproduces the conflation the emphasis
   research (#1318) found systems suffer.

2. **SwiftUI is the apparent counter-example and confirms the rule.** `ButtonRole={cancel, destructive}`
   folds danger into a "role," but that role drives confirmation styling + ordering, not prominence; and
   `destructive` is itself orthogonal to `cancel` (disposition) — a destructive action is usually the
   *affirmative* one. So danger is neither prominence nor disposition: a third orthogonal axis.

3. **No native vocabulary for tone.** No `<button tone>`/`severity`; `aria-invalid` is validation, not
   action-tone. Like emphasis, it's a pure DS convention — standardize the meta-axis + recommended core,
   borrow the convergent DS vocabulary. Confirmation behavior stays native (intents-are-UX-only).

4. **WE precedent unanimous.** #1318 added `variant`, #1324 added `disposition` as new orthogonal
   dimensions rather than overloading `level`. This is the third application: add `tone`, remove
   `destructive` from `level`, leaving `level` a clean ordinal scale.

## The orthogonality break (the fork-existence proof)

`level` is single-select, so seating `destructive` there makes prominence ⊥ danger *mutually exclusive*:
"primary destructive" (loud red Delete) and "tertiary destructive" (quiet red Delete link) are both
inexpressible. Same structural break as #1318 (variant) and #1324 (disposition).

## Classification

Intent layer · dimension (not protocol/trait) · expose whole axis · explicit per-action ⊕ ambient ⊕
default · most-permissive default = unspecified→neutral · open-numbered per #1318 · seam = intent→native/
theme color wiring.

## Ruling shape (prepared, awaiting ratification)

- **Fork 1 — relocate `destructive` off `level`?** → **Yes** (forced ratify; keep-on-level is broken).
- **Fork 2 — full tone axis vs danger-only flag?** → **Full open-numbered `tone`** (`neutral|danger`
  core + `success|warning|info` recommended extended).
- **Fork 3 — name?** → **`tone`** (alt `status`/`severity`; `intent` collides with WE's Intent concept).
- **Settled:** `primary|secondary|tertiary` stay a clean ordinal `level`; confirmation behavior stays
  native; migration (deprecated `level=destructive` alias → `tone=danger`) is a separately-prioritized
  build, not a merit fork.

## Blast radius (migration, build-time concern)

Shipped consumers of `level=destructive`: `we:src/_data/intents/action.json:16`,
`we:src/_includes/block-descriptions/action-button.njk:164,199`, `we:src/_data/blocks/menu.json:18`, plus block
descriptions and any theme keying `[data-action-intent="destructive"]`. Recommended migration keeps
`level=destructive` as a deprecated alias mapping to `tone=danger` during transition. This is migration
mechanics (prioritization), not a merit fork.
