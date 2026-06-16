---
type: idea
workItem: story
size: 8
status: open
parent: "746"
locus: frontierui
blockedBy: ["747", "727", "809", "815", "775"]
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

**Re-homed to FUI-locus (#809).** This switcher is chrome inside the FUI-owned workbench (#815, the iframe+chrome distribution), driving the block host-side intra-FUI — not WE-owned chrome. `blockedBy #815`; built `@frontierui`. The token/intent dependency on webtheme (#364/#747) is unchanged.

## Blocked-in-fact — no concrete #747 manifest registry/presets to switch between (2026-06-16, batch-2026-06-16)

Pre-flighted in a batch top-up. The declared blockers (#747/#727/#809/#815) are resolved, but the build is
"switcher control **bound to the #747 manifest registry**" loading "Material-like, Fluent-like, Carbon-like
presets" — and that registry **does not exist**: #747 ratified the manifest *format* but `graduatedTo: none`
(no schema artifact, no preset gallery; grep of `plateau-app`/`frontierui` finds no design-system manifest
registry). Same unmaterialized-foundation gap that blocks its sibling [#751](/backlog/751-embedded-theme-design-system-creator-plateau/).
The creator/assembler that would produce those manifests is the still-open decision
[#775](/backlog/775-design-system-creator-assembler-open-core-layering-simple-fu/) — added `blockedBy: 775`.
**Systemic note:** the live-theming sub-cluster (#749 switcher, #751 creator, the token-provenance half of
#755) is collectively gated on materializing #747 into a concrete manifest schema + starter preset registry;
no item does that yet (#775 must ratify first). Not built here — that would pre-empt #775 by fiat.
