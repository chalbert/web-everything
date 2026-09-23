---
kind: story
size: 3
parent: "xj4ksy4"
status: open
scaffoldedBy: "graduation-page-file"
dateScaffolded: "2026-09-22"
blockedBy: ["xeudj65"]
scope: ["plateau:src/graduation/graduation-view.ts", "plateau:src/graduation/graduation-view.css", "plateau:src/main.ts", "plateau:docs/graduation-page.md"]
dateOpened: "2026-09-22"
tags: [delegation, graduation, operator-page]
---

# The /graduation page renders every state from the ask, linked from /wip

Build the agent graduation page in plateau-app from the ruled mock: a `/graduation` route mounted like /wip and /decide, fed by the `graduation` ask on the live socket (plateau:src/wip/wip-live.ts) on the deployed site and by `GET /api/graduation` on the dev server, keeping its last good answer on the phone for the offline state. Render the per-triple states, the Needs-you section, the agent cards, and The bar panel exactly as `plateau:docs/graduation-page.md` and `plateau:mocks/graduation/graduation-mock.html` specify, in both themes, at 390px and 900px+. Add a link to it from /wip's header.

## Notes

- Refine the ruled mock forward; do not redesign it. Every rule scoped `.grad …`. Escape every interpolated
  value. No Promote button (a promotion is a ratified decision).
- Page states 1–9 in the design doc are all required, including the degraded promotions case: Needs you shows
  `?` and "Unknown — not an all-clear", never "Nothing waiting on you".
- Stale copy: `localStorage` wrapped in try/catch; the page must render correctly without it.
- Relative ages are computed from the report's `asOf`, not the phone's receive time.
- Update the doc's "Review history" with what the sighted review found.

## Done when

1. **Executable** — `npx vitest run src/graduation` passes with view tests that fail before this lands: each
   triple state renders its glyph and words; an `invalid` promotions source renders `?` in the Needs-you chip and
   heading and the text "not an all-clear"; the stale state shows the copy's age; a hostile string in a
   `taskType` or `model` is escaped.
2. **Observable** — on a dev server started in the lane (a spare port, stopped by PID after), Playwright
   screenshots of `/graduation` at 390px and 1280px in light and dark show the real report with no horizontal
   scroll, and the /wip header links to `/graduation`.
3. **Clean gate** — `npx vitest run` passes in the lane.
