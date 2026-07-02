---
kind: story
size: 2
status: open
dateOpened: "2026-07-02"
tags: []
---

# Automate the AI visual-baseline validation gate (don't leave it as judgment)

Standing rule (user, 2026-07-02): any `toHaveScreenshot` baseline that changes must be AI-validated — the agent looks at old vs new and confirms the diff IS the intended change before the new baseline is committed, never a blind `check:visual:update`. Right now that is a judgment step (the same hookable-vs-judgment gap, #51, that recurs). Make it enforced: e.g. a `check:visual` failure writes the diff PNG + the old/new pair to a known path, and accepting a baseline update requires a reviewed PR that carries the before/after and an explicit AI verdict — a bare snapshot-only diff is blocked otherwise. Surfaced while refreshing the home baseline after the orange-gradient + card changes.
