# Directive applied-residue / region-annotation marker grammar — prep research for #1989

**Decision:** [#1989](../backlog/1989-directive-applied-residue-region-annotation-marker-grammar-u.md) ·
raised by [#1986](../backlog/1986-custom-type-registry-family-customtemplatetype-customscriptt.md)'s family
invariant (rule 5, resolved) · sibling of [#1987](../backlog/1987-attribute-naming-convention-review-colon-namespacing-view-if.md)
(authoring names/values — a *distinct* surface) · 2026-06-30 ·
research topic: [`directive-residue-marker-grammar`](../src/_data/researchTopics/directive-residue-marker-grammar.json).

## Why this report exists

#1986 ratified (rule 5) a **family invariant**: authored directive nodes and the region/residue annotations a
directive *leaves when applied* must occupy **disjoint, matcher-excluded grammars**, so every registry's `upgrade`
walk claims **only authored nodes** (residue never re-upgraded) and the two read apart in raw DOM/devtools. It
explicitly delegated the **exact reserved residue sigil** — unifying today's `:start`/`:end` vs `/`-close split —
as a token-grammar question (`we:docs/agent/block-standard.md:437-439`). This report grounds that call.

> **Pointer bug found:** block-standard rule 5 delegates the residue sigil to **#1987**, but #1987 (authoring
> names) explicitly punts it back as *"Adjacent, not in scope here … Tracked separately as #1989."* The residue
> sigil is **#1989**, not #1987. When #1989 ratifies, rule 5's delegation pointer must be corrected #1987 → #1989.

## Ground truth (verified in `frontierui/`)

The directive family emits **two** boundary conventions today, and the inspector (#1973) must understand both:

| Convention | Emitter / origin | Marker shape | `file:line` |
|---|---|---|---|
| **`:start`/`:end` paired** (machine residue) | runtime behaviors when a template directive applies | `<!-- for-each:start (@users) -->` … `<!-- for-each:end -->` | `fui:blocks/for-each/ForEachBehavior.ts:105-106`, `fui:blocks/view/ViewIfDirective.ts:56-57`, `fui:blocks/view/ViewSwitchDirective.ts:62-63` |
| **`name` / `/name` open-close** (authored) | hand-authored comment directive | `<!-- control:if cond="x" -->` … `<!-- /control:if -->` | `fui:plugs/webdirectives/CustomCommentParser.ts:60-73`, recognised by the inspector `classify()` |

The matcher exclusion seed: `directiveNameOf` returns `null` for a leading-`/` token
(`fui:plugs/webdirectives/CustomCommentRegistry.ts:39-43`), `DefaultCommentParser.parse` and
`multiTemplate.openingDirectiveName` likewise skip `/`-prefixed (`fui:plugs/webdirectives/CustomCommentParser.ts:71`,
`fui:plugs/webdirectives/multiTemplate.ts:30-34`). The inspector reads **both** conventions and reconstructs a
nested region tree, labelling each region with its directive **name** + bound-state **expression**
(`fui:plugs/webdirectives/directiveInspector.ts:88-150`; `start-end` vs `open-close` `DirectiveBoundaryKind`).

### The latent disjointness gap (the concrete reason this is not cosmetic)

`multiTemplate.openingDirectiveName` claims any comment whose leading token matches `/^[\w-]+:[\w-]+$/`
(`fui:plugs/webdirectives/multiTemplate.ts:34`). A residue **open** marker token `for-each:start` matches that
shape (`for-each` : `start`) — and so does `for-each:end`. Neither starts with `/`, so the leading-`/` seed does
**not** exclude them. Today they are safe only because **no registered directive happens to be named
`for-each:start`** — disjointness by *luck (absence of collision)*, not by *grammar*. The invariant wants the
guarantee structural: a residue marker must be un-claimable by construction, both halves, by a cheap test.

## Prior art — machine-emitted DOM boundary markers across the ecosystem

Native HTML gives **nothing**: comment nodes are opaque, there is no reserved comment grammar (the one historical
exception, IE conditional comments `<!--[if IE]>`, is dead and *led with `[`*). So the "platform shape" here is
the **de-facto cross-framework convention** for zero-node region boundaries — and it is strikingly consistent.

| Framework | Boundary marker | Sigil | Paired? | Carries name/expr? |
|---|---|---|---|---|
| **React** (Suspense/RSC hydration) | `<!--$-->` open, `<!--/$-->` close, `<!--$!-->` (errored), `<!--$?-->` (fallback) | `$` (+ `/` close) | yes | no — positional |
| **Vue 3** (fragment/block, `v-if` anchor) | `<!--[-->` open, `<!--]-->` close; `<!---->` empty `v-if` anchor | `[` / `]` | yes | no — positional |
| **Svelte 5** (hydration blocks) | `<!--[-->` … `<!--]-->`, `<!--[!-->` (special) | `[` / `]` | yes | no — positional |
| **Svelte 5** state variants | `<!--[!-->` (else branch), `<!--[?-->` (hydration-failed) | `[` + state char | yes | no — state char only |
| **lit-html** (parts) | `<!--?lit$NONCE$-->` node-part marker; `<!---->` child-part | `?lit$` + nonce | mostly anchor | no — nonce id |
| **Solid.js** (hydration) | `<!--$-->` open, `<!--/-->` close (depth-counted) | `$` / `/` | yes | no — `data-hk` carries identity |
| **Angular** | `<!--bindings={…}-->`, `<!--container-->`, `<!--ng-container-->` | word / `bindings=` | anchor | **yes** (label + reflected state, dev) |

**Cross-cutting pattern** (all source-confirmed except Angular's prod payload + Marko, flagged UNCERTAIN). (a)
Every framework leads the comment data with a **non-alphanumeric sigil authored content never starts with** —
`[`, `]`, `$`, `/`, `?`, `!`, `#` — so "is this a machine marker?" is an **O(1) `data[0]` test**, never a
tokenize-and-match (authored comments start with letters/whitespace). (b) Paired region boundaries are
overwhelmingly **bracket-based** — Vue and Svelte *independently* chose `[`/`]`; React (`$`/`/$`) and Solid
(`$`/`/`) are the same sigil-open / slash-close shape, and that **`/`-close echoes the HTML end-tag** `</tag>`
(the same `/` FUI already excludes). (c) Collision-safety is about the *leading char no upstream claims*: Solid
**migrated `#`→`$`** precisely because `#`-leading comments collide with server/CDN SSI directives — a cautionary
tale that an arbitrary "safe-looking" char isn't safe, whereas `[`/`]` are claimed by no common processor. (d)
The mainstream markers are **anonymous-positional** (state in a variant char, identity by sibling order / a
`data-hk`), *except* **Angular**, which embeds a human-readable label (`container`) + dev-mode `bindings={…}`
reflected state. **FUI is closer to Angular here**: its inspector (#1973) is deliberately **non-invasive** (#606)
— it patches nothing and reads the region tree *purely from the DOM comments*, so name+expression must live *in*
the marker or the inspector loses its labels. So FUI takes the **bracket sigil shape** (Vue/Svelte, but those are
**anonymous**) and keeps a **name/expr payload** (Angular, but that is **bracketless**) — the two precedents are
separate, so the bracket-plus-named-payload `<!--[for-each @users-->` is a **novel combination FUI owns**, a
best-fit synthesis rather than convergent prior art.

## Synthesis for #1989

- **Forced invariant** (from #1986 rule 5, not re-opened): authored opens are claimed; **both halves** of any
  residue marker are excluded *by grammar*; residue reads apart from authored directives in raw DOM.
- **Fork 1 — the reserved residue grammar.** Adopt the cross-framework **bracket-sigil pair**
  `<!--[name expr-->` / `<!--]name-->`. A leading `[`/`]` is the cheapest possible exclusion (`data[0]`), is
  collision-free against the authored `ns:name` opening-token shape (which starts with a word char), pairs by
  construction, and reads as balanced open/close in devtools — closing the latent `multiTemplate` mis-claim gap
  that the current suffix `:start`/`:end` leaves open. Alternatives: keep `:start`/`:end` (shipped, but suffix-test
  is costlier and `ns:name`-shaped); a single reserved prefix char (`%`/`~`, weaker precedent than brackets).
- **Fork 2 — unification scope.** Keep the **authored** `/name` close as-is (it mirrors the native HTML end-tag
  `</tag>` shape hand-authors already know, and `propose-standard-in-platform-shape` says take the closest native
  shape), and use the bracket sigil **only** for machine residue — but **unify the matcher behind one exclusion
  predicate** that recognises both the `/`-prefix and the `[`/`]`-prefix. This unifies the *predicate* (one rule,
  one mental model) without forcing hand-authors onto an alien `]control:if` close. The purist alternative folds
  `/name` into `]name` for one literal sigil, at a real author-ergonomics cost for no extra guarantee.
- **Name+expression payload** is **supported by default** (not a fork): the #1973 non-invasive inspector requires
  it. Start marker carries the expression (`[for-each @users`), end marker is bare (`]for-each`), matching the
  inspector's existing read.

## Codifies into

`we:docs/agent/block-standard.md#directive-registration-mechanism` rule 5 (turning the delegated-sigil placeholder
into the ratified grammar) **and** corrects rule 5's stale delegation pointer (#1987 → #1989). The inspector
(`fui:plugs/webdirectives/directiveInspector.ts`) collapses its two-convention `classify()` onto the one residue
grammar + the authored `/`-close; the three emit sites switch to the bracket form.
