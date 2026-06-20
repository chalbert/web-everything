---
kind: task
parent: "1237"
status: open
locus: plateau-app
blockedBy: ["1238"]
dateOpened: "2026-06-20"
tags: [plateau, plateau-app, logged-off, landing, marketing]
---

# Landing / marketing page (public first screen)

S2 of #1237. Build the public landing page a logged-off visitor lands on — hero, value proposition, and product overview for the Plateau enterprise front-end platform. Mounts inside the logged-off shell from #1238 (its public `/` or `/home` route template in [plateau:index.html](../../plateau-app/index.html)), as a new `plateau:src/marketing/landing.ts` page module following the existing mount pattern in [plateau:src/main.ts](../../plateau-app/src/main.ts). Candidate to render from FUI components per the #777 dogfood goal (net-new screen, no legacy). Demoable: the page renders and links into sign-in / pricing. Independent of S3–S5; depends only on the #1238 shell.
