# Action Intent — does `level` model outcome-role, or does disposition deserve its own axis?

**Date:** 2026-06-20 · **Decision item:** #1324 · **Raised during:** #1318 (the `variant` axis) ·
**Project:** webintents · **Research topic:** `/research/action-disposition-outcome-role/`

## The question

Action Intent (`we:src/_data/intents/action.json`) documents `level`
(`primary | secondary | tertiary | destructive`, lines 10–18) as *"the semantic weight determining
visual prominence."* But primary/secondary buttons often carry an **outcome-role** — primary =
continue/confirm, secondary = back/cancel — that prominence alone does not capture. #1318 just ratified
that **prominence (`level`)** and **box-treatment (`variant`)** are orthogonal and must not be conflated.
This item asks the sibling question: is there a *third* axis — action **disposition / outcome-role** —
that `level` is currently being overloaded to imply, or does `level` already adequately stand in?

## Finding 1 — "outcome-role" is two separable things; one is already native

The word "role" in the raised item bundles two concerns that pull apart cleanly:

- **(i) Behavioral outcome** — what the button *does*: submit a form, reset it, dismiss a dialog,
  navigate back. **The web platform already expresses all of this natively**, and Action Intent already
  pulls the relevant capability in (`requiresCapabilities: ["invokers"]`, `we:src/_data/intents/action.json:4-6`):
  - `<button type="submit | reset | button">` — `submit` ≈ confirm/continue, `reset` ≈ clear/revert.
  - `<form method="dialog">` + `<button value="confirm|cancel">` → the dialog's `returnValue` is the
    activating button's `value` (`returnValue === "cancel"` is the canonical dismiss signal).
  - **Invoker Commands API** — `command="show-modal | close | request-close"` + `commandfor`.
    `request-close` fires the dialog's *cancel* event then closes it — the native "dismiss/back" wiring,
    no JS. ([MDN — Invoker Commands API](https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API))
  - The **default/preferred action** (ENTER-activated, autofocused) is the native affirmative marker.
  - **Implication:** WE must *not* re-model behavioral outcome as an intent dimension — that would
    duplicate native vocabulary and violate *intents are UX-only* (technical/behavioral wiring is the
    block's job, not a UX dimension). The block maps disposition → the right native mechanism.

- **(ii) Disposition** — the *abstract* "this is the affirmative action vs. the dismissive one vs. a
  neutral one," independent of *which* native mechanism enacts it. This is a UX "what," and it is the
  part `level` is being overloaded to carry.

## Finding 2 — every platform models disposition as an axis *separate from* prominence

The strongest prior art is that native UI toolkits do **not** fold disposition into visual weight — they
give it its own enum:

| Platform | Disposition axis | Values | Prominence is separate? |
|---|---|---|---|
| Apple SwiftUI | `ButtonRole` | `cancel`, `destructive` (no "confirm" — the affirmative is the *preferred/default* action) | Yes — `.borderedProminent` etc. is independent |
| Android Material | AlertDialog buttons | positive / negative / neutral | Yes |
| Microsoft WinUI | `ContentDialog` | Primary / Secondary / **Close** + `DefaultButton` enum `{None, Primary, Secondary, Close}` | Yes — `DefaultButton` adds accent + ENTER, orthogonally |
| Web (`<dialog>`) | button `value` / invoker `command` | `confirm` / `cancel` / `request-close` | Yes — `value`/`command` ≠ CSS weight |

Sources: [SwiftUI `ButtonRole`](https://developer.apple.com/documentation/SwiftUI/ButtonRole/destructive) ·
[SwiftUI button role (Sarunw)](https://sarunw.com/posts/swiftui-button-role/) ·
[WinUI `ContentDialog`](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.controls.contentdialog) ·
[`<dialog>` MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog).

The decisive observations:

- SwiftUI's `cancel` **role drives ordering** ("the cancel button gets pushed to the bottom of a
  confirmation dialog") — *not* its prominence. So ordering needs a disposition signal, not a level.
- The **affirmative is not the most prominent**. In a destructive-confirmation dialog the *safe*
  action ("Cancel") is frequently the highest-weight / default button while "Delete" is `destructive`.
  Prominence (`level`) therefore **cannot stand in** for disposition — exactly the orthogonality proof
  #1318 used for `variant` (a secondary-level button rendered filled), one axis over.

## Finding 3 — the in-tree gap is concrete: `groupOrdering: platform` is un-implementable today

`we:src/_data/intents/action.json` already declares `groupOrdering: dom | reverse | platform` (lines 26-32). The `platform`
value means *"order actions per OS convention"* — macOS/iOS put the affirmative **last** (cancel
pushed to the bottom/leading), Windows puts it **first**. **A renderer cannot apply `platform` ordering
without knowing which action is affirmative vs. dismissive** — and DOM order + `level` prominence do not
tell it (the affirmative can be any level). So `groupOrdering: platform` is currently a *declared but
unsatisfiable* value: it needs a disposition input that the intent does not yet provide. This is the
fork-existence proof — *"`level` already stands in"* is the **broken branch** for the platform-ordering
and default-button use-cases.

The same gap blocks **default-button** emphasis (WinUI `DefaultButton`, native autofocus/ENTER): the
block needs to know which action is the preferred affirmative one, and `level` does not say.

## Finding 4 — WE's own precedent says: name the orthogonal UX axis on the owning intent

This mirrors #1318 exactly. Action Intent is already multi-axis (`level · busy · groupOrdering ·
groupSizing`). #1318 added `variant` as a *fifth* orthogonal dimension rather than overloading `level`,
because folding reproduces the conflation incumbents suffer. Disposition is the *same shape*: a real,
orthogonal, UX-level axis that `level` is being asked to carry. The consistent move is a **sixth
dimension** (`disposition`), open-numbered under the same contract #1318 established, with behavior
delegated to native (Finding 1).

## Classification (per-fork pass, recorded for the ruling)

1. **Layer:** Intent (declarative UX "what" — *which action is the affirmative one*). Not Block (no
   runnable code mandated), not Protocol (no engine-swap/multi-vendor interop), not Capability.
2. **Protocol or dimension?** Dimension — there is no swappable-vendor/engine story; it is a declarative
   selector. Reaching for a protocol here is lock-in for no interop gain.
3. **Affects an intent → expose the whole axis:** yes — surface `affirmative | dismissive | neutral` as
   a configurable dimension; don't bake one disposition.
4. **Fixed mechanic or dimension?** Dimension — all values are legitimate simultaneous end-states (a
   dialog footer has an affirmative *and* a dismissive *and* possibly neutral action at once).
5. **DI-injectable?** No — disposition is an authored, **explicit per-action** property (like `level`),
   structural to the action, not an ambient/DI fallback (unlike `collision`/`focusStrategy`).
6. **Default:** most-permissive = **unspecified** (absent → the block infers from the native
   `type`/`command`/`value` signal, else treats as neutral ordering). Declaring `affirmative` is the
   author's opt-in, never forced.
7. **Seam:** lives on **Action Intent**, consumed by its own **group** sub-axis (`groupOrdering:
   platform`, default-button). Also seams *intent→native* (block maps `disposition` → `command`/`value`/
   `type`), which is wiring, not an intent↔intent seam.

## Recommendation (prepared — pending ratification)

- **Forced invariant A:** `level` stays **prominence-only**; it does **not** absorb outcome-role. The
  item's null hypothesis ("`level` adequately stands in") is rejected on the orthogonality + platform-
  ordering evidence (Findings 2–3) — same conflation-is-lossy principle #1318 ratified.
- **Forced invariant B:** the **behavioral** outcome (submit/reset/close/back) is **native, not a WE
  dimension** — `type` / `value` / invoker `command` / `method=dialog`, already in via
  `requiresCapabilities: ["invokers"]`. WE never re-models behavior (intents-UX-only).
- **Fork 1 → A (add the dimension):** add a thin **`disposition`** dimension to Action Intent — the
  abstract affirmative/dismissive/neutral semantic that drives platform-aware grouping, ordering, and
  default-button. Alternative B (leave it un-modeled, infer from native) is broken: the abstract
  disposition is not recoverable from a plain `type=button` + JS-handler action (the common case), so
  `groupOrdering: platform` can't work. *(~75%; residual is whether to build it now vs. leave latent —
  but that is prioritization, not merit. On merit: add it.)*
- **Fork 2 → A (minimal abstract triple):** values = **`affirmative | dismissive | neutral`** (open-
  numbered per the #1318 contract), not a literal `continue|confirm|cancel|back` enum. "continue" and
  "confirm" both *are* affirmative; "back" and "cancel" both *are* dismissive — the finer label is a
  native `command`/`value`/author-label concern, not a disposition. A larger literal enum reproduces the
  behavior-vs-disposition conflation invariant B forbids. *(~70%.)*
- **Out of scope (carved, not decided here):** whether `destructive` should migrate off `level` to a
  disposition/role axis (SwiftUI models it as a `ButtonRole`, not a prominence). That touches a
  **shipped** `level` value with its own blast radius and belongs to the broader "`level` is overloaded"
  cleanup — filed as a follow-up, not ratified in this exploratory item.

## Cross-references

- #1318 — the ratified `variant` axis; this item's sibling and the orthogonality template.
- `we:reports/2026-06-20-action-emphasis-axis.md` — the #1318 survey (same method).
- `we:docs/agent/platform-decisions.md#intents-ux-only` — UX-only statute (behavior → native/block).
- #315 — the gap-sweep program this feeds.
