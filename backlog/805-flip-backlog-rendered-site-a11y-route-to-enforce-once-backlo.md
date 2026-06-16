---
type: issue
workItem: story
size: 1
status: open
dateOpened: "2026-06-16"
tags: []
---

# Flip /backlog/ rendered-site a11y route to enforce once backlog.njk color fixes land

The last route left warn-only when #793 flipped 9 of 10 WE-docs a11y routes to `enforce: true`. The `/backlog/` index's remaining color-contrast fixes are hard-coded hexes in `src/backlog.njk` (resolved-child `fg`, the `unsliced`/tier/type badges, the burndown projection legend) — that file was being edited concurrently by another session (the split-candidate feature), so #793 deliberately did **not** commit it. Once `src/backlog.njk`'s slate-500/slate-400 → slate-600 (`#475569`) color fixes land in a commit and `/backlog/` measures clean under axe, flip its entry in `tests/a11y/route-allowlist.ts` to `{ path: '/backlog/', enforce: true }`. Pure one-line ratchet completion; verify with `A11Y_ENFORCE=1 npx playwright test tests/a11y/rendered-site-a11y.spec.ts`.
