---
kind: story
size: 3
status: active
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
tags: []
---

# Smart/dynamic heading level for we-auto-heading (opt-in)

Opt-in mode where `<we-auto-heading>` computes its aria-level from sectioning-ancestor depth — the document-outline behaviour native HTML never shipped. Trivial under the #2028 host-is-node shape (set internals.ariaLevel, no tag swap). Ships as an OPTION, not the default; default remains an explicit level. Surfaced during #2028.
