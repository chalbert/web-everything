---
kind: epic
status: open
childlessReason: program
locus: frontierui
dateOpened: "2026-06-22"
tags: [fui-devtool, exploratory-testing, autonomous-agent, a11y]
relatedReport: reports/2026-07-01-program-explorer-cli-autonomy.md
---

# Explorer CLI autonomy

Find every issue unattended from the CLI. Drive `fui:tools/explorer/cli.ts` toward the north star: point it at a real app and have it find ALL the issues on its own, unattended, with no bespoke harness. Builds on the shipped engine (epic #1167 — `fui:tools/explorer/`), which delivered the walk + Layer-1 oracles as a library plus a thin CLI; this epic closes the gap between "the engine has the primitives" and "the CLI autonomously produces a full audit."

## Grounding — the 2026-06-22 plateau-app audit ([we:reports/2026-06-22-plateau-app-explorer-a11y-audit.md](../reports/2026-06-22-plateau-app-explorer-a11y-audit.md))

Auditing plateau-app surfaced a real gap between the CLI and "find everything." The CLI surface is just `<url> --site --gate --max-states --max-depth --json` — so to audit all 30 routes (10 public + 20 behind login) I had to write a bespoke harness (`fui:tools/explorer/plateau-audit.ts`) that the CLI couldn't replace. Each thing the harness had to do that the CLI can't is a child below. The harness is the proof-of-concept for these slices.

## Captured gaps (children)

- **#1530 — silent under-reporting** (highest priority): the CLI reports "No Layer-1 findings" on pages with *known* axe violations (it found 0 on plateau `/home`, which has 5 color-contrast failures) — it observes states before they settle and swallows axe errors to `[]`. The tool must not silently miss issues that are present.
- **#1523 — auth-gated reach** (keystone): the CLI can't reach logged-in states. ~⅔ of plateau is behind a sign-in, and the engine resets via `goto` (which logs an in-memory/SPA session out). Needs a setup recipe + session-preserving reset.
- **#1524 — whole-app sweep by arbitrary base URL**: `sweepSite` is tuned to the WE/FUI docs site + hardcoded probe bases (`:3001/:8082/:8080`); crawling an arbitrary app (plateau on `:4000`) by base URL isn't a first-class CLI mode.
- **#1525 — actionable audit artifact**: the CLI prints to stdout and the a11y oracle collapses to the first violation; the rich detail (per-element contrast ratios, selectors, fg/bg colors) and screenshots are dropped. Needs `--out` + a screenshot/report bundle + full per-node a11y detail.
- **#1526 — multi-viewport sweep**: a single default viewport misses responsive/breakpoint issues.

## Program — not a finite burndown (`childlessReason: program`)

This is a standing program, not a fixed scope, so it carries `childlessReason: program` and is **exempt from the gate's "all slices done → resolve" nudge** — it never resolves. It passes the Program Test:

- **No Definition of Done.** The north star — "point it at *any* app and find *all* the issues unattended" (`improve-explorer` charter) — is unfalsifiable-complete; draining the current children would not end it.
- **Conformance front.** Keep the CLI's Layer-1 oracle coverage finding every issue actually present on a page (no silent under-reporting).
- **Currency front.** New apps audited, new issue classes, and the explorer's own evolving capabilities (e.g. the #1552 trainable judge) keep spawning fresh gaps.

This epic is the live home for those gaps: the 2026-06-22 run was the first forcing function (children #1530/#1523/#1524/#1525/#1526), with #1547/#1550 accreted after. Further gaps — from reviewing captured screenshots, auditing other apps, or `/improve-explorer` runs — get filed as new children here. Each child is an independent slice; none blocks the others except where noted. The program steady-states with zero open children between forcing functions — that's expected, not "done".

## Goal-set — issue-classes + reach-classes (recorded 2026-07-01)

The "find EVERY issue on ANY app" north star decomposes into two finite goal-sets a general UI tester must
cover. Enumerated + diffed against the explorer code in the 2026-07-01 goal-completeness pass (**20/30
covered**). The **reach front** is mature; the **issue-class front** was under-decomposed.

- **Issue-classes** (20): JS errors · unhandled rejections · 5xx · crash · a11y/contrast/ARIA (axe) ·
  layout overflow · clipped residue · scroll-jump · drag-drags-page · responsive/viewport · UX-intent
  conformance · visual-regression (VLM) **[covered]**; keyboard operability (#2039) · focus-trap oracle
  (#2040, stub today) · form-validation (#2041) · broken-link/4xx (#2042) · perf/CLS (#2046) · i18n/RTL
  (#2043) · hover-reveal (#2044) **[residual]**; a11y over-claim-vs-tier (#1805, deferred/maturity-gated).
- **Reach-classes** (10): auth-gated (#1523) · arbitrary base URL (#1524) · route sweep (#1524) ·
  zero-config discovery (#1550) · SPA nav (#1547) · multi-viewport (#1526) · artifact bundle (#1525) ·
  interaction depth (#1167) **[covered]**; href-less route discovery (#2045, reopened) **[residual]**.

**Stale-reference finding:** the explorer code now lives in `plateau:tools/explorer/` (moved per
#1577/#1597), but this item + its 11 pre-2026-07-01 children still carry `locus: frontierui` and `fui:`
paths. A separate subtree-wide locus/ref cleanup is warranted (not done in this pass).

## Review log

- **2026-07-01 — first skill-run (front-A goal-completeness pass).** Decomposed the north star into the
  30-element goal-set above and diffed it against the explorer code (grounded in `plateau:tools/explorer/`).
  **Coverage 20/30.** The reach front is solid; the issue-class front was under-decomposed — a general
  tester's keyboard, form-validation, broken-link, perf/CLS, i18n/RTL, and hover classes were never filed,
  and `noStuckFocus` is a stub. Filed **8** children: **#2039–#2046** (7 stories + 1 perf `task`). Also
  surfaced the stale-locus finding above. Front B not run this round. Report:
  [we:reports/2026-07-01-program-explorer-cli-autonomy.md](../reports/2026-07-01-program-explorer-cli-autonomy.md).
  **Next run:** build the issue-class residuals (keyboard/form/link/perf/RTL/hover first), then re-measure
  against the 30-element goal-set.
