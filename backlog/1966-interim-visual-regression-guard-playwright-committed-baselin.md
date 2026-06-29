---
kind: story
size: 5
parent: "800"
status: resolved
dateOpened: "2026-06-29"
dateStarted: "2026-06-29"
dateResolved: "2026-06-29"
tags: []
---

# interim visual-regression guard: Playwright committed-baseline before/after over key WE-docs pages (the #1895 incident; #799 option-C bootstrap)

Stand up the **interim visual-regression guard** #799 endorsed as the bootstrap (committed baselines via
Playwright `toHaveScreenshot`, before the deferred plateau-hosted visual service). `npm run check:standards`
doesn't render, so a CSS/template regression ships green — exactly how #1895 stripped the `.fui-card` frame
off `/backlog/NNN/` and ~14 other pages undetected. `@playwright/test` is already a dep (its built-in
snapshot baselines need no new package). Deliver a `@playwright/test` spec over a **curated set of key WE-docs
pages** (home, `/backlog/`, a `/backlog/NNN/` detail, a `/project/*` page, a demo, a catalog list) that
captures `toHaveScreenshot` baselines, masks dynamic content (dates, live counts), runs against the
already-running dev server (detect-or-skip the `devServerProbe` port, never spin/kill one), and fails on
diff. Wire an `npm` script (e.g. `check:visual`) + document the before/after discipline for UI-touching items
in the close-out. Motivating incident: the #1895 reopen note.

## Scope
1. A `@playwright/test` visual spec + curated page list (extensible config), committed PNG baselines.
2. Dynamic-content masking so baselines are stable (no churn on date/count changes).
3. Detect-or-skip against the running dev server (don't own the lifecycle).
4. `npm run check:visual` (baseline-refresh + check modes); document the UI-item close-out discipline.

## Done when
A UI-touching change that alters a shared visual surface (like #1895) fails `npm run check:visual` locally
before commit, with a diff image to eyeball; baselines live in-repo and refresh deliberately. (Gate
integration / the hosted plateau service stay deferred per #799 — this is the in-repo bootstrap only.)
