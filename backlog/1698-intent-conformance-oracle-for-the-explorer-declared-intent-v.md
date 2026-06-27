---
kind: story
size: 5
parent: "1522"
status: open
locus: plateau-app
blockedBy: ["1804"]
dateOpened: "2026-06-23"
dateStarted: "2026-06-26"
tags: []
---

# Intent-conformance oracle for the explorer (declared-intent vs reality)

Folded from #1642 (intent/a11y conformance inspector — not a standalone inspector). The net-new delta over the explorer's existing oracles is the intent-vs-reality check: read the page's declared intents (density/motion/a11y level) and flag where the running page diverges from its own declaration. Rides the explorer's existing collector + judge + finding pipeline (`plateau:tools/explorer/oracles`); the generic-a11y portion is already delegated to genericInvariants/layoutOverflow + axe — do not rebuild. Blocked by #1791 (the declared-intent exposure + reality-measurement contract).

> **Contract ruled (#1791, 2026-06-26).** This is a **UX-intent-conformance** oracle over **density + motion** (intents are UX-only). (1) **Exposure** reuses the existing root `data-intent-*` attributes (`plateau:src/dev-browser/intent-inspector/inspect.ts` — `readIntentProfile()`); no new mechanism. (2) **Reality fields** live on the existing `Observation`; the declared profile + measured-reality are narrow optionals populated by the existing collector. (3) **Motion reality** = a second observe-time `emulateMedia({reducedMotion:'reduce'})` render flagging still-active non-semantic animation (a named cost — the collector can't replay, #1525); **buildable now.** (4) **Density reality** = a spacing/whitespace ratio bucketed into the declared bands (NOT a touch-target floor — that re-badges WCAG/axe); **gated on #1804** (`we:density.json` needs quantified spacing bands) — hence `blockedBy: ["1804"]`. (5) **a11y-level is NOT an axis of this oracle** — a WCAG conformance tier is a technical platform-config value, not a UX intent; absolute axe already covers it, and a declared-relative overclaim is the conformance-lane follow-up #1805 (maturityGated). Re-pointed `blockedBy: ["1791"]→["1804"]`; motion-reality + declared-profile read + the `Observation` extension can be pulled forward by splitting this story if desired.
>
> **Pre-flight (batch-2026-06-26-1732-1696):** two corrections. (1) **Locus** was `frontierui` but the explorer lives in `plateau-app/tools/explorer/oracles` — re-pointed to `locus: plateau-app`. (2) The stated gate **#1689 does not expose these intents** — it delivered a conformance/visibility/validation *rule* registry (`plateau:src/dev-browser/declared-rules/`), not a density/motion/a11y-level *intent* exposure. No mechanism exposes a page's declared density/motion/a11y-level, and the per-dimension reality-measurement is undecided. Building the oracle requires inventing that contract — surfaced as decision **#1791** and re-pointed `blockedBy: ["1791"]`. Released unbuilt.
