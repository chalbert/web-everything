---
kind: story
size: 5
parent: "1522"
status: resolved
locus: plateau-app
blockedBy: ["1804"]
dateOpened: "2026-06-23"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: "plateau-app:tools/explorer/oracles/intentConformance.ts"
tags: []
---

# Intent-conformance oracle for the explorer (declared-intent vs reality)

Folded from #1642 (intent/a11y conformance inspector — not a standalone inspector). The net-new delta over the explorer's existing oracles is the intent-vs-reality check: read the page's declared intents (density/motion/a11y level) and flag where the running page diverges from its own declaration. Rides the explorer's existing collector + judge + finding pipeline (`plateau-app:tools/explorer/oracles`); the generic-a11y portion is already delegated to genericInvariants/layoutOverflow + axe — do not rebuild. Blocked by #1791 (the declared-intent exposure + reality-measurement contract).

## Progress (resolved batch-2026-06-26-1793-1697)
Built the UX-intent-conformance oracle on the existing Layer-1 pipeline, density+motion per the #1791 ruling:
- **`plateau-app:tools/explorer/oracles/observation.ts`** — extended `Observation` with two narrow optionals: `declaredIntent` (`{density, motion}` read from `data-intent-*`) + `intentReality` (`{medianGapPx, animationsActiveUnderReduce}`).
- **`plateau-app:tools/explorer/oracles/intentConformance.ts`** (new) — the pure `intent-conformance` `Oracle`: density divergence (median inter-element gap vs the declared level's `interElementGap` band, embedding the #1804 bands from `we:src/_data/intents/density.json` per the #1791 constellation — WE owns the bands, plateau owns the measurer) + motion divergence (animations still `running` under emulated `prefers-reduced-motion: reduce`, gated on a declared motion intent so it's intent-conformance, not a re-badged generic check). Advisory `warn`s. Registered in `LAYER1_ORACLES`.
- **`plateau-app:tools/explorer/oracles/playwrightCollector.ts`** — `#intentProbes()` populates the reality fields: declared-attr read + median sibling-gap measurement in one `page.evaluate`, and a motion read under `emulateMedia({reducedMotion:'reduce'})` (set → sample running animations → reset, so the walk's media state is unchanged); only run when a motion intent is declared.
- **Tests** — `plateau-app:tools/explorer/oracles/__tests__/intentConformance.test.ts` (11 cases: in-band silence, tighter/looser warns, unknown level skip, motion-under-reduce, no-double-badge, both-at-once, band-sync) + updated the `LAYER1_ORACLES` roster assertion. 47/47 oracle tests pass; 0 tsc errors in `tools/explorer`. Density-reality unblocked by #1804 (resolved this batch).

> **Contract ruled (#1791, 2026-06-26).** This is a **UX-intent-conformance** oracle over **density + motion** (intents are UX-only). (1) **Exposure** reuses the existing root `data-intent-*` attributes (`plateau:src/dev-browser/intent-inspector/inspect.ts` — `readIntentProfile()`); no new mechanism. (2) **Reality fields** live on the existing `Observation`; the declared profile + measured-reality are narrow optionals populated by the existing collector. (3) **Motion reality** = a second observe-time `emulateMedia({reducedMotion:'reduce'})` render flagging still-active non-semantic animation (a named cost — the collector can't replay, #1525); **buildable now.** (4) **Density reality** = a spacing/whitespace ratio bucketed into the declared bands (NOT a touch-target floor — that re-badges WCAG/axe); **gated on #1804** (`we:density.json` needs quantified spacing bands) — hence `blockedBy: ["1804"]`. (5) **a11y-level is NOT an axis of this oracle** — a WCAG conformance tier is a technical platform-config value, not a UX intent; absolute axe already covers it, and a declared-relative overclaim is the conformance-lane follow-up #1805 (maturityGated). Re-pointed `blockedBy: ["1791"]→["1804"]`; motion-reality + declared-profile read + the `Observation` extension can be pulled forward by splitting this story if desired.
>
> **Pre-flight (batch-2026-06-26-1732-1696):** two corrections. (1) **Locus** was `frontierui` but the explorer lives in `plateau-app/tools/explorer/oracles` — re-pointed to `locus: plateau-app`. (2) The stated gate **#1689 does not expose these intents** — it delivered a conformance/visibility/validation *rule* registry (`plateau:src/dev-browser/declared-rules/`), not a density/motion/a11y-level *intent* exposure. No mechanism exposes a page's declared density/motion/a11y-level, and the per-dimension reality-measurement is undecided. Building the oracle requires inventing that contract — surfaced as decision **#1791** and re-pointed `blockedBy: ["1791"]`. Released unbuilt.
