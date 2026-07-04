---
name: reserve-structure-for-real-families
description: "Don't over-apply a naming/collision rule — verify its native premise first, reserve namespace structure for genuine families, default to the simplest bare form"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 930cf907-9896-4bc1-aac0-c4b494f4e1ac
---

Don't over-apply a collision/namespace rule to names that don't need it. Native HTML joins multi-word
attribute names by **smashing** (`shadowrootmode`, `contenteditable`, `crossorigin`), **not**
hyphenating — bare hyphenated native attrs are two legacy cases (`accept-charset`, `http-equiv`) plus
the `data-*`/`aria-*` prefix families. So a bare single-hyphen author attr is **not** at meaningful
native-collision risk, and a colon on a *singleton* buys neither disambiguation nor readability.

**Why:** #1991 forked to pick `type-ahead`'s colon target under #1987's blanket "all behaviour attrs
colon-namespaced". Grounding the collision premise flipped it — the user reframed: colon is
**family-only**; a *family-less* behaviour keeps the simplest bare single-hyphen name (`type-ahead`
stays `type-ahead`), taking no colon. The recommended `list:type-ahead` was DevX cost for an invented
namespace with zero collision benefit.

**How to apply:** before applying a naming/collision rule broadly, grep the *actual* native convention
to test the rule's premise (don't assume "hyphen is dangerous"). Reserve structure (a colon namespace)
for where it earns its keep — a surface/domain with ≥2 related members. Family-less → simplest form; a
name that later gains a sibling colon-ifies then (a one-time mechanical rename). Codified in
`docs/agent/platform-decisions.md#attribute-name-colon-namespacing`. Related: [[propose-standard-in-platform-shape]],
[[internal-spelling-not-the-proposed-standard]], [[naming-fork-precedent-discipline]].
