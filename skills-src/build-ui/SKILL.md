---
name: build-ui
description: Build a new UI surface the sighted, reviewed-to-convergence way — model the domain, mock before build, review the pixels (not the source) in both themes, rule design forks with explainer artifacts, and freeze the ruling into machine-checkable webcases. Use when the user wants to "build a new UI", "design a console/board/panel/screen", "start a fresh UI surface", or "do the build-UI method" — not for a one-line style tweak to an existing page.
---

# build-ui — the sighted method for a new UI surface

Trigger + pointer — the method lives in [docs/agent/build-ui.md](../../../docs/agent/build-ui.md) (the six
phases, the one rule, the honesty clauses, the repo hooks). **Don't restate it here; if the method changes,
edit that doc.** This skill is the invokable quick path. It codifies the sequence that produced the Plateau
backlog console (#2505/#2559): the point is a *sighted* pipeline — never trust a UI you have not rendered and
looked at.

> **Runs in a lane — set it up FIRST (#2123).** Building a UI edits the tree, so work in an isolated lane
> clone, never the shared primary checkout (`we:scripts/guard-lane.mjs` denies a primary `Edit`):
> `node we:scripts/lane-pool.mjs status --json` → pick a clean lane → work there → land via PR. The impl
> itself lives in the **product repo** (plateau-app) — WE holds zero implementation (#1282); WE owns the
> method, the reference model, and the spec.

## The loop

1. **Model the domain** (*build-ui.md → Model the domain*) — enumerate the **axes**, cross them into the
   **matrix** of every real state, and name the **one live-action rule** per state (what the operator must do
   or see). A state with no live-action rule is dead or mis-modelled — merge or drop it.
2. **Mock before build** (*build-ui.md → Mock before build*) — author a **single self-contained HTML** file
   (inline CSS/JS, no build step) rendering the matrix with **real data shapes**, not lorem. The design
   happens in the throwaway mock; the app build comes after it's ruled and frozen.
3. **Review the pixels, not the source** (*build-ui.md → Review the pixels*) — screenshot **every matrix cell
   in BOTH light and dark** (Playwright) and hand the **PNGs** to fresh review subagents. Score against the
   rubric via `/review-design` (*vision-tiers.md → Design-critique rubric*, #1034). Both themes are mandatory.
4. **Decision-explainer artifacts** (*build-ui.md → Decision-explainer artifacts*) — for any real fork, build
   an artifact with the options in **side-by-side panes**, an **honest counter-argument** per option, and
   **one recommendation**. Rule it from a lane against that artifact — never inline — and record the ruling in
   the design doc so it's cite-able.
5. **Graduate to webcases** (*build-ui.md → Graduate to webcases*) — port each ruled state into durable
   **webcase** fixtures whose `assert:` line encodes the ruled grammar, hardened by a **conformance test**, so
   the build cites a state by case id and drift is caught. The line starts as the base attention grammar
   (actor · edge · primary · rendered · uc); **ruled visual language (glyph/motion/colour) is additive — a
   dedicated port pass graduates it onto the same `assert:` line** rather than leaving it as a prose note.
6. **Converge** (*build-ui.md → Converge*) — spawn **fresh-context reviewers with alternating lenses** until
   **two consecutive clean rounds**; **assert-verify every fixture edit** (re-run the conformance test after
   each change). One clean round is luck; two from distinct lenses is convergence.

## Deliver it (the repo hooks — see *build-ui.md → The repo hooks*)

- **Lane → PR, never commit to `main`** (#2183/#2190). Complete the branch — green gate + `resolve` + one
  commit (stage only the touched files) — **then** open the PR and label `ready-to-merge`. Never label a
  half-done branch.
- **The write-seam** — the `PreToolUse(Edit|Write)` hook scans proposed content and denies at the seam (#883);
  expect it.

## Stop rules

- **No screenshot, no review.** If you have not rendered and looked at a state (both themes), you have not
  reviewed it — say so rather than critiquing the markup.
- **The counter-argument must be real.** A decision-explainer with a strawman counter-argument is a
  rationalization — state the honest case against your own recommendation, or the fork isn't ruled.
- **Stalled convergence is a finding.** If alternating-lens rounds won't go two-clean-in-a-row, stop honestly:
  the state model may be wrong (back to phase 1) or the ceiling is the model — say so, don't ship the churn.
