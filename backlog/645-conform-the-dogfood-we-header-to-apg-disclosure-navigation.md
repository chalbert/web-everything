---
kind: story
size: 3
status: resolved
blockedBy: ["609", "644"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: src/_layouts/base.njk + src/css/style.css + src/assets/js/reveal-nav.js (APG Disclosure Navigation header)
relatedProject: webintents
tags: [navigation, disclosure, accessibility, apg, dogfood, header, graduation]
---

# Conform the dogfood WE header to APG Disclosure Navigation

Graduation follow-on of #609. The WE site header (we:base.njk:32-69, we:style.css:241-276) proves the reveal-nav recipe but is NOT yet APG-conformant: section heads are `<span aria-hidden>` with the panel disclosed on :hover/:focus-within only — no aria-expanded/aria-controls, no keyboard toggle, no Esc/outside-click dismissal, no focus return. Conform it to the W3C APG Disclosure Navigation pattern (the invariant ratified in #609): real button/aria-expanded/aria-controls semantics, keyboard toggle, Esc + click-outside dismissal, focus return, prefers-reduced-motion — while keeping the CSS-only :focus-within baseline working without JS (native-first, JS as progressive enhancement). This is the conform-to reference for the #644 conformance demo, so land it against that recipe.

## Progress (2026-06-15, resolved)

Restructured the header from one shared mega-panel (3 `<span aria-hidden>` column titles) into **three independent disclosure sections** — the faithful APG Disclosure Navigation shape (per-section, "disclosure-not-menu" per #609).

- **base.njk** — each section head is now a real `<button class="nav-menu-head" aria-expanded="false" aria-controls="nav-panel-{id}">` paired with its own `<div class="nav-menu-panel" id="nav-panel-{id}">`. `nav` got `aria-label="Main"`.
- **style.css** — rewrote `.nav-menu` to a flex row of `.nav-menu-section`s, each panel anchored under its own head. Reveal triggers: `:hover` (pointer sugar, always on — peek), `:focus-within` (keyboard baseline, **gated to `html:not(.js-nav)`**), and `[aria-expanded="true"]` (the explicit state). `prefers-reduced-motion` drops the translate. Mobile media query updated — sections stack as an inline accordion, head button as the section label.
- **reveal-nav.js** (new, wired in we:base.njk) — the progressive-enhancement layer: sets `.js-nav` on `<html>` (switching the keyboard reveal from `:focus-within` to aria-driven so **Esc can collapse while focus is still inside** the section), makes each head a click/Enter/Space **toggle** that closes siblings, **Esc** closes + returns focus to the head, outside click/focus dismisses, resize clears desktop state.

**Why the `.js-nav` switch:** an unconditional `:focus-within` reveal makes Esc impossible (focus stays in the section → panel can't hide). With JS we hand the keyboard reveal to `aria-expanded`; `:hover` stays pure CSS sugar so a mouse user still peeks (and a click pins).

Verified on the live dev server (:8080) via Playwright: click toggles open/closed with honest `aria-expanded`, opening closes siblings, Esc closes + focus returns to head, outside-click dismisses, hover reveals (aria stays false — SR users don't hover), no-JS `:focus-within` baseline preserved. `check:standards` + `build:check` green.
