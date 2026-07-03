---
name: comment-directive-example-is-nonrendering
description: Comment-directive examples must be non-rendering (e.g. context provider) — if/for-each are template directives
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dd861edf-ccdb-4265-a724-1b9f1218f99b
---

When illustrating a **comment** directive (`<!-- ns:name -->` live form), do NOT use `if`/`for-each` — those are
**template** directives (typed `<template type=…>` form) per the established direction. The honest comment-directive
example is a **context provider**: pure behavior, **zero rendering effect**, no host element wanted.

**Why:** the whole reason a comment (non-element) directive must exist is the case where an element node would be
wrong — a `<div style="display:contents">` still participates in the a11y tree, selectors, and layout, so it's a
real workaround, not a neutral one. A directive that *renders/affects layout* (if/for-each) doesn't motivate the
comment form; a directive that affects **nothing visible** (context provider, behavior binding) does.

**How to apply:** reach for context-provider / behavior-binding when showing comment-directive syntax or its residue
markers; reserve if/for-each for template-directive examples. Relates to the residue-grammar decision [[#1989]] and
the open question of whether the comment-directive is a standard or a polyfill for a proposed nodeless-behavior node.
