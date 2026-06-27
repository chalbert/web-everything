---
name: project_vite_config_plugin_no_alias
description: "A vite resolve.alias never rewrites the config's own plugin imports — share build-time plugins via sibling path / real package, not a named alias"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4fc42da4-65dc-41fc-a2cc-66537b6785fc
---

`resolve.alias` in a `vite.config` rewrites only the **app's** module graph (the dev server's
served modules). It does **not** touch the config file's **own top-level imports** — those resolve
*before* the config is evaluated, via Vite's esbuild config loader. So a **build-time plugin**
(`import { devPanel } from '…'` consumed in the config) can never go through `resolve.alias`.

Consequence for sharing a dev/build plugin across the [[reference_repo_constellation]]: a bare
named specifier (`@plateau/dev-panel`) would require a **real installed package** (its own manifest
+ a local-path dependency + `npm install` in each consumer) — overkill for a small zero-dep file.
The lightweight, equally-escapable (dev-only) form is a **direct sibling-path import**
(`../plateau-app/tools/dev-panel/vite-plugin`), riding the same `../<sibling>` checkout assumption
the `@frontierui/*` / `weRoot` aliases already depend on. This is the single-Plateau-copy mechanism
#1579 landed.

**Why:** this flipped the initial "alias it like `@frontierui/plugs`" plan mid-execution — plugs is
*app* code (alias works), a plugin is *config* code (alias is inert). [[project_dev_panel_plugin_duplicated]]

**How to apply:** when [[project_managed_offering_constellation_layering]] / #1565 devtools-placement
relocates another build-time plugin to a single home, reach for a sibling-path import (or a real
package only if a version boundary is genuinely wanted) — never a `resolve.alias` entry. Aliases
remain correct for *app-consumed* modules.
