---
bornAs: xscdebo
kind: story
size: 8
parent: "2804"
status: resolved
blockedBy: ["2805", "2808"]
scope:
  - plateau-app:scripts/dev/fidelity-render.mjs
  - plateau-app:tests/fidelity/console-board.contract.mjs
  - plateau-app:tests/fidelity/fidelity-render.test.ts
  - plateau-app:vitest.config.ts
  - plateau-app:.gitignore
dateOpened: "2026-08-01"
dateStarted: "2026-08-01"
dateResolved: "2026-08-01"
tags: [plateau-loop, conveyor, ui-fidelity, plateau-app, render-slice, human-verify, slice-uifg]
---

# Real-route render harness (plateau-app)

Generic harness (`plateau-app:scripts/dev/fidelity-render.mjs`, sibling of the existing
`plateau-app:tests/visual/capture.mjs`) that boots the shipped host shell at the contract route, seeds each
regime through the real store [#2808], renders both themes in a REAL browser (jsdom forbidden), and emits per
seed×theme a DOM snapshot, screenshot, and layout report, plus a signed conformance record bound to
commit×route×baseline-hash.

## Conveyor guardrail — self-proving, human-verify
**Do NOT auto-resolve on tests-green alone.** This slice builds the very oracle that was missing, so it must
prove itself against a KNOWN-BAD target:

- **Run the harness against the CURRENT `/console-board` and it must RED-flag it** — capture the live defect
  signals (`laneCols=0`, ≥2 `<header>`/brand marks, `poolChips≤1`, empty center). If the harness green-lights
  today's board, the harness is wrong.
- It must mount the **real route in the host shell** (not `?demo=1`); a harness that renders a fixture repeats
  the original failure and is rejected.
- **Requires a rendered red→green proof, human-reviewed** — attach the red capture of today's board. This is a
  `render-slice`: resolve gates on the rendered proof, not on a green unit suite.

## Delivered

Built the generic **real-route fidelity render harness** in **plateau-app** (WE holds zero impl — the render +
conformance run live in the product repo). It boots the shipped host shell at the REAL `/console-board` route,
seeds each regime through the REAL store via the #2808 seam (`PLATEAU_BOARD_SEED`, not `?demo=1`), renders both
themes in a REAL Chromium (Playwright; jsdom forbidden), and emits per seed×theme a DOM snapshot, a screenshot,
and a layout report (computed `grid-template-columns` + per-cell bounding boxes), plus one conformance record
carrying an **integrity digest** bound to `(commit SHA × route × baseline hash)` — anti-replay, so a stale green
can't satisfy a later commit (see the digest note below).

The deterministic floor (`gradeReport`, PURE) grades all **four** canonical rules: (1) singleton chrome by
count, (2) real GEOMETRY — lane columns above a min width **and** non-overlapping / non-zero cells, (3) per-regime
lanes/pool/empty-state, (4) **theme cascade by computed value** — a host theme token that reads byte-identical
under light and dark never cascaded.

**Files (plateau-app):**
- `plateau-app:scripts/dev/fidelity-render.mjs` — the harness. Generic/contract-driven core: `bootHost`
  (spawns the real dev server with the seed seam armed, own scratch port, never :4000), `renderOne` (real
  browser, both themes, external network blocked, motion off, fonts settled), `collectSignals` (in-page
  geometry + chrome + theme-token probe), `gradeReport` (PURE deterministic floor over all four rules),
  `integrityDigest` (commit-binding anti-replay digest). CLI `--expect red|green`.
- `plateau-app:tests/fidelity/console-board.contract.mjs` — the `/console-board` contract (route, host, seed
  regimes + per-regime floor, both themes, target baseline, probe selectors incl. the host theme tokens). Data
  only; a second surface is a second contract, not a second harness.
- `plateau-app:tests/fidelity/fidelity-render.test.ts` — the PURE-logic suite (grader over all four rules +
  digest) that rides the required vitest check; the browser run is the self-proving CLI acceptance.
- `plateau-app:vitest.config.ts` — collect the `tests/fidelity` suite. `plateau-app:.gitignore` — ignore the
  transient `.fidelity` output dir.

**Self-proving red-capture proof (met).** Running the harness CLI against the current `/console-board` with
`--expect red` → **verdict RED, 25 violations** across all 6 seed×theme renders of TODAY's board, catching every
documented live-defect signal AND the theme-cascade break:
- `≥2 headers` — `headersInRoute=2` every regime (the board's own `.lb-topframe` + `.lb-exec` render inside the
  embedded route; the shell should own the chrome).
- `≥2 brand marks` — `brandMarks=2` every regime.
- `laneCols=0` / grid collapsed — empty→`laneCols=0`; populated→`laneCols=1` full column for a 3-lane seed
  (starved 424px-wide centre, the rest collapsed to strips) → `grid-collapsed` + `center-empty`.
- `poolChips≤1` — populated `poolChips=1`, overflow `poolChips=0`.
- **theme cascade (new)** — on the DARK render the shell top bar stays `rgba(255,255,255,0.72)`, and the page +
  route-region backgrounds stay `rgb(246,247,252)` — identical to light → `theme-cascade-static` (a dark board
  under light chrome). The board root correctly flips (`rgb(246,247,252)`→`rgb(14,15,24)`), so it is NOT flagged
  — proving the check is real, not trivially always-red.
The floor is meaningful, not always-red: the grader GREEN-lights a hypothetical faithful board across every rule
including a real cascade and non-overlapping cells (unit-tested).

**Verified** — `npx vitest run` full plateau-app suite **1666/1666 green** (incl. the 11 fidelity tests: the two
new graders are proven reachable-RED and reachable-GREEN); the `--expect red` CLI run exits 0 (asserted RED
matched). A red→green human-verify: the red capture (screenshots + layout reports + the record under
`.fidelity/`) is attached to the PR for review before merge.

**Review-converge (independent review returned CHANGES — engine sound, but graded 2 of 4 rules; fixed in-lane):**
- **Theme cascade now graded** — `collectSignals` captures the computed color of curated host tokens (shell
  top bar, page/route/board backgrounds); `gradeReport` compares light↔dark and fails any token that never
  changed. Catches the white-top-bar-on-a-dark-board defect that both themes' identical structural floor hid.
- **Cell overlap/zero-area now enforced** — `gradeReport` checks the captured `cellBoxes` for overlap (beyond a
  small border tolerance) and zero area; stacked/collapsed cards no longer pass a count check.
- **Digest wording corrected** — the record's `signature` field was renamed `integrityDigest` and its
  docstring/PR/backlog wording corrected from "signed / keyed digest" to **integrity digest (anti-replay, NOT
  authenticity)**: it is an unkeyed sha256 over public inputs, so it proves a green can't be replayed against a
  different commit, not that a trusted party authored it. Real keyed/authenticated signing (a registry token so
  a self-issued green is rejected) is the **target-registry slice's** job (design ref INVARIANT A / slice 7),
  noted as the epic follow-up.

**Self-review findings fixed pre-PR (first pass):**
- Scope reconciliation — declared all 5 touched product files in `scope` (was 1); an under-scoped render-slice
  is a hard error at resolve (slice 11).
- Lazy-loaded Playwright inside `runFidelity` so the PURE exports (`gradeReport`/`integrityDigest`) — the parts
  that gate — import with no browser runtime (also removed stray socket noise from the unit run).
- `--out` footgun guard — the output dir is wiped between runs, so the harness refuses any dir whose name
  doesn't contain "fidelity" (a stray `--out src` can't delete real files).

**Honest note.** The harness boots `vite`, so like the app's own `npm start` it needs the sibling constellation
present (`../frontierui` built + `../webeverything`). The browser run is a local/human-verify step (NOT in the
required CI check, matching the repo convention that keeps browser work out of the required gate); only the pure
grader/signing suite rides CI.
