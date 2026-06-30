---
kind: decision
status: open
dateOpened: "2026-06-30"
tags: [webdirectives, registration, custom-type-registry, customattribute, customcomment, block-standard, decision]
---

# Custom Type Registry family — CustomTemplateType + CustomScriptType as siblings of CustomComment (retire CustomAttribute as the directive registration path)

How directives/annotations are **registered** (not their *form* — [#1983](/backlog/1983-directive-form-standard-comment-vs-template-form-reconcile-t/) settles that). `is=`'s *concept* (a typed template dispatched through a registry) was right; only its *mechanism* (the Safari-dead customized built-in) was wrong. Proposal: a **`CustomTemplateType`** registry + a **`CustomScriptType`** registry (`<script type>` injector/context), as **siblings of the existing `CustomCommentRegistry`** — each extends a native inert container (`<template>` / `<script>` / `<!-- -->`) via `define`/`upgrade`/`whenDefined`. Retires `CustomAttribute` as the **directive** registration path (directives aren't behaviors — the #1983 directive-vs-behavior gate). #1983's directives register **through** `CustomTemplateType`.

> **Status: open — needs prep.** The forks below are *sketched from a design discussion*, not yet researched
> (no prior-art survey, no `/research/` topic, no skeptic pass). Run `/prepare 1986` before ratifying.

## Why this is separate from #1983 (and why now)

#1983 settled the directive **form** (the outer markup shape: attribute-on-`<template>` / comment-boundary /
annotation, off `is=`). This decision is the **registration mechanism** *underneath* that form — a separable
axis. It surfaced while reviewing #1983: the built directives `view:if` / `view:switch` / `for-each` register
via **`CustomAttribute`** (`fui:blocks/view/registerViewDirectives.ts:13-17`), i.e. the **behavior** registry —
which contradicts the directive-vs-behavior gate #1983 just added (directives control regions; behaviors
decorate connected elements). The contradiction lives in the *registration* layer, so it gets its own decision.

It is **broader than directives**: it also owns the `<script type="injector">` / context-provider annotation
mechanism (the Ⓐ form), so it can't be a child of the directive-catalog epic #1975 alone.

## The unifying pattern (the spine of the proposal)

WE already has **one** "extend a native inert container via a discriminator + a registry" mechanism:
`CustomComment` + `CustomCommentRegistry` (`fui:plugs/webdirectives/CustomComment.ts:27-34`,
`CustomCommentRegistry` `define`/`upgrade`/`whenDefined`). The proposal **completes the pattern** across the
three native inert containers:

| Native inert container | Discriminator | Registry | Status |
|---|---|---|---|
| `<!-- ns:name -->` | the `ns:name` comment grammar | `CustomCommentRegistry` | ✅ built |
| `<template …>` | a `type`-style attribute (spelling TBD) | **`CustomTemplateType`** | 🆕 proposed (replaces `is=` + the CustomAttribute path) |
| `<script type="…">` | the native `type` attribute | **`CustomScriptType`** | 🆕 proposed (injector / context) |

**Native-first honesty:** `<script type>` rides a *genuine* native extension point — the browser treats unknown
script types as inert data (importmap, speculationrules, `application/json`), so `CustomScriptType` is strongly
native-anchored. `<template type>` is weaker (`type` is not a native template dispatch) but **rhymes** with
`<template shadowrootmode>`, where the platform already keys template *processing* off an attribute — anchor the
template-type convention there, and be honest it's a WE convention, not a native hook like the script case.

## Forks to prepare (sketch — not yet researched/attacked)

- **Fork A — directive registration mechanism.** `CustomTemplateType` registry *(proposed default)* vs keep
  `CustomAttribute` (current built) vs the dead `is=`. Drivers: **semantic** (directives ≠ behaviors — the
  #1983 gate; CustomAttribute is the behavior registry), **perf** (template-scoped candidate set vs tree-wide
  attribute scan), **lineage** (keeps is='s typed-template concept without the Safari-dead substrate).
- **Fork B — one registry abstraction vs three siblings.** Three concrete sibling registries sharing a shape
  (`CustomComment` / `CustomTemplateType` / `CustomScriptType`) *(proposed default — separate-and-decouple)* vs
  one parameterized `CustomTypeRegistry` god-object. Probe over-abstraction vs duplication.
- **Fork C — `CustomScriptType` registry vs per-consumer `querySelectorAll('script[type=x]')`.** A registry
  earns its place only if there is shared lifecycle (parse / upgrade-on-insert / `whenDefined`); if consumers
  just query once, no registry needed. Resolve against the injector/context lifecycle.
- **Independent sub-question (not a fork): the discriminator spelling.** A template-type *registry* does **not**
  force a `type="view:if"` spelling — it can dispatch on the bare `ns:name` attribute and keep the nicer
  `<template view:if>` authoring form (matching Alpine/Vue/Angular). Separate *which registry* (Fork A) from
  *the attribute spelling* (this) — they are independent calls.

## Prep checklist (for `/prepare 1986`)

- Ground the existing **`<script type="injector">` / injector proposal** in the backlog + the `InjectorRoot`
  code (the context-provider routing in #1983 cross-refs the Context Protocol **#1968**) — build on it, don't
  re-derive.
- Survey prior art: native typed-script extension points (importmap / speculationrules / DSD
  `shadowrootmode`), and how other systems register template/script directives. Publish a `/research/` topic.
- Run the per-fork classification + skeptic pass; set `preparedDate`.

## Relationships

- **Mechanism for** #1983 (directives register through `CustomTemplateType`); #1983's *form* ruling stands
  independently of this.
- **Owns** the `<script type>` annotation (Ⓐ) mechanism referenced by #1983's context-provider routing → ties
  to Context Protocol #1968.
- Surfaced from the #1983 prep discussion (2026-06-30); see `we:reports/2026-06-30-directive-authoring-forms.md`.
