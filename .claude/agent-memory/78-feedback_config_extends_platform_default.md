---
name: feedback_config_extends_platform_default
description: Defaults live in a project config that extends a fully-defined platform config (multiple flavors); the tool/registry itself stays default-less
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fc9aa357-5e31-49d7-9614-c948d79317ad
---

For any configurable axis/strategy/registry, **the tool must not bake in a default.**
Instead, the platform ships one or more **fully-defined config flavors** (presets/profiles),
and a **project config extends one** of them. The effective default is whatever the extended
platform config supplies — resolved through the inheritance chain, never a constant in the tool.

This is already the canonical WE idiom: `plugs/core/CustomRegistry.ts` takes
`extends?: CustomRegistry[]` and resolves own → extended chain with **no default pointer at all**
("the default" = whatever the extended/platform registry provides). The whole `plugs/*` family
uses it. The outlier is `blocks/renderers/jsx/render-strategy/CustomRenderStrategyRegistry.ts`,
which rolls its own `Map` + `#defaultName` ("first registered becomes the default") — i.e. it
bakes the default into the tool. That divergence is the anti-pattern; align such registries to
`CustomRegistry`.

**Why:** mirrors how intents work — standardize the meta-schema, not the list; the platform
defines the contract + baseline flavors, the project brings/overrides the rest, conflict-free
([[project_intents_open_design]]). A tool-baked default is a hidden global the project can't cleanly
override and that pretends one end-state is privileged; a config-supplied default makes the choice
explicit, swappable, and inheritable. It also keeps "native-first" honest: the *strictest platform
flavor* sets the platform-aligned default (e.g. explicit registration), but the tool doesn't decide
that — the config does ([[feedback_native_first_default]]).

**How to apply:** when designing a strategy axis / registry (e.g. backlog #227 auto-define,
render-strategy, change-strategy), extend core `CustomRegistry` rather than inventing a registry;
express the default-strategy selection as a value in the platform config the project extends; ship
multiple platform flavors; leave the tool default-less. Same registry+adapter authoring shape as
elsewhere ([[feedback_authoring_standard_workflow]]). Applies to ALL such axes, not just the one
being worked.

**As a decision-fork tell (#370):** a fork that looks like "pick the default *value / set / strategy*"
(a reaction set, a render strategy, a collation) is usually really "mandate vs. config-driven open
default" — generalize it: default-less core + open registry / inherited-extensible platform setting,
the "sensible default" living in the platform **flavor** not the standard. A locked set and a
free-for-all then become *configurations*, not rival branches, and the fork shrinks to "what's the
flavor default" (often a one-line ratify). Codified in `backlog-workflow.md` (decision-authoring
section). This also **normalizes the render-strategy outlier above**: the *standard* mandates no render
strategy — it's inherited/extended from the platform config like everything else (#370 Forks 3 & 6 =
render strategy + reaction set, both collapsed to open config-driven platform settings). Pairs with the
"one Technical Configurator card per documented technical setting at graduation" rule
([[feedback_intent_ux_only_technical_to_configurator]]).
