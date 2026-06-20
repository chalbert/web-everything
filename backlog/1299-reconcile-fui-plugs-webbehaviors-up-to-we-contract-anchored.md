---
kind: story
size: 8
parent: "1250"
locus: frontierui
status: open
dateOpened: "2026-06-20"
tags: []
---

# Reconcile fui:plugs/webbehaviors UP to WE (contract-anchored)

Audit fui:plugs/webbehaviors vs contract+vectors, then reconcile CustomAttribute + CustomAttributeRegistry + index (3 content diffs) FUI-up, fixing any contract holes.

## Revised scope (grounded 2026-06-20, batch-2026-06-20-1297-1306) — size 2 → 8

The "3 content diffs" framing undercounts. Auditing the real drift (FUI vs WE + the resolved
decisions): WE is ahead on all three, and each is **contract-settled** (not a fork) —

- `CustomAttribute`: WE renamed the host property `target` → `ownerElement` per **#1121**
  (resolved 2026-06-19, ruled `ownerElement`, the `target` branch is broken). FUI still uses `target`.
- `CustomAttributeRegistry`: WE adds `whenDefined(name)` (**#1119**, resolved) + a `#assertValidName`
  hyphen/`:`-namespace check (**#1120**, resolved; spec `we:src/_includes/project-webbehaviors.njk:83`)
  that **throws** on bare names. FUI lacks both.
- `fui:plugs/webbehaviors/index.ts`: doc-comment follow-through (`ownerElement`, hyphenated examples).

The impl reconcile itself is ~3 files, but it **drags a consumer migration** that makes this an 8, not a 2:

1. **`target` → `ownerElement`** across FUI consumers — `fui:plugs/webbehaviors/__tests__/unit/CustomAttribute.test.ts`,
   `fui:plugs/webbehaviors/__tests__/unit/CustomAttributeRegistry.test.ts`, and demos `fui:demos/visibility-gate.ts`, `fui:demos/visibility-gate-heavy.ts`,
   `fui:demos/declarative-spa.html` (529L), `fui:demos/declarative-spa-jsx.tsx` (343L), `fui:demos/declarative-spa-unplugged.html` (616L).
2. **#1120 hyphen enforcement** then **throws at `define()`** on every bare name FUI currently uses —
   `ambient, auto, clickable, poll, reveal, sortable, sticky, toggle, tooltip` (tests) and
   `claim, counter, form, heavy, loan, policy, pulse, reveal, todo` (demos). Each rename touches the
   `define()` call **and** the element markup + companion config attrs (`reveal-when`, `poll-when`,
   `auto-when`, `sticky-when`) + querySelectors. A naive copy of the WE impl breaks 54 FUI unit tests and
   makes the SPA demo pages throw at runtime.

So this slice = a per-domain audit **+** a browser-verifiable demo migration (probe fui :3001), not a
mechanical 3-file copy. Best worked as a focused single item, not as batch fodder.

> **Cross-family caveat for #1250:** the drift map's "differ" count is **direction-agnostic and includes
> structural path diffs, not just feature drift** — e.g. webguards (#1302) "2 diffs" are almost entirely
> WE `../../guard/` vs FUI `../../blocks/guard/` import paths + doc comments, *not* a real feature gap. So
> the reconcile slices **cannot be done by copying WE files over FUI** (that breaks FUI's imports); each
> needs a per-file audit to separate repo-structural diffs from genuine drift. Re-scope the family
> (per-domain audit) before treating any as a clean size-2/3 batch item.
