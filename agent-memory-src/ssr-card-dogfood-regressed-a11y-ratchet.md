# SSR card/badge dogfood (#2019) regressed the a11y ratchet baseline

Discovered working #867 (per-page rollout ratchet, the "full dogfood ratchet" #2130 depends on).

The a11y ratchet lane (`we:tests/a11y/rendered-site-a11y.spec.ts` + `sitemap-routes.ts`) is a
SEPARATE Playwright lane (`npm run test:a11y`), NOT part of `check:standards` — so a regression on the
enforced routes does NOT fail the resolve gate. It went red on committed `main` and nothing caught it.

Cause: `resolve(#2019)` (home/index SSR project grid onto `we-card` tiles, via
`scripts/lib/component-render-build-hook.cjs` → pinned FUI `component-render/cli.mjs` → `createCard`)
made status badges + card bodies render site-wide, surfacing two real defects that fail WCAG A/AA on the
already-ENFORCED routes:

1. **FUI badge `--warning` contrast** (the dominant blocker — hits ALL 4 catalog index routes:
   /intents 35 nodes, /protocols 27, /blocks 12, /adapters 1). `fui:blocks/badge/Badge.ts:95`
   `--tone-warning` fallback `#9a6700` on its own 12% tint (`#fdf4e3`) = **4.17:1 < 4.5 AA**. Darken the
   fallback to ~`#8a5c00` (4.90:1) — impl-first in FUI, then mirror `we:src/css/style.css:1737`
   (`.fui-badge--warning`). WE does NOT override `--tone-warning`, so fixing the FUI fallback fixes docs.

2. **Nested `<button>` on `/`** — `webisolation.json` `description` contains `&lt;button&gt;`; the FUI
   card block ingests the description as HTML and DECODES the entity into a LIVE `<button>` nested inside
   the interactive tile → axe `nested-interactive`. FUI card-body ingestion double-decodes entity-encoded
   description text. Fix in the card render path (FUI) or escape at the WE data layer.

Because the ratchet's own baseline is red, #867 can't be resolved as "each conversion proven clean" by a
mechanical promotion — the real scope is fixing these #2019 dogfood defects (impl-first FUI + WE mirror)
THEN promoting the now-clean warn-only routes into `ENFORCED_ROUTES`. Carried #867 rather than land a
partial (badge-only) fix that leaves `/` red and the tree mixed.
