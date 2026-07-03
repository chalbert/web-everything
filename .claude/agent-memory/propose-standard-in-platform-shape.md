---
name: propose-standard-in-platform-shape
description: "When WE proposes an extension, shape its markup/API like the closest EXISTING native standard — discriminator-spelling test"
metadata: 
  node_type: memory
  type: project
  originSessionId: 725cecbb-2264-47af-bc02-327be61f27af
---

A WE-proposed extension must take the **shape of the closest existing native standard**, not a framework
convention — "could it become a standard *in its shape*" is a hard gate on the markup/API spelling, separate
from [[native-first-default]] (which governs *defaults/values*) and [[plug-as-proposed-standard]] (which
governs *whether* it's a proposed standard).

Worked test (from #1983 directive-form ruling, codified `we:docs/agent/block-standard.md#directive-form`):

- **Reuse the platform's `type=` "is-a kind" discriminator** for an open registry of kinds on an inert
  container — `<template type="if">` mirrors `<script type="module">` / `<input type="checkbox">`. `<script
  type>` is the canonical "open kind registry on an inert container," so it's the direct precedent.
- **Reject colon-namespaced attributes** (`view:if`): colons in HTML attributes exist only in XML/foreign
  content (`xml:lang`, SVG `xlink:href`) — **no native attribute looks like `view:if`**; `v-if`/`*ngIf` are
  explicitly *framework* conventions, the opposite of standards-shaped.
- **Don't mint top-level attribute names for an extensible set** (`<template if>`, `<template each>`) — the
  platform reserves those for itself; that's *why* `data-*`/`aria-*` exist. Extensible third-party kinds live
  in a **value space** (`type="…"`), not the attribute-name space.
- **Match the *kind* of construct, not a surface rhyme**: `<template shadowrootmode>` is a *mode* (adjectival,
  has-a), so it's the WRONG precedent for an *is-a kind* discriminator — pick the precedent whose semantics
  match.

**Why:** acceptance ("would a browser ship it") is necessary but not sufficient; the durable test is whether
the *shape* already exists in the platform's vocabulary, so the proposal reads as a natural extension a WG
could adopt. The user overturned an initial `type=`-rejection on exactly this ground — grounding the shape
against real native idioms (`<script type>`, `data-*`, `shadowrootmode`) flipped the call.

**How to apply:** before choosing any new WE attribute/element/value spelling, name the *closest existing
native standard* and imitate its shape; if the candidate has no native analog (colons) or usurps platform
namespace (top-level attrs), it fails. Verify against real platform idioms, don't reason from frameworks.

**Scope — "reject colon" governs the PROPOSAL shape, not the internal authoring spelling:** #1987 ratified
*keeping* colon for behavior/event attribute **names** (`on:click`) — but only as a collision-safe **internal**
spelling that WE explicitly does **not** claim as its platform-shaped proposal (the proposed shape is hyphen
`enh-*`, deferred while unshipped). The "no colon" gate above still holds for what WE *proposes*; it does not
forbid a colon *internal* marker. See [[internal-spelling-not-the-proposed-standard]] for that two-identity
split. Worked follow-on this principle governed: [[custom-type-registry-family]] (#1986 `CustomTemplateType` /
`CustomScriptType`); attribute-naming review **#1987 resolved** (Fork 2 `type=` values → `owner-kind` hyphen).
