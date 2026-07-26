---
bornAs: xt1ouq4
kind: story
size: 5
status: resolved
scope: ["we:scripts/lib/", "plateau-app:tests/visual/"]
dateOpened: "2026-07-26"
dateStarted: "2026-07-26"
dateResolved: "2026-07-26"
tags: []
---

# Screenshot-vs-baseline visual comparator — the shared primitive for build-time and jury visual review

A callable screenshot-vs-baseline visual comparator: it captures a rendered plateau-app surface via the existing Playwright harness and diffs it against a committed baseline mock PNG, returning { match, delta, findings }. It uses a STRUCTURAL/layout diff plus a pixel-delta threshold (robust to minor rendering noise), not naive full-pixel equality. Baselines live at plateau-app:tests/visual/baselines/<surface>.png; a surface with no baseline is a documented skip (no false-fail). This single implementation is consumed by both layers — build-time self-review and the jury visual lens in we:scripts/lib/design-pixels-adapter.mjs — under jury epic #2649.

## Context — shared cluster framing

Delivery agents today self-review CODE only (an adversarial diff-review subagent). Nothing compares the RENDERED UI against the design mock. Result: the console-board cluster (#2587 / #2588 / #2604 / #2660) shipped code-correct but with a large visual delta from the design artifact. The jury's design-pixels adapter (we:scripts/lib/design-pixels-adapter.mjs, from resolved #2657) defines a `visual → screenshot-vs-target` lens, but that primitive has no callable form yet — a visual juror judges by eye and reports it could not run the automated diff. plateau-app has Playwright (plateau-app:playwright.config.ts, plateau-app:tests/e2e/) but no visual/baseline harness. The fix is ONE shared comparator, reused at build-time (Layer 1) and by the jury (Layer 2). This is a three-card cluster: this comparator primitive (#2670), Layer-1 build-time self-review (#2672), and Layer-2 jury visual grounding (#2671).

## What this card builds

A single callable comparator — the primitive both review layers consume. It:

- captures a rendered plateau-app surface via the EXISTING Playwright harness (plateau-app:playwright.config.ts / plateau-app:tests/e2e/) — no new browser stack;
- diffs the capture against a committed baseline mock PNG;
- returns `{ match, delta, findings }`.

Diff strategy: a STRUCTURAL/layout diff plus a pixel-delta threshold, robust to minor rendering noise (font hinting, antialiasing, sub-pixel shifts) — NOT naive full-pixel equality.

Baseline convention: committed mock PNGs at `plateau-app:tests/visual/baselines/<surface>.png`. A surface with NO baseline is a documented skip — it never false-fails; the caller decides how to treat the skip (Layer 1 falls back to a by-eye pass; the jury notes an ungrounded lens).

This is the single implementation — Layer 1 (#2672) and Layer 2 (#2671) both call it; there is no second diff engine.

## Relates to

- we:scripts/lib/design-pixels-adapter.mjs — the jury lens that will call this comparator.
- jury epic #2649.

## Progress

Delivered as a cross-locus couple (impl-first plateau-app / WE-last):

- **WE core** — `we:scripts/lib/visual-comparator.mjs` exports the pure `diffImages(shot, baseline, opts)`
  (importable by the jury adapter, no I/O) plus the thin file-facing `compareToBaseline({ shotPath, baselinePath })`
  → `{ match, delta, findings }`. Diff = a structural/layout region-mean grid diff PLUS a noise-tolerant pixel-delta
  threshold (not naive equality); a missing baseline returns `{ skipped: true, match: null }` (documented skip,
  never a false-fail). PNG I/O is isolated in `we:scripts/lib/png-io.mjs` — a dependency-free codec on Node `zlib`
  (8-bit, colour type 2/6, non-interlaced — the Playwright profile). Tests in
  `we:scripts/lib/__tests__/visual-comparator.test.mjs` cover identical→match, perturbed→delta/findings, missing→skip,
  noise-tolerance, dimension mismatch, every PNG filter type, and a truncation guard.
- **plateau-app harness** — `plateau-app:tests/visual/capture.mjs` (Playwright capture of a live surface into a
  transient shots dir), `plateau-app:tests/visual/render-baselines.mjs` (renders the committed design mocks into
  `plateau-app:tests/visual/baselines/`), `plateau-app:tests/visual/board.visual.spec.ts` (proves capture + the
  baseline/skip convention; runs in the non-required e2e job), and a README. The two operator design mocks are
  committed under `plateau-app:tests/visual/baselines/sources/` with their claude.ai frame-runtime preamble stripped
  so they render standalone headless; the board mock is the `/console-board` surface baseline, the console-grammar
  mock the 37-state grammar. Both rendered cleanly.
