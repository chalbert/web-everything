---
type: idea
status: resolved
dateOpened: "2026-06-06"
graduatedTo: "plateau/src/blocks/attributes/Anchor.ts + Anchored.ts"
tags: [droplist, autocomplete, anchor, popover, positioning, traits, behavior]
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
relatedProject: webblocks
crossRef: { url: /blocks/autocomplete/, label: Autocomplete block }
---

# Build the `anchor` trait behavior (open/dismiss + positioning)

While building `filter` + `clearable` (#122) it turned out **`anchor` is not actually a behavior
yet** — only [`src/definitions/anchor.md`](/terms/) describes it. The autocomplete "par → arrow →
enter" trace currently fakes the surface lifecycle (`aria-expanded` open-on-focus, dismiss-on-commit)
with element glue inside the integration test, because there is no real `anchor` CustomAttribute to
compose. `focus-delegation` (with `controller`), `selection`, `filter`, and `clearable` are now built;
`anchor` is the missing fifth trait the spec names.

Build `anchor` as a real CustomAttribute behavior (plateau/Frontier UI), composing with the proven
stack so the surface lifecycle is owned by the trait, not the element glue:

- **Open/dismiss binding** — bind the trigger/input to the surface: open on focus/click/typing,
  dismiss on Escape, outside-click, blur, and commit; reflect `aria-expanded` on the trigger and
  `aria-controls`/`aria-owns` wiring. This is the *behavior* half.
- **Positioning provider** — the *provider* half: where the surface lands relative to the anchor.
  Mind the **anchor split** open contract tracked in
  [#023](/backlog/023-droplist-composition-open-contracts/) (behavior vs. provider) and the native
  CSS Anchor Positioning / Popover alignment from
  [#063](/backlog/063-terminology-native-anchor-field/) — prefer the platform primitive, layer the
  trait over it.

Acceptance: an `anchor` behavior exists; the autocomplete trace composes it instead of the in-test
glue, so opening, dismissing, and `aria-expanded` are the trait's responsibility end-to-end.

## Progress

**Status:** resolved
**Branch:** plateau (impl); webeverything `docs/standard-authoring-workflow` (backlog file)

**Done — built the anchor trait as two real CustomAttribute behaviors (behavior/provider split
per #023, native-first per #063):**
- `plateau/src/blocks/attributes/Anchor.ts` — the **binding** half on the trigger/input: opens on
  focus/click/typing/open-keys, dismisses on Escape (with focus-return), outside-click, blur, and
  commit; reflects `aria-expanded` and wires `aria-controls`; toggles surface `hidden` + Popover
  top layer when available. 18 unit tests (`__tests__/Anchor.test.ts`).
- `plateau/src/blocks/attributes/Anchored.ts` — the **positioning** half on the surface: native-first
  CSS Anchor Positioning (`anchor-name` ↔ `position-anchor`, `position-area`,
  `position-try-fallbacks`), Popover opt-in, placement reflected to `data-anchored-placement`.
  9 unit tests (`__tests__/Anchored.test.ts`).
- Rewired `__tests__/Autocomplete.trace.test.ts` — the "par → arrow → enter" trace now composes
  `Anchor`; the open-on-focus and dismiss-on-commit glue is gone (only the autocomplete-specific
  "write chosen label into input" glue remains). aria-expanded open/dismiss is the trait's job.
- Expanded `plateau/src/definitions/anchor.md` to document the two behaviors.

**Verification:** full plateau suite green (147 tests); webeverything `check:standards` 0 errors.

**Findings worth keeping:**
- Enter/Space must NOT be anchor open-keys — a commit dismisses via a nested `selectionchange`, so
  if anchor's own keydown then treated Enter as an open-key it reopened. Open-keys are arrows only;
  button keyboard activation arrives as a synthesized `click` (covered by `openOn: 'click'`).
- Escape's focus-return must not reopen: a `#ignoreNextFocus` guard suppresses the programmatic
  refocus, matching combobox semantics (closed but focused).

**Leftover → new item:** [#149](/backlog/149-anchor-positioning-strategy-provider/) — make the
positioning *strategy* a swappable DI provider (JS/Floating-UI fallback for engines without CSS
anchor positioning) + validate placement in a real browser. The native CSS path shipped here is the
default; the strategy swap is the genuinely open fork from #023/open-Q#2.
