---
type: idea
workItem: story
size: 8
status: resolved
parent: "746"
locus: frontierui
blockedBy: ["747", "727", "809", "815", "775", "871"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: frontierui/workbench/designSystems.ts (+ mount.ts design-system switcher panel + registry.ts token wiring — live preset swap, A/B, token-diff, axis sliders, native-state, RTL/locale, container-query simulator)
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

- [x] Switching presets re-renders the same block under the new design system with no code change.
- [x] A/B + token-diff, the axis sliders, the native-state toggles, RTL/locale, and the container simulator all drive the live render.
- [x] A playground fixture exercises at least two contrasting presets on one block.

## Notes

**Re-homed to FUI-locus (#809).** This switcher is chrome inside the FUI-owned workbench (#815, the iframe+chrome distribution), driving the block host-side intra-FUI — not WE-owned chrome. Built `@frontierui`. The token/intent dependency on webtheme (#364/#747) is unchanged.

## Prior blocks cleared (2026-06-17, batch-2026-06-17)

Earlier batch pre-flights re-blocked this twice on "no concrete manifest registry/presets to switch between" — both **now cleared**: #775 (the creator/assembler open-core decision) is resolved, #747 ratified the bundle shape, and #871 built the `we:designSystems.json` registry + `/design-systems/` catalog + validator. The switcher itself is FUI-resident (see Progress) so it never reads WE's registry at runtime — the #809/#815 boundary forbids a WE↔FUI channel — it consumes the #747 manifest *shape* with FUI-owned preset data.

## Progress

Done — built into the FUI block workbench (`frontierui/workbench/`, the #815 shell), verified end-to-end in a real browser on the live `:3001`.

- **`fui:workbench/designSystems.ts`** (new) — three contrasting FUI-resident presets in the **#747 manifest shape** (`{ extends, themeTokens, intentDefaults?, traitDefaults? }`): Material-like (rounded, indigo, lift), Fluent-like (subtle, blue, solid), Carbon-like (sharp 0-radius, dense, IBM-blue). `themeTokens` is resolved inline as `--wb-*` custom properties (not a DTCG path) because the workbench is same-origin FUI-owned with **no WE↔FUI channel** (#809) — it can't read WE's `we:designSystems.json` at runtime, so it consumes the manifest *shape* with its own data. Plus `tokenDiff()` for the diff view.
- **`fui:workbench/mount.ts`** — a "Design system" chrome panel: **preset gallery** (click → swaps tokens on the stage + sets the system's intent/trait defaults as `data-intent-*`/`data-trait-*` on the stage + re-renders the *same* block, no code change); **axis sliders** (density→`--wb-pad`, radius→`--wb-radius`, contrast→a `contrast()` filter); **native-state toggles** (colour-scheme system/light/dark, high-contrast, forced-colors-approx — "system" respects `prefers-*`); **RTL + locale** (`dir=rtl`, `lang`); **container-query simulator** (the rendered instance now lives in an inline-size `.wb-cq` container the toggle makes user-resizable, so `@container` rules fire on drag); **A/B split** (the same block under two presets side-by-side) + **token-diff** view.
- **`fui:workbench/registry.ts`** — the `auto-complete` styling now reads `--wb-radius`/`--wb-pad`/`--wb-font`/`--wb-shadow` so a preset swap is visibly different.

Acceptance met (all three boxes). **Playground fixture:** the live workbench page (`fui:/demos/workbench.html?block=auto-complete`) is the fixture — its A/B compare defaults to Material-like vs Carbon-like, exercising two contrasting presets on one block. **Verified:** `tsc --noEmit` (strict) clean; FUI `check:standards` 0 err/0 warn; a new e2e spec (`the design-system switcher … #749`) + all 8 workbench e2e specs pass against the live `:3001` (preset swap squares/rounds the corners, intent defaults surface on the stage, radius slider drives the render, dark scheme, RTL, the container becomes `resize: horizontal`, A/B renders two instances + a `--wb-radius` diff).
