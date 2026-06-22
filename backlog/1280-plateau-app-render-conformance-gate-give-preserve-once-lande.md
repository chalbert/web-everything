---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "plateau:scripts/check-render-conformance.mjs"
tags: []
---

# plateau-app render-conformance gate — give 'preserve once landed' teeth (check:app-conformance analogue)

Build a check:-style gate that flags hand-rolled UI on plateau-app surfaces already migrated onto FUI, so the #1253 first-party-dogfood 'preserve once landed' clause is enforced, not just cited. Analogue of check:app-conformance for the exercise-app loop (#314): a migrated surface regressing back to document.createElement/bespoke CSS for a covered FUI pattern is a gated defect. Detection heuristic TBD (createElement/innerHTML density on migrated files vs an allowlist). Filed as the enforcement residual of the #1253 ratification; not a precondition for the charter.

## Progress (resolved 2026-06-22, batch-2026-06-22-1575-1030)

Built the gate as a **density ratchet** — the heuristic the card left "TBD", chosen to be low-false-positive
on a vanilla-TS app that is migrating *incrementally* (a flat "no createElement on migrated files" rule would
false-positive across the whole partially-migrated app):

- `plateau:scripts/check-render-conformance.mjs` auto-discovers **landed surfaces** (non-test `.ts` under
  `plateau:src/` that import `@frontierui/*` or render a `<we-*>` element — so a newly-migrated file is caught
  without a hand-edit) and measures each one's **hand-rolled-UI density** (`document.createElement(` + raw
  `.innerHTML =` + `insertAdjacentHTML(`; a line tagged `// RENDER-CONFORMANCE-OK: <reason>` is exempt).
- It fails only when a landed surface's density **rises above its committed baseline**
  (`plateau:scripts/render-conformance-baseline.json`, 16 surfaces) — a real regression, the "preserve once
  landed" semantics — or when a newly-landed surface isn't yet baselined (forces a review + `--update`). The
  baseline only ratchets **down** as migration progresses. Mirrors the #763 a11y warn→enforce ratchet.
- Wired as `npm run check:render-conformance` (+ `-- --update` / `-- --json`), and a vitest smoke test
  (`plateau:src/render-conformance.test.ts`) runs it under `npm test` so a regression fails the suite too.

Verified: gate green over 16 landed surfaces; **proved it catches a regression** (injected a createElement+
innerHTML into a baselined file → exit 1 with the right message; reverted → green); all 316 plateau-app unit
tests pass.

## Acceptance

- [x] A gate flags hand-rolled-UI regression on already-migrated plateau-app surfaces (#1253 "preserve once landed").
- [x] Low false-positive on the partially-migrated app (ratchet vs baseline, not a blanket ban).
- [x] Runs in plateau-app's check flow + enforced by `npm test`; proven to catch a real regression.
