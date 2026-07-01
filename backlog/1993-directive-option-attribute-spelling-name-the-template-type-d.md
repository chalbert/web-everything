---
kind: decision
status: resolved
dateOpened: "2026-06-30"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: none
codifiedIn: "docs/agent/block-standard.md#directive-operand-attribute-names"
preparedDate: "2026-06-30"
relatedReport: reports/2026-06-30-directive-operand-attribute-naming.md
tags: [webdirectives, naming, directive-form, attribute-naming, block-standard, decision]
---

# Directive option-attribute spelling — name the `<template type=>` directive operand attributes (if-condition, switch-discriminant; reconcile for-each iterable/alias/key)

**Ratified 2026-07-01 — all three forks at their defaults** (`condition` / `match` / fused `items="… as …"` +
bare `key`). Codified into
[`we:docs/agent/block-standard.md#directive-operand-attribute-names`](../docs/agent/block-standard.md), extending
the #1983 directive-form section and citing #1987 as the bare-convention authority it inherits. The fork detail
below is the retained reasoning record (grounding + skeptic pass), not an open question.

#1983/#1986 moved the structural directives onto typed templates
(`<template type="if|switch|for-each">`) — so `type=` now carries the directive **identity**, and the operand
expression that used to live in the attribute **value** (`view:if="@cond"`, `for-each="@items as user"`) has no
specified home. #1987 settled the *convention* (operand sub-attrs are **bare**) but did **not** enumerate the
per-directive role-words. This names them, so the chunk-4 migration (#1991/#1994) can proceed without inventing
standard API in FUI impl. Grounded in a read of the real FUI tree **and** a prior-art survey published as the
[`directive-operand-attribute-naming`](/research/directive-operand-attribute-naming/) topic (session report via
`relatedReport`); each default below was attacked by a refute-only skeptic pass and its findings folded in (two
defaults flipped). Blocks #1991/#1994.

## Grounding digest

Today the operand lives in the **attribute value**, with the directive name as the key:

- **`view:if`** — the condition is `this.value`, evaluated by `evaluateCondition(template, this.value)`
  (`fui:blocks/view/ViewIfDirective.ts:81-84`).
- **`view:switch`** — the discriminant is `this.value`, resolved by `resolveBindingValue` and string-compared to
  inner `<template case="…">` / `<template default>` branches (`fui:blocks/view/ViewSwitchDirective.ts:96-130`).
- **`for-each`** — the iterable + alias is a **fused micro-syntax inside the value**
  (`AS_REGEX = /^(.+?)\s+as\s+(\w+)$/` parses `expr as alias` off `this.value`, default alias `item`), **plus** a
  separate bare `key` attribute (`fui:blocks/for-each/ForEachBehavior.ts:38,96,99,135`). **Correction folded from
  the skeptic pass:** the #1987 audit listed `as` as a "bare structural sub-attr" — that is imprecise. `as` is
  **not** a bare attribute today; it is a keyword *inside* the fused value (line 99 is `key`, not `as`). So
  whether `as` *becomes* a bare attribute is an open shape call (Fork 3), not a settled convention.

Under `type=`, the value-slot now carries identity, so each operand needs a **named bare attribute** (or, for
for-each, a renamed carrier). The **bare** convention for genuinely-separate sub-attrs is settled by #1987
(`key`/`case`/`default`; authority `we:docs/agent/platform-decisions.md:672` — separators track per-namespace
permission, not uniformity). This item is **only** the role-word selection (and for-each's fuse-or-split shape)
on top of that — it does **not** re-decide bare-ness.

## Axis-framing

The cross-cutting axis is **how an operand attaches to a typed directive template** — and one branch of it is
**settled by precedent, not a fork**: native HTML *universally role-names* the operand and never echoes the
element (`<label for>`/`<output for>` referent, `<input list>` source, `<option value>` payload, `<th scope>`
domain, `<slot name>` match-key). Uniform-naming (one word for every operand) has **zero** native or framework
precedent, so `<template type="if" if=…>` (echo the directive) and a single uniform `expr=` are both ruled out
up front — operands are **role-named per directive**. That leaves the *which-word* calls. Crucially, native has
**no** conditional / switch / loop, and the only framework "precedents" (Solid's `<Show when>`, Lit's
`choose(value)`) are **JSX/JS props, not HTML attributes** — so there is **no HTML-attribute precedent** for
any of these three operands. The skeptic pass made this dispositive: a default cannot rest on a JSX-prop citation
as if it were HTML authority, so each word is decided on **merit** (clarity, collision-safety, role-accuracy)
with the framework spelling as supporting context only. The for-each fork additionally carries a **shape**
question: *every* web framework (Vue/Angular/Svelte/Solid/Alpine) fuses iterable+alias as one microsyntax clause
(`item of items`, `items as item`) and the shipped impl already does too — so splitting them into separate bare
attributes would invent a zero-precedent form and rewrite working code, weighed against an "attribute values are
single values" native-shape analogy that has no actual native iteration behind it.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1** — if-condition attribute | **`condition`** (`<template type="if" condition="@cond">`) | `when` (terser) | med |
| **Fork 2** — switch-discriminant attribute | **`match`** (`<template type="switch" match="@sel">`) | `on` | med |
| **Fork 3** — for-each operand shape | **fused microsyntax `items="@u as user"` + bare `key`** | split bare `items`/`as`/`key` | med-high |

*Above the forks sits a **settled-by-precedent** rule (not weighed): operands are **role-named per directive**,
never an element-echo (`if=`) or a uniform `expr=` — native universally role-names (`for`/`list`/`value`/`scope`)
and uniform-naming has no precedent. See "Settled by precedent" below.*

## Fork 1 — if-condition attribute name

**Fork-existence:** a genuine either/or — `condition` and `when` are both coherent, and one attribute can carry
**only one** canonical spelling, so they cannot coexist. (Not settled-by-precedent: native has no conditional and
there is no HTML-attribute precedent for either word; both are merit calls.)

The condition expression on `<template type="if">` needs a bare role-word. Identity is already in `type="if"`, so
the operand word must name the *role* (the boolean test), not echo `if`.

- **(a) `condition`** *(recommended default, med — flipped from `when` by the skeptic pass)*: the literal
  role-word for a render-time predicate; maximally self-documenting for a *proposed standard* others must learn,
  and **zero connotation risk**. The Lit `when(condition, …)` param uses exactly this word as supporting context
  (not authority — it is a JS arg, not an HTML attribute).
- **(b) `when`** *(the live alternative, fairly weighed)*: terser, and the only *bare-prop* sibling (Solid
  `<Show when={}>`). The cost the skeptic landed: `when` imports a **temporal** connotation ("when X happens" →
  reads as an event/lifecycle hook), the wrong frame for an inert predicate `<template>`; and its lone precedent
  (Solid) is a JSX prop, so it cannot claim native-shape authority over `condition` anyway. The terseness win
  doesn't outweigh the misread risk on the most-used directive.

```html
<!-- Fork 1 (a) — default -->
<template type="if" condition="@state.loggedIn">
  <p>Secret dashboard</p>
</template>
```

`Skeptic: SURVIVES-WITH-AMENDMENT (default flipped). The skeptic attacked `when` on (3) citation-scope —
Solid's `when` is a JSX component prop, not an HTML attribute, so "the native-shaped bare-attr precedent" was a
hollow claim — and on (1) merit — `when`'s temporal connotation misreads as an event hook on an inert template.
Both land: with no HTML precedent for either word, the tiebreak is merit, and `condition` is unambiguous where
`when` is not. Default flipped `when` → `condition`; Solid demoted to supporting context. Classification axis (0)
found no re-route — a single canonical operand name is not a config dimension.`

## Fork 2 — switch-discriminant attribute name

**Fork-existence:** a genuine either/or on the discriminant word — both coherent, one canonical spelling only.
(The *case*-branch words `case`/`default` are **not** in this fork — already shipped and settled; see below.)

`<template type="switch">` resolves one expression and stamps the inner `<template case="…">` whose value
matches (`fui:blocks/view/ViewSwitchDirective.ts:96-130`). That discriminant expression needs a bare role-word.

- **(a) `match`** *(recommended default, med — flipped from `value` by the skeptic pass)*: role-accurate — the
  discriminant **is** "the value to match against the cases" — and pairs cleanly with the inner `case`
  (`match`↔`case`). No native-attribute collision (no native `match` attribute), no form-payload baggage.
- **(b) `on`** *(the live alternative, fairly weighed)*: reads as English "switch **on** @state.status" and is
  terse. The original rejection ("collides with `on:click`") was **withdrawn** by the skeptic: `on:*` events are
  **colon-namespaced** (#1987), so a bare `on` cannot technically collide — only a soft cognitive "is this an
  event?" association remains. `on` is a defensible runner-up; `match` wins on role-clarity.
- **`value`** *(rejected — was the prior default):* native `<option value>` is a form-control **payload**, and in
  `<select>` the *options* carry `value` while the container holds the selection — so by its own cited precedent
  `value` belongs on the **case**, not the switch. Putting `value` on the discriminant inverts the precedent and
  imports form-payload semantics. Refuted.

```html
<!-- Fork 2 (a) — default -->
<template type="switch" match="@state.status">
  <template case="loading"><p>Loading…</p></template>
  <template case="error"><p>Something broke</p></template>
  <template default><p>Ready</p></template>
</template>
```

`Skeptic: REFUTED → default flipped `value` → `match`. The skeptic landed a self-refuting-citation hit on (1)
merit + (3) citation-scope: `<option value>` is a form payload and sits on the *option* (the case-equivalent),
so the precedent authorizes `value` on the `case`, not the switch container — the prior default put it on exactly
the wrong node. `value` also imports submitted-payload semantics onto an inert template. Replacement weighed
`on` vs `match`; `match` chosen — role-accurate ("the value to match"), pairs with `case`, no event-association
risk. The skeptic also correctly voided the `on`-vs-`on:click` collision claim (colon-namespaced), so `on` is
recorded as a live runner-up rather than rejected.`

## Fork 3 — for-each operand shape (fused microsyntax vs split bare attrs)

**Fork-existence:** a genuine either/or on *shape* — you cannot both keep iterable+alias fused in one micro-syntax
value and split them into separate attributes. Both are coherent end-forms.

`for-each` has three operands: the iterable, the item-alias, and the key. Today: iterable+alias **fused** as
`@users as user` in the value (`AS_REGEX`), `key` a separate bare attribute. Under `type="for-each"` the
value-slot is gone, so the iterable expression needs a carrier attribute — **`items`** in both branches (the
role-word; Solid's `<For each>` is the only bare-attr iterable sibling, but `items` is clearer and already
#1987's bare listing). The fork is purely whether the **alias** rides the value or gets its own attribute.

- **(a) fused microsyntax** `items="@users as user"` (+ bare `key`) *(recommended default, med-high — flipped
  from "split" by the skeptic pass)*: preserves the **universal** framework grammar (Vue/Angular/Svelte/Solid/
  Alpine all fuse iterable+alias) and the **shipped** `AS_REGEX` — so chunk-4 only re-homes identity to `type=`
  and renames the carrier to `items`, keeping the value grammar intact. The `items as user` reading is
  battle-tested and reads as one clause (like `for…of`'s `item of items`).
- **(b) split bare `items` / `as` / `key`** *(rejected — fairly weighed):* each operand a first-class bare
  attribute is the "attribute values are single values" native-shape analogy — but native has **no** iteration to
  anchor that analogy, *every* framework converged on the fused form, and a bare item-alias attribute has **zero
  prior art** anywhere. The skeptic's decisive point: split would **invent** a novel lone `as="user"` (meaningless
  without its source) and **rewrite working, cross-framework-aligned code** on the strength of an audit misread
  (the `as`-is-bare error corrected above). Discarding universal convergence for an unprecedented invention fails
  the propose-in-platform-shape test — the *closest existing shape* for iteration is the microsyntax, not a
  hypothetical native split.

```html
<!-- Fork 3 (a) — default (fused microsyntax) -->
<template type="for-each" items="@route.data.users as user" key="@user.id">
  <div class="user-row"><span>{{@user.name}}</span></div>
</template>

<!-- Fork 3 (b) — rejected (split) -->
<template type="for-each" items="@route.data.users" as="user" key="@user.id">
  <div class="user-row"><span>{{@user.name}}</span></div>
</template>
```

`Skeptic: REFUTED → default flipped "split" → "fused microsyntax". The highest-leverage hit of the whole pass:
the prep's "split" default rested on the #1987 audit listing `as` as a bare sub-attr "at
`fui:blocks/for-each/ForEachBehavior.ts:99`" — but line 99 is `key`, and `as` lives inside the fused value via
`AS_REGEX` (`fui:blocks/for-each/ForEachBehavior.ts:38`, verified in-tree). So "split"
was not codifying existing structure; it was inventing a zero-prior-art form and rewriting working code. With the
factual premise gone, universal cross-framework convergence on the fused microsyntax wins. Default flipped to
fused; `as`-is-bare grounding error corrected in the digest. Classification (0): not a config dimension — one
canonical authored shape, not an app knob.`

## Settled by precedent (not forks)

- **Operands are role-named per directive** — never an element-echo (`if=`) or a uniform `expr=`. Native
  universally role-names (`for`/`list`/`value`/`scope`); uniform-naming has no precedent. Two whole branches
  ruled out up front — a settled rule, not a weighed fork.
- **Switch branch words `case` / `default`** — already shipped on inner templates
  (`fui:blocks/view/ViewSwitchDirective.ts:118-130`); `case` is the JS keyword + Angular `@case`/`*ngSwitchCase`.
  Not re-opened.
- **for-each `key`** — already a separate bare attribute (`fui:blocks/for-each/ForEachBehavior.ts:99`); `key`
  is the majority framework spelling (Vue/Svelte/Alpine) over Angular's `track`. Stays a separate bare attr on
  either Fork-3 branch.
- **for-each iterable carrier `items`** — the carrier attribute is `items` in both Fork-3 branches (role-word, in
  #1987's bare listing; clearer than Solid's `each`). Only the *alias placement* is the fork.

## Statute-overlap (reconciled for ratification)

#1993 will set `codifiedIn: we:docs/agent/block-standard.md#directive-form` — **extending** #1983's directive-form
section with the operand-attribute names, **not** writing a new separator rule. Sibling anchor: #1987's
`we:docs/agent/platform-decisions.md#attribute-name-colon-namespacing`. The skeptic flagged a duplication risk;
the reconciliation: the two govern by **different tests** and **compose** — #1987 rules the *separator*
(directive operand sub-attrs are **bare**, per the per-surface discipline); #1993 names *which bare role-word*
each operand takes and decides for-each's fuse/split shape. #1993 explicitly **inherits** bare-ness from #1987
(it does not re-decide it) and lives in the block-standard directive-form home, so it specializes rather than
collides. The codification must cite #1987 as the bare-convention authority it builds on.

## Lineage

#1983 (directive form `type=`, `we:docs/agent/block-standard.md#directive-form`) → #1986 (registration
mechanism, `#directive-registration-mechanism`) → #1987 (attribute-name convention,
`we:docs/agent/platform-decisions.md#attribute-name-colon-namespacing`) → **#1993** (operand spelling). Blocks
#1991/#1994 (chunk-4 migration of `view:if`/`view:switch`/`for-each` onto `CustomTemplateTypeRegistry`).
