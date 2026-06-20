---
kind: task
parent: "1237"
status: open
locus: plateau-app
dateOpened: "2026-06-20"
tags: [plateau, plateau-app, logged-off, auth, shell, routing, simulated-login]
---

# Public/app shell split + simulated login (navigate both spaces locally)

Phase-1 root slice of #1237. Split the app into a logged-off public shell and the existing authenticated sidebar shell, and add a **simulated** sign-in/out toggle so both spaces are reachable locally — no real identity backend. Re-enable the stubbed `requireAuth` guard in [plateau:src/main.ts](../../plateau-app/src/main.ts) (~line 80-86) so product routes gate on `authStore`'s `isLoggedIn`; reuse the existing mock `login`/`logout` handlers (~line 115-131). Add the logged-off layout + redirect logic (anonymous → landing/`/login`, logged-in → app) in [plateau:index.html](../../plateau-app/index.html) and `plateau:src/styles/layout.css`. Demoable: flip the toggle, see both shells. Root of S2–S5.
