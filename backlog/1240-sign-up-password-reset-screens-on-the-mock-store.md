---
kind: task
parent: "1237"
status: open
locus: plateau-app
blockedBy: ["1238"]
dateOpened: "2026-06-20"
tags: [plateau, plateau-app, logged-off, auth, sign-up, password-reset]
---

# Sign-up + password-reset screens (on the mock store)

S3 of #1237. Add the remaining unauthenticated auth screens beyond #1238's sign-in/out: a sign-up / registration form and a password-reset request screen, both wired to the **mock** `authStore` (no real backend — registration just flips the simulated session, reset is a stubbed acknowledgement). New route templates in [plateau:index.html](../../plateau-app/index.html) alongside the existing `/login` template (~line 180-200) plus form handlers in [plateau:src/main.ts](../../plateau-app/src/main.ts) mirroring the existing `login`/`logout` pair (~line 115-131). Demoable: navigate from sign-in to sign-up / reset and round-trip through the mock store. Real identity backend is out of scope (deferred follow-on). Independent of S2/S4/S5.
