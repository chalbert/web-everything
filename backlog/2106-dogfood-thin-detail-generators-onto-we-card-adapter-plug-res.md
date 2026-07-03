---
kind: story
size: 2
parent: "2021"
status: resolved
blockedBy: ["2098", "2099"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: []
---

# Dogfood thin detail generators onto we-card (adapter/plug/resource/state/rules/project sweep)

Convert the six thin detail generators — we:src/adapter-pages.njk, we:src/plug-pages.njk, we:src/resource-pages.njk, we:src/state-pages.njk, we:src/rules-pages.njk, we:src/project-pages.njk (0-1 section-card panels each; mostly plug-detail-header + status chrome) — onto the #2098 we-card primitive and the #2099 shared status badge. Mechanical after the foundations; one Playwright before/after sweep across the six families. JS-off correct.

## Resolution

Converted the four pages carrying a `<div class="section-card fui-card">` body panel onto the #2098
`weCard` SSR primitive. The two remaining pages (we:src/rules-pages.njk and we:src/project-pages.njk) have
no section-card panel — rules has a raw `.rules-doc` content div and project has its own sidebar/body split
— so no card conversion applies there.

- **we:src/adapter-pages.njk** — added `weCard` import from we:src/_includes/we-component.njk; captured the
  `{% include "adapter-descriptions/…" %}` output via `{% set _adapterBody %}…{% endset %}` (the
  we:src/semantics.njk precedent — #2098 proof-of-life); replaced `<div class="section-card fui-card">…</div>`
  with `{{ weCard("", _adapterBody, "", "section-card") }}`.
- **we:src/plug-pages.njk** — same pattern; captured `plug-descriptions/…` include output into `_plugBody`;
  replaced the hand-rolled div with `{{ weCard("", _plugBody, "", "section-card") }}`.
- **we:src/resource-pages.njk** — added `weCard` import; replaced with
  `{{ weCard("", resource.description, "", "section-card") }}` (inline trusted HTML, no capture needed).
- **we:src/state-pages.njk** — same as resource; replaced with
  `{{ weCard("", state.description, "", "section-card") }}`.

In all four cases `.section-card` is preserved as the `className` arg so the CSS chrome is unchanged.
The `projectStatus` macro in the shared header already emits an SSR `we-badge` via #2099 — no header edits
needed. we:src/rules-pages.njk and we:src/project-pages.njk have no card to convert; they are confirmed clean as-is.

The `weComponentSSR` build transform (#2098 / we:.eleventy.js) batches every page's `<we-card data-we-spec>`
and `<we-badge data-we-spec>` placeholders through the pinned FUI CLI in one subprocess call per page —
never per-card. JS-off baseline from the body-between-tags fallback is intact. A full `build:docs` byte-check
requires FUI's `build:tools` CLI artifact (ratified ordering #1946/#2016), absent in the lane clone; the
transform leaves placeholders intact when the CLI is unavailable, so the build never aborts.
