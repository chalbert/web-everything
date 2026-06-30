---
kind: decision
status: open
dateOpened: "2026-06-30"
tags: [naming, attribute-naming, webdirectives, block-standard, native-first, customattribute, decision]
---

# Attribute-naming convention — review colon namespacing (view:if) vs native-shaped alternatives; audit existing block/behavior/directive attr names

Cross-cutting naming review triggered by #1983/#1986. WE uses colon-namespaced attribute names (`view:if`, `view:switch`, `view:show`) and colon directive/comment names (`resource:loader`, `snippet:define`) — but colons in HTML attributes exist only in XML/foreign content (`xml:lang`, SVG `xlink:href`); **no native attribute looks like `view:if`**. Audit every block/behavior/directive/comment attribute name and decide a standards-shaped convention: keep colon (framework-ish, Vue/Angular), hyphen-prefix (`data-*`/`aria-*` native namespacing), or bare. Feeds #1986's `type=` **value** namespacing and #1983's deferred namespace concern. Open — needs prep (audit + prior-art survey + skeptic).

> **Status: open — needs prep.** Sketched from the #1983/#1986 discussion (2026-06-30); not yet researched
> (no audit, no prior-art survey, no skeptic). Run `/prepare 1987` before ratifying.

## Why now

The #1983 directive-form work picked `type=` as the discriminator (`<template type="if">`) precisely because
**`view:if`-style colon attributes have no native analog**. That exposed a broader question WE has never ruled
on: **what is the standards-shaped naming convention for WE's own attributes/names across the catalog?** It is
cross-cutting (blocks, behaviors, directives, comment directives all draw on the same attribute/name space), so
it gets its own decision rather than being re-litigated per feature.

## Scope — audit first (the prep's main job)

Enumerate every WE-authored attribute/name and bucket by current spelling:
- **Colon-namespaced** — `view:if`, `view:switch`, `view:show` (`CustomAttribute` names,
  `fui:blocks/view/registerViewDirectives.ts:13-17`); comment/directive names `resource:loader`,
  `snippet:define`, `control:*` (the `ns:name` grammar, `fui:plugs/webdirectives/CustomCommentParser.ts:34`).
- **Hyphenated / bare** — `for-each`, `content-security`, `data-bind`, block attributes (`variant`, etc.).
- **`type=` values** — the #1986 directive kinds (`type="if"`, `type="for-each"`).

## The fork (sketch — not yet researched)

- **Fork — the namespacing convention.** (a) **hyphen-prefix** (`control-if`, `we-if`) — mirrors the platform's
  *own* extension namespacing (`data-*`, `aria-*`), arguably most standards-shaped *(provisional lean)*; (b)
  **bare** (`if`, `each`) — cleanest but collision-prone with future native attrs/values; (c) **keep colon**
  (`view:if`) — framework-familiar but no native analog (the trigger for this review). Decide per *surface*:
  attribute **names**, comment-directive **names**, and `type=` **values** may not all want the same answer
  (e.g. bare `type` values like `<script type="module">` vs prefixed third-party values).

## Prep checklist (for `/prepare 1987`)

- Prior-art: how the platform namespaces extensions (`data-*`, `aria-*`, `x-` historically), custom-elements'
  hyphen requirement, the WHATWG/OpenUI custom-attributes / "enhancements" discussions; how Vue/Angular/Alpine
  spell theirs (and why those are explicitly *non*-standard).
- The audit table above, filled from the real tree.
- Per-fork classification + skeptic pass; set `preparedDate`.

## Relationships

- **Feeds** #1986 (the `type=` *value* namespacing) and #1983 (the deferred `view:`-vs-`control:` namespace
  concern — both now route here).
- Surfaced from the #1983 prep discussion (2026-06-30); see `we:reports/2026-06-30-directive-authoring-forms.md`.
