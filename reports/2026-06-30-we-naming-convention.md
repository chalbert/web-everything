# WE attribute-naming convention — prep research for #1987

**Decision:** [#1987](../backlog/1987-attribute-naming-convention-review-colon-namespacing-view-if.md) ·
triggered by [#1983](../backlog/1983-directive-form-standard-comment-vs-template-form-reconcile-t.md) (directive
form, resolved) + [#1986](../backlog/1986-custom-type-registry-family-customtemplatetype-customscriptt.md) ·
2026-06-30 · research topic:
[`we-attribute-naming-convention`](../src/_data/researchTopics/we-attribute-naming-convention.json).

## Why this report exists

#1983 moved *directives* off `view:if` colon onto `<template type=>` ("colons in HTML attributes exist only in
XML/foreign content; no native attribute looks like `view:if`"). That cold framing reads as a blanket indictment
of every colon attribute — `on:click`, `layout:grid`, `nav:list`. #1987 asks whether the indictment is
catalog-wide. Grounding it against the real tree **and the ratified statute** showed the cold read is wrong on a
citation, and the prep skeptic flipped one of the two defaults.

## Audit (verified across both repos)

| Surface | Spelling | Count | Anchor |
|---|---|---|---|
| Behavior/event attribute **names** | colon (`view:if`, `nav:list`, `on:click`) | ~30 | `fui:blocks/view/registerViewDirectives.ts:14-16`, `fui:blocks/attributes/on-event/OnEventAttribute.ts:277-295` |
| Behavior attribute names | bare-hyphen (`type-ahead`, `droplist-anchor`) | ~8 | `fui:blocks/droplist/registerDroplistMenu.ts:52-55` |
| Author data | `data-*` | ~6 | `fui:plugs/webanalytics/TrackAttribute.ts:25` |
| Native-aligned / structural sub-attrs | bare (`multiple`, `case`, `key`) | ~12 | `we:src/_data/blocks/` |
| Comment-directive names | colon `ns:name` (grammar-locked) | ~6 | `fui:plugs/webdirectives/CustomCommentParser.ts:34` |
| Directive form / `type=` **values** | bare (`type="if"`) | ~6 | `we:docs/agent/block-standard.md:375` |
| Injector domain | `@date/core` (a value, not an attr) | 1 | `fui:plugs/webinjectors/declarativeInjector.ts:47` |

Two divergences flagged for cleanup (not forks): the bare-hyphen behavior attrs are the *actually*
collision-unsafe names (no reserved prefix), and a double-colon outlier `route:guard:leave`
(`fui:blocks/router/types.ts:319`) has no precedent anywhere.

## The decisive grounding: colon is already ratified for attributes

The cold "colons are XML-only, so kill them" read missed a **ratified** statute:
`we:docs/agent/platform-decisions.md:672-673` (the `registry-name-guard` ruling, point 4) states the separator
set tracks **what each namespace permits, not uniformity** — *"attributes accept hyphen **or** colon (`xml:lang`,
`nav:list`)"* — naming a WE colon attribute as legitimate. And #1983 itself **scoped** its colon-rejection to the
directive *kind discriminator* (→ `type=`), explicitly carving name-/value-namespacing to #1987
(`we:docs/agent/block-standard.md:399-401`). So the indictment is not catalog-wide.

## Prior-art survey (full findings in the research topic)

- **F1–F2** — `data-*`/`aria-*` are the platform's hyphen-prefixed author-attribute namespaces (HTML spec
  `data-*`; MDN ARIA).
- **F4** — custom-**element** names MUST contain a hyphen; the rationale is collision-safety (HTML guarantees no
  hyphenated native element names) — https://html.spec.whatwg.org/multipage/custom-elements.html.
- **F5** — no native HTML *attribute* uses a colon; colon denotes an XML-namespace prefix (`xml:lang`,
  `xlink:href`) — the one real merit wound against colon attribute names.
- **F6 / F6b** — the live proposals (WICG/webcomponents#1029, whatwg/html#2271) propose author **attributes**
  must contain a **hyphen** (floating an `enh-*` reserved prefix) — **not** colon. *Unshipped* — directional, not
  law.
- **F7–F10** — colon/`@` directive markers are **framework** conventions (Vue `:`/`@`, Svelte's entire surface
  `on:click`/`bind:value`/`use:action`); `on:click` is *literally* Svelte's spelling. Strong framework
  precedent, zero native precedent.
- **F11** — collision-safety is the platform's stated basis for `data-*` + the custom-element hyphen; bare author
  names risk clashing with future native names.

## Resulting prepared shape (per surface)

- **Settled:** native-aligned attrs bare + `data-*`; directive form `type=`, core values bare; comment names
  colon `ns:name` (no collision risk in a comment); event values bare Action IDs.
- **Fork 1 — behavior/event attribute names: keep colon** *(default)* vs migrate to hyphen. Default rests on the
  ratified `:672` + collision-safety-by-construction + the unshipped status of the hyphen proposals; the verbose
  proper-hyphen form (`enh-on-click`) buys the same guarantee colon already gives.
- **Fork 2 — third-party `type=` value namespacing: `owner-kind` hyphen** (`acme-card`) *(default)* vs colon vs
  reverse-DNS.

## Skeptic pass (folded into the item — one default flipped)

- **Fork 1 (keep colon names): SURVIVES-WITH-AMENDMENT.** The skeptic's hardest attack —
  native-first/#1983-consistency demands colon die everywhere — was REFUTED via `we:docs/agent/platform-decisions.md:672-673`
  (colon is a ratified attribute separator; uniformity is the wrong principle) and #1983's own scoping
  (`we:docs/agent/block-standard.md:399-401`). The one merit hit that landed (F5: colon spec-means XML-namespace)
  is folded as an explicit honesty caveat, and the citation re-based off the un-ratified
  `we:docs/agent/conventions.md:10` onto `:672`.
- **Fork 2 (third-party `type=` value): REFUTED colon → flipped to hyphen `acme-card`.** A `type=` value is the
  `<script type>`/`<input type>` is-a idiom (#1983), whose native values are bare/slash-MIME and **never** colon;
  colon-in-value reopens the no-native-analog defect #1983 closed and would contradict
  `we:docs/agent/block-standard.md:382-385`. #1913's `owner:intent` colon is an intent-ID JSON-key ruling, out of
  scope for `type=` values. Hyphen preserves RFC 6648 ownership-not-status without the defect.
