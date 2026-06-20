---
kind: decision
status: resolved
dateOpened: '2026-06-02'
dateStarted: '2026-06-08'
dateResolved: '2026-06-08'
codifiedIn: "one-off"
tags:
  - droplist
  - composition
  - architecture
  - traits
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
---

# Resolve remaining droplist composition contracts

Four open contracts from the composition doc's Open Questions, tracked together: (1) Anchor — split surface-binding (behavior) from positioning strategy (DI provider / Floating UI adapter); (2) inter-trait invariants — windowing must not unmount the active option, and async + live-status both write status (enforce via the option collection, not implicit handshakes); (3) trait activation order — selection must connect before focus (the assembler must guarantee order, observed in the split prototype); (4) convenience element granularity — one <drop-list> with dimension attributes vs distinct <auto-complete>/<multi-select> tags. See the report's Open Questions section for the full enumeration.

## Resolved — contract (4) convenience element granularity (2026-06-08)

**Decision: distinct tags, not one configurable `<drop-list>`.** Each family member is its own
custom element — `<auto-complete>`, `<multi-select>`, `<tree-select>`, etc. — **not** presets toggled
by attributes on a shared element. `<drop-list>` stays **as light as possible and carries no
variant code**: the composition of the target/custom list is owned **inside each higher-level
element**, which assembles its own fixed trait set. This rejects the attribute-dimension (Option A)
and sugar-alias (Option C) shapes in favor of self-documenting, independently-composed tags.

Unblocks: [#138](/backlog/138-auto-complete-element-and-demo/) (register `<auto-complete>` as its own
element composing its trait set — no `<drop-list>` desugaring) and
[#064](/backlog/064-tree-select-block/) (`<tree-select>` is its own element by the same rule). The
already-authored [#035](/backlog/035-autocomplete-block/) / [#054](/backlog/054-multi-select-dropdown-block/)
specs should reflect distinct-element framing, not attribute configs of one element.

## Resolved — remaining contracts (1), (3), (2) (2026-06-08)

**(1) Anchor split — settled by the [#136](/backlog/136-anchor-trait-behavior/) build.** The line is
drawn: surface **binding is a behavior** (`fui:Anchor.ts` — open/dismiss, `aria-expanded`), **positioning
is a provider** (`fui:Anchored.ts`, native CSS Anchor Positioning by default). The residual "which
strategy engine for non-supporting browsers" question is *not* part of this contract — it's its own
open item [#149](/backlog/149-anchor-positioning-strategy-provider/) (swappable DI strategy / Floating
UI fallback).

**(3) Activation order — settled *by implication of contract (4)*.** The report left it as "the
substrate **or** the assembler guarantees order." Contract (4)'s ruling (each family member is its own
element assembling a fixed trait set) makes **the element the assembler**, so it owns connection order
(selection connects before focus). No substrate-level ordering mechanism is needed; ordering is the
element's responsibility, proven in the split prototype.

**(2) Inter-trait invariants — ruled: two authorities, matched to two concerns. Traits coordinate
through the right authority, never with each other.**

| Invariant | Authority | Role |
|---|---|---|
| active option always mounted | **the option collection** (model) | exposes the canonical `activeIndex`; the `windowed` behavior must include it in every rendered slice — windowing never unmounts the active index |
| status precedence | **`LiveStatus`** (behavior / announcer) | owns the single `aria-live` region and resolves precedence (`error > loading > count`); `withAsyncOptions`, `filter`'s error channel, and `live-status` all push status to it — none touch `aria-live` directly |

The key correction over the first framing (which put *both* invariants on the collection): status
precedence is *announcement policy*, a different axis from "what are the options," so it belongs in a
standalone announcer (`LiveStatus`, already mounted by #136), not baked into the data model. The
collection stays pure source-of-truth and enforces invariant 1 simply *by being the single truth* the
`windowed` behavior must honor. Coordination is **through the DOM** — traits `dispatchEvent` a bubbling
`statuschange`; `LiveStatus` listens, so no trait needs a handle to another.

**Implementation shape (for #137):** `LiveStatus` is a `CustomAttribute` that adopts an existing
`status=<id>` region by reference (or creates one `role="status"`), keeps a `Map<kind,message>`,
debounces (~150ms) so keystrokes don't spam the SR, and writes the single highest-precedence message.
Errors stay *polite* and win the slot via precedence rather than using a separate `assertive` region.

**Unblocks (now agent-ready):** [#122](/backlog/122-filter-clearable-trait-surfaces/),
[#137](/backlog/137-live-status-windowed-trait-surfaces/) (builds both invariants against these
authorities), [#148](/backlog/148-filter-error-channel-live-status/) (routes errors through
`LiveStatus`), [#149](/backlog/149-anchor-positioning-strategy-provider/) (the deferred positioning
strategy). The status-arbiter's cross-cutting reuse beyond droplist is captured as
[#199](/backlog/199-live-status-arbiter-intent/).
