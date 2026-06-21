# Split analysis — #1442 block-model conversion (register remaining blocks as custom elements)

**Date:** 2026-06-21 · **Candidate:** #1442 (`kind: epic`, `size: 13`, no children — unsliced epic) ·
**Locus:** frontierui · **Blocked by:** #1381 (resolved) · **Verdict:** **partial split** — carve a small
unambiguous first wave (3 slices), keep the long mechanical tail as an incremental burndown (not
pre-scaffolded), de-bury two genuine classification forks.

## Work investigated (real tree, not the body's framing)

The body says "~7 of 75 blocks register a tag … convert the rest." Reading the FUI tree
(`/Users/nicolasgilbert/workspace/frontierui/blocks/`, 48 block dirs) shows the blocks fall into **four
structural families**, not one flat "unconverted" set:

1. **Already custom elements (converted).** Persistent light-DOM **B**: `fui:blocks/wizard/WizardElement.ts:25`,
   `fui:blocks/signature-pad/SignaturePadElement.ts:35`. Shadow **C**: `fui:blocks/story-canvas/StoryCanvasElement.ts:49`,
   `fui:blocks/code-view/CodeViewElement.ts`. Plus tag-registering register-helpers: `we-data-grid`,
   `we-data-table`, `we-pagination`, `we-autocomplete`, `we-background-task-surface`, `we-route-outlet/view`,
   `we-transient-component` (auto-heading). → **no conversion needed.**
2. **Factory blocks** (`create*`/`mount*` → global CSS classes on a native element, zero custom element):
   `fui:blocks/button/Button.ts:12-16` (the #1381 target, still a factory), badge (`createBadge`), card
   (`createCard`), checkbox/radio (`createCheckbox`/`createCheckboxGroup`/`createRadioGroup`), number-input,
   text-field, disclosure-nav. → **the genuine conversion candidates.**
3. **Behavior blocks** (`registerX()` → `CustomAttribute` behaviors on native elements, no element of their
   own): `fui:blocks/stepper/StepperBehavior.ts:111`, `fui:blocks/deck/DeckBehavior.ts:182`,
   `fui:blocks/tabs/TabGroupBehavior.ts`. → #1381 **explicitly endorses** behaviors riding `CustomAttribute`s
   on native elements as the end-state, so "convert to a custom *element*" may be a **no-op or wrong** for
   these — an open classification, not a mechanical conversion.
4. **Plumbing** (guard, view, for-each, attributes, traits, lifecycle, resource-loader, …) — not visual
   blocks; out of scope or already registered.

**Key finding — no foundational DAG roots are missing.** All three mechanism reference patterns already
ship in the tree: **A** = `fui:blocks/transient/TransientElement.ts:28` (used by auto-heading), **B** =
`WizardElement`/`SignaturePadElement`, **C** = `StoryCanvasElement` (`attachShadow`). So conversions are
**flat applications of existing patterns** with **no inter-slice ordering** — there is nothing to sequence,
which removes the usual reason to pre-scaffold a DAG.

## Could split — first batchable wave (family 2, behavior-free presentational → A transient)

Three FUI factory blocks are **behavior-free presentational controls**: the codified guideline
(`we:docs/agent/block-standard.md` Packaging governance §7) maps them to **A (transient self-erase)**
mechanically, with **no buried fork**. Tags derive cleanly by #841 (`<prefix>-<id>`, default `we-`) — the
same "supported by default, not a fork" confirmation #1381 made for `we-button`. Each subclasses/uses the
existing `TransientElement`, is fully independent, ≤3, and leaves a demoable state (`mountInDocument`
contract already provides a demo path).

| Slice | Block | Mechanism | size/type | Notes |
|---|---|---|---|---|
| S1 | **button → `we-button`** | A transient | 3 / story | The #1381-ratified, still-**unbuilt** reference application (`fui:blocks/button/Button.ts:50-58` is the rejected factory). `registerButton(tag='we-button')` via `TransientElement`; behaviors ride `CustomAttribute`s on the surviving native `<button>`. Anchor of the wave. |
| S2 | **badge → `we-badge`** | A transient | 2 / task | `createBadge` factory → transient. Pure presentational. |
| S3 | **card → `we-card`** | A transient | 2 / task | `createCard` factory → transient. Pure presentational. |

**DAG:** flat — S1/S2/S3 are mutually independent, all `blockedBy` the (resolved) epic-level #1381; each
inherits the shipping `TransientElement` pattern, so **no inter-slice edges**. Batchable immediately (one
subsystem, one repo — FUI) → feeds `/batch`.

## Could not split — and the unblocking action for each

| Group | Failing condition | Why | Unblocking action |
|---|---|---|---|
| **Grouped form controls** (checkbox-group, radio-group) | (no slice may bury its own fork) | A single control → A (transient to native input), but a **group** must persist to own cross-child selection state → leans **B**. Genuine per-block A-vs-B fork. | File a `type:decision` card — *grouped-form-control packaging mechanism (A vs B)*; de-bury from the epic body. Single text-field/number-input are likely A but ride on the same fork's resolution for the form-participation detail — hold them behind it. |
| **Behavior blocks** (stepper, deck, tabs) | (no slice may bury its own fork) | These are already the #1381-endorsed `CustomAttribute`-on-native shape. "Convert to a we- *element*" may be a no-op/regression. | File a `type:decision` card — *do behavior-blocks get a we- element, or stay CustomAttribute behaviors?* Don't auto-convert. |
| **Bulk tail (~50 remaining catalog blocks)** | (needless-fragmentation guard, not a rubric failure) | Flat, mechanical, no DAG, already specified by the codified guideline + the body's "filed as picked up." Pre-scaffolding 50 near-identical cards = review overhead, zero gain — the conservative anti-pattern the skill warns against. | **None needed** — they need a `/batch` puller, not pre-scaffolding. Keep as the epic's incremental burndown; file each slice when picked up (the body's existing stance). |

## Recommendation (confidence ~80%)

Carve **S1–S3** now (manufactures an immediately-batchable FUI wave anchored by the #1381-promised button),
and file the **two classification decision cards** to de-bury the grouped-form-control and behavior-block
forks. Leave the ~50-block tail as the epic's lazily-filed burndown. *Residual ~20%:* one could argue for a
wider first wave (text-field/number-input/single-checkbox as A) — held back only because they share the
grouped-control fork's form-participation question; safe to add once that card resolves.
