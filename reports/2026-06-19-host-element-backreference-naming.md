# Host-element back-reference naming in the web platform — prep for #1121

**Date:** 2026-06-19
**For decision:** [#1121](../backlog/1121-webbehaviors-canonical-host-element-property-name-ownereleme.md) — webbehaviors: canonical host-element property name (`ownerElement` vs `target`), carved from epic #1095 (parent #1042).

## The question

`webbehaviors`' `CustomAttribute` base class exposes the element it is attached to under two
conflicting names. The **spec** (`we:src/_includes/project-webbehaviors.njk:40,52,56,64,88`) names the
property `ownerElement`; the **impl** (`we:plugs/webbehaviors/CustomAttribute.ts:131,156,206,366`) names
it `target` (private `#target`, public `get target()`). Which is canonical?

This is not arbitrary: `CustomAttribute` literally **chains its prototype to `Attr.prototype`**
(`we:plugs/webbehaviors/CustomAttribute.ts:196-200`), so each instance *is-a* `Attr` at runtime. The web platform already
has a name for "the element an `Attr` belongs to."

## Prior art — how the platform names a back-reference to the host element

The platform does **not** use one name for "the element this thing is attached to." It uses a
**semantically-typed** name keyed on the *relationship*:

| Relationship | Property | Read-only? | Source |
|---|---|---|---|
| attribute → its element | **`ownerElement`** | yes | [`Attr.ownerElement`](https://developer.mozilla.org/en-US/docs/Web/API/Attr/ownerElement) — "returns the Element the attribute belongs to, or `null`" |
| shadow root → its host | **`host`** | yes | `ShadowRoot.host` |
| node → its document | `ownerDocument` | yes | `Node.ownerDocument` |
| event → dispatch element | `target` / `currentTarget` | yes | `Event.target`, `Event.currentTarget` |
| mutation → affected node | `target` | yes | `MutationRecord.target` |

Two findings dominate:

1. **`ownerElement` is the exact native name for an `Attr`'s host.** Because `CustomAttribute` chains to
   `Attr.prototype`, `ownerElement` is not an analogy — it is *the same property the platform would
   expose*. Custom Elements need no equivalent (`this` *is* the element); `Attr` is the one DOM type
   whose host is a named back-reference, and that name is `ownerElement`.

2. **`target` is the dispatch-semantics word, not the ownership word.** Every platform `target`
   (`Event.target`, `MutationRecord.target`) names "the node a *dispatch/observation* is currently
   about" — a transient, per-event relationship. An attribute's relationship to its element is
   *persistent ownership*, which is precisely what `ownerElement` encodes. Using `target` for a
   persistent host imports the wrong connotation and collides with the real `Event.target` a behaviour
   reads inside its own listeners (`we:plugs/__tests__/e2e/webbehaviors-simple.spec.ts:20` already writes
   `this.target.style` *and* would read `e.target` in the same method).

### Framework vocabulary for non-`Attr` host relationships

For things that attach to a host element but are **not** attributes (controllers, directives), the
platform/ecosystem word is consistently **`host`**, never `target`:

- Lit [`ReactiveControllerHost`](https://lit.dev/docs/api/controllers/) — a controller's host is its `host`.
- Web Components — `ShadowRoot.host`.
- Angular — "host element"; `@HostBinding`/`@HostListener`; `ElementRef.nativeElement` is the DOM
  handle, the element itself is "the host."
- Stimulus — `this.element`; Vue custom directives bind `el`.

No mainstream API names a *persistent host element* `target`. This matters for the sibling question
(below): the plugs platform's **non-`Attr`** host-attached classes — `Injector`
(`we:plugs/webinjectors/Injector.ts:69` `public target`) and `CustomContext`
(`we:plugs/webcontexts/CustomContext.ts:79` `#target`) — also call it `target`, and the native-aligned
name for *those* (not being attributes) would be `host`, not `ownerElement`.

## Blast-radius inventory (`this.target` host-property accesses)

Renaming `CustomAttribute.target` → `ownerElement` touches only `CustomAttribute` and its **subclasses**
(`Attr`-derived), *not* the parallel `Injector`/`CustomContext` `target` (separate class families):

- **Base + subclasses:** `we:plugs/webbehaviors/CustomAttribute.ts` (5 prod refs + 1 doc),
  `we:plugs/webbehaviors/UndeterminedAttribute.ts`, `we:plugs/webregistries/ScopedRegistryAttribute.ts:43`
  (aliases `const host = this.target`).
- **Tests:** `we:plugs/webbehaviors/__tests__/`, `we:plugs/__tests__/unplugged.integration.test.ts`,
  `we:plugs/__tests__/unplugged.e2e.test.ts`, `we:plugs/__tests__/e2e/webbehaviors-simple.spec.ts` (~12 refs).
- **Demos:** `we:demos/declarative-spa.html`, `we:demos/declarative-spa-unplugged.html` (CustomAttribute
  subclasses, ~16 refs).
- **Docs/spec njk:** `we:src/_includes/block-descriptions/broadcast.njk`,
  `we:src/_includes/block-descriptions/view.njk`, `we:src/_includes/research-descriptions/custom-events.njk`
  (example code), and `we:src/_includes/project-webbehaviors.njk` (already `ownerElement` — would
  *converge*, not change).

**Out of scope (different `target`, do not touch):** `we:plugs/webinjectors/Injector.ts` + its tests,
`we:plugs/webcontexts/CustomContext.ts`, `we:plugs/webinjectors/HTMLInjector.ts` — these are
`Injector`/`CustomContext` own `target`, not `CustomAttribute`'s. Renaming them is the sibling decision,
not this one.

## Synthesis handed to #1121

Two forks survive the standing test; one stated option (the alias) collapses to a rollout tactic.

- **Fork 1 — canonical name = `ownerElement` vs `target`.** Genuine fork: the excluded branch (keep
  `target` / amend spec to `target`, the item's option C) discards the *exact* native name for a class
  that *is-a* `Attr`, and imports event-dispatch connotation onto a persistent ownership relation.
  **Default: `ownerElement`** (align impl to the already-shipped spec + native `Attr`). Confidence
  **~90%**; residual is purely the rename's blast radius, which is mechanical and one-shot.

- **Fork 2 — scope = `CustomAttribute` only vs unify the whole plugs host-element convention.** Genuine
  fork (the two are mutually exclusive end-states). The platform itself names host back-references *by
  semantics* (`ownerElement` for `Attr`, `host` for `ShadowRoot`), so forcing one name across `Attr`
  and non-`Attr` plugs is the weaker branch — it would either misapply `ownerElement` to non-attributes
  or perpetuate the non-native `target`. **Default: scope to `CustomAttribute`** (it's the only `Attr`;
  `Injector`/`CustomContext` are a *separate* call that should land on `host`, filed as a follow-up
  under #1042). Confidence **~80%**; residual is the cross-plug DX friction of two host names in the
  interim.

- **Rollout (not a fork — identical end-state, so prioritization not merit):** land `ownerElement` as
  canonical with `target` optionally retained as a **deprecated alias getter** for one cycle to stage
  the ~30-ref blast radius, removed in a mechanical follow-up. The item's option B is this tactic, not a
  competing canonical name (a permanent dual name is itself excluded — the platform never exposes two
  names for one property).
