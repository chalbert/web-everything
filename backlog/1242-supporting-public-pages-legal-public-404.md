---
type: idea
workItem: task
parent: "1237"
status: open
locus: plateau-app
blockedBy: ["1238"]
dateOpened: "2026-06-20"
tags: [plateau, plateau-app, logged-off, legal, 404]
---

# Supporting public pages — legal + public 404

S5 of #1237. Fill out the remaining public chrome for the logged-off shell: legal pages (terms of service, privacy policy) and a public 404 / not-found page for unmatched routes in the unauthenticated space. New `plateau:src/marketing/legal.ts` page module(s) + route templates in [plateau:index.html](../../plateau-app/index.html), plus footer/nav links from the #1238 logged-off shell, following the existing mount pattern in [plateau:src/main.ts](../../plateau-app/src/main.ts). Candidate to render from FUI components per the #777 dogfood goal. Demoable: legal pages render and the public 404 catches an unknown logged-off route. Independent of S2/S3/S4; depends only on the #1238 shell.
