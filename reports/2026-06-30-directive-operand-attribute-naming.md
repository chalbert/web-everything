# Directive operand-attribute naming — prep research for #1993

**Date:** 2026-06-30 · **Decision:** #1993 (directive option-attribute spelling) · **Lineage:** #1983 (directive form `type=`) → #1986 (registration mechanism) → #1987 (attribute-name convention) → **#1993** (operand spelling). Blocks #1991/#1994 (chunk-4 migration).

## The question

#1983/#1986 moved the three structural directives onto typed templates — `<template type="if|switch|for-each">` — so `type=` now carries the **directive identity**. But each directive's **operand expression** used to live in the *attribute value* (`view:if="@cond"`, `for-each="@items as user"`), with the directive name as the *key*. Now the key carries identity, so the operand has **no specified home**. #1987 settled the *convention* (directive operand sub-attrs are **bare** — its audit buckets `items`/`key`/`as`/`case`/`default` as bare structural sub-attrs) but did **not** enumerate the per-directive role-words. #1993 names them:

- **if** — the condition expression
- **switch** — the discriminant value matched against cases
- **for-each** — reconcile iterable + item-alias + key now that the single value-slot is gone

## Grounding (real tree)

- `view:if` carries the condition as the attribute **value**, `evaluateCondition(template, this.value)` — `fui:blocks/view/ViewIfDirective.ts:81-84` (value = `this.value`, the `CustomAttribute` attr value).
- `view:switch` carries the discriminant as the attribute **value**, string-compared to inner `<template case="…">` / `<template default>` branches — `fui:blocks/view/ViewSwitchDirective.ts:96-130`.
- `for-each` carries `expression as alias` as a **micro-syntax inside the value** (`AS_REGEX = /^(.+?)\s+as\s+(\w+)$/`, default alias `item`), **plus** a separate bare `key` attribute (`template.getAttribute('key')`) — `fui:blocks/for-each/ForEachBehavior.ts:35,100-103`.
- Convention authority: structural sub-attrs are **bare** — #1987 audit row "Native-aligned attrs / structural sub-attrs → bare" (`we:backlog/1987-attribute-naming-convention-review-colon-namespacing-view-if.md`, `we:docs/agent/platform-decisions.md:672` per-surface discipline). So #1993 is **not** re-litigating bare-vs-colon — only the role-words.

## Prior art — how native + frameworks name directive operands

### 1. Native HTML always role-names the operand, never echoes the element
The platform's consistent pattern: the bare operand attribute is a **role-word** distinct from the element name — `<label for>` / `<output for>` (referent), `<input list>` (source collection), `<option value>` (payload), `<th scope>` (applicability domain), `<slot name>` (match key). **Implication:** WE's operand attrs must be **role-named**, not echo the directive (`<template type="if" if=…>` is the un-native shape). Uniform-naming (one word for every operand) has **zero** native or framework precedent — native explicitly varies `for`/`list`/`value`/`scope`. So *role-named-per-directive* is settled by precedent, not a fork.
([th scope](https://html.spec.whatwg.org/multipage/tables.html#attr-th-scope) · [MDN `for`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/for) · [MDN `<slot>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/slot))

There is **no native conditional, switch, or loop** — so for those operands WE has no native role-word and must borrow from frameworks.

### 2. Conditional → `when` (bare-attr) or `condition` (param)
When frameworks lift the condition into a **named prop**, the word is `when` (Solid `<Show when={cond}>`) or `condition` (Lit `when(condition, …)`). Microsyntax frameworks (Vue `v-if`, Angular `@if`, Svelte `{#if}`, Alpine `x-if`) leave it unnamed in the value. **`when` is the only real *bare-attribute* precedent**; `condition` is a function param, more literal/verbose.
([Solid `<Show>`](https://docs.solidjs.com/reference/components/show) · [Lit directives](https://lit.dev/docs/templates/directives/))

### 3. Switch → discriminant `value`; case `case`
Discriminant role-words: **`value`** (Lit `choose(value, cases)`; native `<option value>` "match a value"), or unnamed in the block head (Angular `@switch (expr)`). Solid has *no* central discriminant — each `<Match when={cond}>` self-tests. Case role-words: **`case`** (Angular `@case`/`*ngSwitchCase` + the JS keyword) vs `when` (Solid). Vue and Svelte have **no switch primitive** at all. WE already ships `case`/`default` on inner templates — universally legible (settled).
([Angular control flow](https://angular.dev/guide/templates/control-flow) · [Solid Switch/Match](https://docs.solidjs.com/reference/components/switch-and-match) · [Lit `choose`](https://lit.dev/docs/templates/directives/))

### 4. List → iterable+alias are a **fused microsyntax everywhere**; key is always separate
**Critical finding:** *every* framework keeps iterable+alias fused in one expression (`item of items` / `item in items` / `items as item`), and *every* framework names the key/track as a **separate** attribute/clause — **none inlines the key**, and **none gives the item-alias its own bare attribute**. Iterable-as-bare-attr precedent exists only in Solid (`<For each={items}>`). Key spelling: **`key`** (Vue/Svelte/Alpine) majority vs `track` (Angular @for).
**Implication:** WE splitting for-each into bare `items`/`as`/`key` is **native-shaped** (HTML attribute values are single values, not mini-DSLs) but the **bare item-alias attr (`as`) has zero prior art** — a deliberate divergence from the universal fused microsyntax, and the sharpest cost to weigh.
([Vue directives](https://vuejs.org/api/built-in-directives.html) · [Svelte each](https://svelte.dev/docs/svelte/each) · [Solid `<For>`](https://docs.solidjs.com/reference/components/switch-and-match))

## Synthesis → the prepared defaults

| Operand | Default | Runner-up | Why |
|---|---|---|---|
| if-condition | **`when`** | `condition` | only real *bare-attribute* precedent (Solid); terse native-shaped single role-word; `condition` = clarity play |
| switch-discriminant | **`value`** | `on` | native `<option value>` + Lit `choose(value)`; "match this value"; `on` collides with event idiom |
| switch case/default | **`case`/`default`** (settled) | — | shipped; JS keyword + Angular; universally legible |
| for-each shape | **split bare `items`/`as`/`key`** | fused microsyntax `items="@u as user"` | native shape (no micro-DSL in values) — but bare `as` is novel (flagged) |
| for-each key | **`key`** (settled) | `track` | majority spelling; already shipped |

Role-named-per-directive is **settled by precedent** (native universally role-names; uniform-naming has no precedent) — stated in the item's axis framing, not a fork.

## Statute-overlap (for #1993's eventual codifiedIn)
#1993 codifies in `we:docs/agent/block-standard.md#directive-form` (the operand-naming extension of the directive-form section), **sibling** to #1987's `we:docs/agent/platform-decisions.md#attribute-name-colon-namespacing`. Different tests — #1987 governs the *separator* (bare vs colon vs hyphen, per surface); #1993 governs *which bare role-word* names each directive operand. They **compose**: #1987 rules directive operand sub-attrs are bare; #1993 names them. No collision.
