---
type: issue
workItem: story
size: 2
status: resolved
blockedBy: ["763"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: "./AGENTS.md (DoD a11y checklist; mirrored in ../frontierui/AGENTS.md)"
tags: []
---

# DoD 'website-change' a11y checklist in both repos (WE + FUI)

Fold a Definition-of-Done 'website-change' checklist into both repos' DoD docs (webeverything + frontierui): any change touching rendered pages/templates must pass the rendered-site a11y gate and review the structural a11y checklist (aria-current, landmarks, focus order, names). The human-review backstop alongside the automated axe gate (#770/#771) and static lint (#772). Ratified in #763 as supported-not-decided.

## Progress (2026-06-16, batch-2026-06-16) — built

- **WE** — added a "Changed a rendered page, template, or layout" item to the Definition of Done in [we:AGENTS.md](../AGENTS.md): must pass the #770 rendered axe gate (`npx playwright test tests/a11y`) + the #772 static lint, plus a hand-reviewed structural checklist (aria-current #762, landmarks, heading order, focus order/`:focus-visible`, accessible names, no colour-only contrast cues).
- **FUI** — mirrored the same DoD item into `fui:../frontierui/AGENTS.md`, pointing at the #771 mirrored gate (FUI site `:3001`).
- The human-review backstop alongside the automated axe gate (#770/#771) and static lint (#772), per #763 (supported-not-decided).
- **Verified:** `check:standards` green in **both** repos (0 errors).
