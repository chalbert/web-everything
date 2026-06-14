---
type: issue
workItem: story
size: 3
status: open
blockedBy: ["609", "644"]
dateOpened: "2026-06-14"
relatedProject: webintents
tags: [navigation, disclosure, accessibility, apg, dogfood, header, graduation]
---

# Conform the dogfood WE header to APG Disclosure Navigation

Graduation follow-on of #609. The WE site header (base.njk:32-69, style.css:241-276) proves the reveal-nav recipe but is NOT yet APG-conformant: section heads are `<span aria-hidden>` with the panel disclosed on :hover/:focus-within only — no aria-expanded/aria-controls, no keyboard toggle, no Esc/outside-click dismissal, no focus return. Conform it to the W3C APG Disclosure Navigation pattern (the invariant ratified in #609): real button/aria-expanded/aria-controls semantics, keyboard toggle, Esc + click-outside dismissal, focus return, prefers-reduced-motion — while keeping the CSS-only :focus-within baseline working without JS (native-first, JS as progressive enhancement). This is the conform-to reference for the #644 conformance demo, so land it against that recipe.
