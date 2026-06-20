---
kind: task
parent: "1237"
status: open
locus: plateau-app
blockedBy: ["1238"]
dateOpened: "2026-06-20"
tags: [plateau, plateau-app, logged-off, pricing, monetization]
---

# Pricing page (reads open-core rulings)

S4 of #1237. Build the public pricing page for the logged-off shell. The tier structure and copy **read** the already-ratified open-core monetization rulings (#089–#093, #775) — open is free, paid is licensed; it cites them rather than re-deciding pricing here (monetization is soft-accepted and revisitable, so no fork). New `plateau:src/marketing/pricing.ts` page module + a public route template in [plateau:index.html](../../plateau-app/index.html), following the existing mount pattern in [plateau:src/main.ts](../../plateau-app/src/main.ts). Candidate to render from FUI components per the #777 dogfood goal. Demoable: pricing renders in the public shell and links into sign-up. Independent of S2/S3/S5; depends only on the #1238 shell.
