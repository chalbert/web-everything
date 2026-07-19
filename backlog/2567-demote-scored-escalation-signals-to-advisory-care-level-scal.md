---
bornAs: xnuwmzr
kind: story
size: 8
status: resolved
blockedBy: ["2563"]
dateOpened: "2026-07-18"
dateStarted: "2026-07-19"
dateResolved: "2026-07-19"
graduatedTo: none
tags: []
---

# Demote scored escalation signals to advisory care-level + scale AI-panel rigor by care-level + wire the automated convergence trigger

Core behaviour build of #2563 (codified #blast-radius-advisory-care-not-a-gate). Make blast-radius/size/dismissed/cross-repo/sampling annotate a non-blocking care-level (not a review:pending park); route high-care changes into the convergence loop with raised rigor — a diversity-SELECTION-aggregated AI panel (care-level dials panel size/lenses/rounds), never naive majority vote. Wire a separate scheduled agent-runner to actually run the convergence workflow over care-annotated PRs (the daemon can't spawn agents), converging+labelling only (the resident daemon stays sole main-writer, #2391 lease). Keep gate-self/statute human-gated and non-convergence->review:human.

## Resolution (2026-07-19) — delivered the safe half; the safety-coupled behavior split out

Split along the one safe seam. **Delivered here** (pure, additive, behavior-preserving — nothing changed about what parks or lands): the deterministic **care-level model** and the **"scale AI-panel rigor by care-level"** mechanism.

- `we:scripts/lib/review-escalation.mjs` — `CARE_LEVELS` + `deriveCareLevel(signals)` (weights/bands are tuning knobs); `scoreEscalation` returns `careLevel` additively; `coupleEscalation` inherits the strictest member.
- `we:scripts/lib/review-core.mjs` — `panelRigorForCareLevel(level)` → `{rounds, lenses, jurorsPerLens, aggregation}`, aggregation pinned to **diversity-selection** (strictest-wins, never a majority vote — `derivePanelVerdict` already reduces this way); plus the `careLevelFromReasons` / `panelRigorFromReasons` bridge (a parked PR carries only decorated reasons, not the raw signals).
- `we:scripts/review-core-cli.mjs` — `reduce` now emits `careLevel`/`rigor`; new `rigor` subcommand for consumers holding reasons but no findings yet.
- `we:scripts/workflows/review-parked-prs.mjs` — reads the care-level (via the CLI) to dial **jurors-per-lens**, reduced by diversity-selection (union of the jury's findings).
- +47 unit tests; full suite 2233 green; `check:standards` 0 errors.

**Deferred to the follow-on `[[xpfousp-wire-the-scheduled-converge-and-label-runner-demote-scored-r]]`** (blockedBy #2567) — the two **safety-coupled** behavior changes that must ship together: (1) demote the scored signals from the blocking `review:pending` human-park to a non-blocking `care:*` annotation, and (2) wire the separate scheduled converge-and-label runner. Doing (1) without (2) lets the daemon auto-land scored PRs with **zero** review (`we:scripts/merge-ai-prs.mjs` `hasUnclearedReviewLabel` only refuses `review:pending`/`human`/`changes`) — the exact hazard #2563's fixed invariant forbids. gate-self/statute stay `review:human`; non-convergence stays `review:human` — both unchanged.
