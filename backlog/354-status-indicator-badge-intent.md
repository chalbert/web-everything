---
type: idea
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: "intent:status-indicator"
tags: [candidate-standard, exercise-app-discovery, intent, status, badge]
crossRef: { url: /backlog/314-flagship-exercise-apps/, label: "Surfaced by exercise-app work (#314)" }
---

> **Resolved 2026-06-12 — codified.** Graduated to the **Status Indicator** intent (`status-indicator`,
> `we:intents.json`, draft) — the visual member of the Web Lifecycle protocol ([#353]). Dimensions:
> `tone` (neutral|info|progress|positive|caution|critical), `shape` (badge|pill|dot|text), `affordance`
> (display-only|actionable). It owns the standing visual + a11y treatment; `live-region-status` keeps the
> announcement (they compose). Severity→token resolution is deferred to the theming/surface layer.

# Candidate standard — Status-indicator / badge intent (semantic state → visual + a11y)

Missing standard surfaced building the loan-origination app ([#317](/backlog/317-exercise-app-loan-origination/)).
The app is full of **status chips** — finding (Approve / Refer / Ineligible), document state, condition
state, lifecycle state — each hand-styled. There is **no semantic status-indicator standard**: a mapping
from a state + **severity** (positive / caution / negative / neutral) to a consistent visual treatment
(color, icon) **and** accessible treatment. `live-region-status` covers *announcements*, not the standing
visual badge. Small, clean, and pervasive across every enterprise app.

## What a standard would cover

- A `status` / `badge` **intent**: dimensions like severity (positive|caution|negative|neutral|info),
  emphasis (subtle|solid), and shape — with the a11y treatment (not color-only; text/`aria` label).
- Conformant tokens via the theming/surface layer so severity colors are not bespoke hex.

## Relations & open questions

- vs `live-region-status` (announce) — this is the standing indicator; they compose.
- Intent only, or intent + a small block? Token vocabulary ties to the `surface` intent.
