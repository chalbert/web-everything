---
kind: story
size: 3
status: active
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
locus: frontierui
relatedTo: ["2019", "867", "2130"]
relatedReport: reports/2026-07-02-a11y-ratchet-promotion-endgame.md
tags: [a11y, dogfood, fui-card, badge]
---

# Fix #2019 SSR-card dogfood a11y regressions: FUI badge --tone-warning contrast + nested-button entity decode

resolve(#2019) regressed 5 already-ENFORCED a11y routes on committed main (the ratchet lane npm run test:a11y is separate from check:standards, so nothing caught it). Two real defects: (1) FUI badge --tone-warning fallback #9a6700 on its own 12% tint = 4.17:1 < 4.5 AA (fui:blocks/badge/Badge.ts:95) — darken to ~#8a5c00 (4.90:1), impl-first in FUI, mirror we:src/css/style.css:1737; (2) we:src/_data/projects/webisolation.json description's entity-encoded button tag is double-decoded into a live nested button inside the interactive tile on / (axe nested-interactive) — fix card-body ingestion or escape at the WE data layer. Independent of #867's ratification; re-greens the enforced baseline.

## Scope

Impl-first in FUI, WE mirror second (per the zero-impl split — WE holds no fixes, only the mirrored
token value in its own stylesheet):

1. **Badge warning contrast** — `fui:blocks/badge/Badge.ts:95`: darken the `--tone-warning` fallback
   from `#9a6700` to ~`#8a5c00` (4.90:1 on the 12% tint). WE does not override `--tone-warning`, so
   the FUI fallback fix propagates to the docs site; mirror the literal in `we:src/css/style.css:1737`
   (`.fui-badge--warning`) so the two stay in lockstep.
2. **Nested interactive on `/`** — the FUI card block ingests `description` as HTML and double-decodes
   entity-encoded text, materializing `&lt;button&gt;` from
   `we:src/_data/projects/webisolation.json` as a live `<button>` inside the interactive tile.
   Fix the card-body ingestion in the FUI render path (stop the double-decode) — escaping at the WE
   data layer is the fallback only if the render path is ruled correct.

## Acceptance

- `npm run test:a11y` green on all 10 currently-ENFORCED routes (`/`, `/adapters/`, `/blocks/`,
  `/intents/`, `/protocols/` are the 5 red today — serious color-contrast + nested-interactive).
- No WE-side style fork: the WE mirror carries the same value as the FUI fallback, not a divergent fix.

Full measurement + route inventory: `we:reports/2026-07-02-a11y-ratchet-promotion-endgame.md` and the
agent-memory leaf `we:.claude/agent-memory/ssr-card-dogfood-regressed-a11y-ratchet.md`. Discovered
during #867 prep; #867's promotion of the 26 green warn-only routes does not depend on this fix, but
the ratchet's "each conversion proven clean" claim does.
