---
kind: story
size: 3
parent: "1254"
locus: plateau-app
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "plateau:src/control-plane/dashboard.ts"
tags: []
---

# plateau-app Control Plane dashboard onto FUI badge/status block

Migrate the Control Plane dashboard (plateau:src/control-plane/dashboard.ts) off hand-rolled DOM onto FUI status badges + tables. Ratchet release of #1254 now that the FUI badge/status gap #1288 shipped. Gates on a rendered a11y/visual check per first-party-dogfood.

## Progress (batch-2026-06-22-1510-1483)

Migrated the Control Plane dashboard (`plateau:src/control-plane/dashboard.ts`) status indicators onto the FUI badge block (#1288), consumed like `plateau:src/main.ts`'s `registerNavigation` (bare tag `we-badge`, #841):

- **Gate severity** — the hand-rolled `<span class="cp-sev cp-sev--${gateType}">` → `<we-badge tone="${GATE_TONE[gateType]}">`, mapping the `GateType` vocabulary (advisory/validating/escalating/blocking) onto the FUI badge tone scale (`info`/`neutral`/`warning`/`error`).
- **Deploy verdict** — the hand-rolled `.cp-verdict-dot` → `<we-badge tone="${VERDICT_TONE}" status>` (`status` → `role="status"` + tone-word `aria-label`, so meaning is not colour-only); the callout tint stays.
- Removed the dead `.cp-sev*` + `.cp-verdict-dot` CSS the badge now owns.
- **Test-infra fix:** added the `@frontierui/blocks` alias to `plateau:vitest.config.ts` (it had `@frontierui/plugs` + webdocs-ui but not `blocks`; no prior test imported a block element) — mirrors `plateau:vite.config.mts`.

**Gate green:** plateau `npm test` 259/259. **Rendered check (Playwright on :4000 `/control-plane`, logged-in):** 4 `we-badge`s all upgraded to `span.fui-badge`, the verdict badge carries `role="status"` (sample: "Blocked" / "Automated check" / "Needs sign-off") — 0 app console errors.
