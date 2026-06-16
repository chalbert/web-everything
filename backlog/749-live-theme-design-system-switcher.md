---
type: idea
workItem: story
size: 8
status: open
parent: "746"
blockedBy: ["747", "727"]
dateOpened: "2026-06-16"
relatedProject: webtheme
crossRef: { url: /backlog/364-unified-design-token-theming-system/, label: "webtheme tokens (#364)" }
tags: [webdocs, block-explorer, theming, design-system, switcher, container-query, rtl, a11y]
---

# Live theme / design-system switcher — swap design systems live and watch the same block adapt

Add a **design-system switcher** to the block page: pick from a gallery of popular-system presets (Material-like, Fluent-like, Carbon-like — each a #747 manifest) and watch the *same* block re-render under the new tokens + intent/trait defaults, with no code change. Round it out with the knobs that make the switch legible: A/B split-screen, a token-diff view, axis sliders (density/radius/spacing/contrast), native-state toggles (dark/light/high-contrast/forced-colors, respecting `prefers-*`), an RTL + locale toggle (`dir=rtl`, `Intl.Collator`), and a container-query simulator (#467) — drag the block's container and watch breakpoints fire.

## Build

- Switcher control bound to the #747 manifest registry; selecting a manifest swaps the active tokens + intent/trait defaults on the live render (#727).
- A/B split render + token-diff panel between two selected manifests.
- Axis sliders mapped to the relevant tokens/intents; dark/light/contrast/forced-colors + RTL/locale toggles.
- Container-query simulator: resizable block container (not viewport) driving the block's `@container` breakpoints.

## Acceptance

- [ ] Switching presets re-renders the same block under the new design system with no code change.
- [ ] A/B + token-diff, the axis sliders, the native-state toggles, RTL/locale, and the container simulator all drive the live render.
- [ ] A playground fixture exercises at least two contrasting presets on one block.

## Notes

Hard-blocked on **#747** (the manifest format the switcher loads) and **#727** (the live render to switch within). Axis sliders and native-state toggles resolve through tokens/intents owned by `webtheme` (#364) — don't coin parallel knobs.
