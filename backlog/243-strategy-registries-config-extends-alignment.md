---
type: issue
workItem: story
status: open
blockedBy: ["227"]
dateOpened: "2026-06-09"
size: 5
tags: [refactor, registry, platform-config, render-strategy, change-strategy, consistency]
relatedProject: webcomponents
crossRef: { url: /projects/webcomponents/#protocol-render-strategy, label: Render Strategy Protocol }
---

# Align strategy registries to the config-extends-platform default model

Close-out leftover from #227. The ruling there established the canonical rule
(`[[feedback_config_extends_platform_default]]`): **the tool carries no default — the
default-strategy selection comes from a platform config the project extends**, via the core
`CustomRegistry` inheritance chain.

`blocks/renderers/jsx/render-strategy/CustomRenderStrategyRegistry.ts` **violates** this: it rolls its
own `Map` + `#defaultName` ("first registered becomes the default") + a `parent` pointer instead of
extending `CustomRegistry`. The default is baked into the tool.

## Scope

- **Refactor `CustomRenderStrategyRegistry`** to extend core `CustomRegistry` (own → extended chain);
  move the default-strategy selection (`declarative-static`) out of the tool and into a platform config
  flavor the project extends. Preserve nearest-scope-wins via the extends chain rather than a bespoke
  `parent`.
- **Audit `CustomChangeStrategyRegistry`** (Change Tracking, `webstates`) for the same anti-pattern;
  align if present.
- Sweep for any other registry that bakes a `#defaultName` / first-registered-wins default into the
  tool rather than inheriting it from an extended config.

## Done when

- Render-strategy registry extends `CustomRegistry`; no tool-baked default; default supplied by an
  extended platform config; existing render-strategy tests green.
- Change-strategy audited (aligned or documented as already-conformant).
- No remaining tool-baked strategy defaults outside an extends chain (grep clean).

Pure refactor — no behavior change for a project on the default flavor. Surfaced as a leftover from
#227, not part of that decision's scope.
