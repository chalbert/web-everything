---
bornAs: xr8atb8
kind: story
size: 5
parent: "2505"
status: open
blockedBy: ["2717"]
dateOpened: "2026-07-27"
tags: []
---

# Feature-tracking screen case taxonomy to webcases

The full case space of the feature-tracking screen — 115 cases across 8 families: S screen (17), F feature-row (15), K forecast (9), M detail/markers (38), E error (16), L latency (13), C concurrency (3), R theme/responsive (4) — each with an FT-<family><n> code, a machine-readable assert line, and a rendered? flag. Graduate to a **`plateau-app:src/feature-tracker/feature-tracking.webcases.ts`** registry + conformance test (the #797/#2553 pattern, mirroring the plateau-app `plateau-app:src/backlog-view/card-taxonomy.webcases.ts`). (Corrected 2026-08-15: the original `we:feature-tracker.webcases.ts` locus above was wrong — see the prep finding. WE holds zero implementation; the graduation, like #2553's, lives in plateau-app.)

Sibling to #2553 (card-state conformance spec). Error (E) and latency (L) are first-class; a completeness-critic added the concurrency (C) and theme/responsive (R) families. Open thresholds to resolve at build (fold into #2687 forecast primitive): the stalled zero-throughput window, the too-noisy variance cutoff, the min-resolved-slice sample size (no-basis vs thin vs enough), and the bottleneck fleet-share trigger.

Ratified in the feature-tracking-screen design session (committee → 10-juror jury → red-team → Round 2 → integration → frame committee → MASTER-DETAIL). Decision-view/trace artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d · Live integrated page: https://claude.ai/code/artifact/d6816fec-3b87-4480-9cbb-0bb96e05a046

## Preparation finding (2026-08-15) — NOT independently build-ready; already delivered by its own declared slices

Ran the story-preparation checklist (`we:agent-memory-src/story-preparation-checklist.md`). **Verdict: do not hand
this card to a builder as new/independent work.** This story was filed the same day (2026-07-27), from the same
design session, as two build-slices that **already name it as their delivery target** — not a coincidental
overlap like the one found preparing sibling #2693 (parked, `lane/prepare-2693`, PR #1332), but this story's own
declared decomposition, stated in the slices' own text and in epic #2705's "Build slices" section ("S0r + S0a are
the build-slices that deliver #2709"):

- **[#2716](/backlog/2716-s0r-taxonomy-reconcile-spec-allow-list-refreeze-r1.md)** (S0r, size 1) — its code is
  **already landed**: `plateau-app:src/feature-tracker/feature-tracking.webcases.ts` (plateau-app PR #115,
  commit `da66083`). Read at current HEAD (2026-08-15) and re-verified against its own acceptance line:
  `SPEC_BEFORE_RENDER` freezes exactly the 44 codes named (S17, F13–15, M8/M13/M22/M23/M32/M38, E2–16, L2–13,
  C1–3, R1–4), `RENDERED_COUNT = 71`, and `validateFtRegister()` enforces the 71+44 partition and the
  list-only-shrinks invariant at module load — acceptance is met in code. Its own `status:` frontmatter was
  found stuck `open` (a stale bookkeeping gap, not outstanding work) — already caught and fixed in a **separate,
  already-parked PR #1343** (`lane/reconcile-2716`, not yet landed as of this prep). Not re-filed here.
- **[#2717](/backlog/2717-s0a-ft-webcases-registry-invariant-tests-spec-allow-list.md)** (S0a, size 3,
  `blockedBy: ["2716"]`) — **the real remaining work**: graduating all 115 reconciled cases into the full WEB
  CASE header + two-plane assert-line + parser + conformance-test shape (mirroring `plateau-app:src/backlog-view/card-taxonomy.webcases.ts`). Verified `plateau-app:src/feature-tracker/feature-tracking.webcases.test.ts` does not
  yet exist — this slice has not been built. Already correctly scoped, sized, and interfaced; it needs no
  further preparation here.

**No new design, interfaces, or tasks are authored on this card** — inventing them would either duplicate
#2717's already-correct scope or pre-empt it. `blockedBy: ["2717"]` is added above so readiness tooling stops
offering this card as a build target while real work remains under its own declared slice (it transitively
covers #2716 via #2717's existing `blockedBy: ["2716"]`).

**Recommendation:** leave this story open as the tracking parent. Once #2717 lands (which itself needs #2716's
status fix in PR #1343 to land first, so `check:readiness` clears it out of Tier C), resolve **this** card
(#2709) as a pass-through — `graduatedTo: plateau-app:src/feature-tracker/feature-tracking.webcases.ts` — rather
than dispatching it for a separate build. Its `size: 5` sits under parent epic #2505's burndown while #2716
(1) + #2717 (3) are separately sized under parent epic #2705; both counts are real per the repo's per-epic
accounting (no `parent` edge links them, so `check:standards`'s no-double-count rule does not fire), but a
human reviewing both epics' totals should read them as the *same* 4 points of underlying work, not 9.
