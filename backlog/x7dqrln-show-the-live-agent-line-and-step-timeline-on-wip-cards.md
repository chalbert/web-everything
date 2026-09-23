---
kind: story
size: 3
parent: "x9ah1zb"
status: open
locus: plateau-app
blockedBy: ["x27g4f0", "xd47p14"]
dateOpened: "2026-09-22"
tags: []
---

# Show the live agent line and step timeline on /wip cards

plateau:src/wip/wip-view.ts renders the live L1 line (role · phase · rail · current step · elapsed) and, when a card is opened, the L2 timeline (run tabs, folded phase groups, last 5 steps of the live group). The page watches L1 while visible and a card while it is open. States 1–3, 5–7, 10, 11, 13–15, 17–19 of plateau:docs/wip-live-agent.md §5. Match the mock plateau:docs/mocks/wip-live-agent.html.

## Done when

1. **Executable** — `npx vitest run src/wip` renders each listed state from fixtures, one test per state number in §5 of the design doc.
2. **Executable** — a Playwright check at 390px against the running dev server shows no horizontal page scroll with a 40-step run open, in light and dark.
