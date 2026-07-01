---
kind: story
size: 5
status: open
dateOpened: "2026-07-01"
tags: [theme, design-tokens, fui, webtheme, keystone]
---

# Runtime alias co-emit: FUI injector emits the semantic-alias tier at every themed scope (#2026 b′)

Ratified by #2026: relocate LEGACY_ALIASES into fui:plugs/webtheme/ (FUI-owned single source) and make applyTokenVars co-emit the --<family>-* semantic-alias tier alongside canonical --token-* onto whatever scope element it themes (:root or a component host). Browser-proven: a :root-only alias can never forward a component-scoped --token-* override, so the alias must be co-emitted at the target scope. This is the keystone that makes theming at any scope work and unblocks the #2017 loader acceptance. Alias derives one-way from the single source (satisfies #tokens-js-first).
