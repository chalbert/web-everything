---
type: idea
status: active
dateOpened: "2026-06-06"
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

**Status:** active
**Branch:** plateau `<current>` (impl); webeverything `docs/standard-authoring-workflow` (backlog file)

**Plan (behavior/provider split per #023, native-first per #063):**
- `Anchor` (behavior, on the trigger/input) — the binding half: open on focus/click/typing,
  dismiss on Escape/outside-click/blur/commit; reflect `aria-expanded`, wire `aria-controls`.
- `Anchored` (positioning, on the surface) — the provider half, native-first: emit CSS Anchor
  Positioning (`position-anchor`/`position-area`/`position-try-fallbacks`) + Popover when available.
- Rewire `Autocomplete.trace.test.ts` to compose `Anchor` instead of the open/dismiss glue.

**Done:**
- Explored the proven stack (FocusDelegation/Selection/Filter/Clearable), registry, test conventions.

**Next:**
- Write `Anchor.ts` + unit test; `Anchored.ts` + unit test; rewire the trace; expand `anchor.md`.

**Notes:**
- Tests: plateau vitest + happy-dom; `@withOptions` is mocked in unit tests, options set directly.
- Surface resolution mirrors `controller`: `options.surface` → `aria-controls` → `aria-owns`.
- Leftover (likely): swappable positioning *strategy* via DI provider (Floating UI adapter) — the
  genuinely open fork in #023/open-Q#2; not baked here.
