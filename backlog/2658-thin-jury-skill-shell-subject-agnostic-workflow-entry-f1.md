---
bornAs: xnthi3f
kind: story
size: 5
parent: "2649"
status: resolved
blockedBy: ["2656", "2657"]
scope: ["we:skills-src/"]
dateOpened: "2026-07-24"
dateStarted: "2026-07-25"
dateResolved: "2026-07-25"
tags: []
---

# Thin /jury skill shell + subject-agnostic workflow entry (F1)

New we:skills-src/jury/SKILL.md that only invokes the engine and renders (no jury logic in the shell), plus a subject-agnostic workflow generalizing we:scripts/review-parked-prs.mjs so one harness runs any of the three subjects.

## Progress

- Added `we:skills-src/jury/SKILL.md` — the thin `/jury` shell (docs only): points at the engine
  (`we:scripts/lib/jury-core.mjs`), the three adapters, the harness, and the shim; states the F1 invariant (no
  jury logic here), how to run it, and the "the jury JUDGES, never acts" boundary. Auto-registers as `/jury` via
  the `.claude/skills → skills-src` symlink (no build step).
- Added `we:skills-src/jury/subject-jury.workflow.js` — the subject-agnostic Workflow harness. Generalizes the
  PR-diff-only `we:scripts/workflows/review-parked-prs.mjs`: given a subject (pr-diff | design-pixels |
  decision-prose) + careLevel + the subject's input/material, it shells the engine to resolve the roster
  (resolveAdapterRoster + materializeRoster), fans out one juror agent per rostered seat under the adapter's own
  mandate, reduces the panel via the shared review core (`we:scripts/review-core-cli.mjs` reduce,
  diversity-selection), and returns an in-memory jury ledger (the #2654 event stream). Same sandbox shape as the
  reference (pure `export const meta`; no imports; everything shelled inside `agent()`; top-level `return`).
- Added `we:skills-src/jury/resolve-roster.mjs` — the thin engine-invoker the sandboxed harness shells (it can't
  `import`). Selects the adapter for a subject, calls the engine's roster resolver / materializer / roster-picked
  event builder, asks the adapter's mandate builder for each lens's mandate, prints JSON. Zero jury logic (the
  jury analogue of `we:scripts/review-core-cli.mjs`); homed in `skills-src/` beside the harness per this slice's
  scope.
- NO jury logic lives in the shell or the harness (the ratified F1): the roster, the care→rigor dial, the
  mandatory set, and the verdict reduction all come from `we:scripts/lib/jury-core.mjs` (+ the per-subject
  adapter) via the two shims. Subject inputs are passed to the shim via temp files (quoted heredocs), never on the
  command line — no shell expansion/execution of free-prose inputs. A mandatory lens whose jury fails OR is
  absent, and a resolve failure, degrade the panel to needs-human — a jury that did not run never reads as accept.
- DEFERRED (own slices): the durable on-disk jury logbook + fold (#2641 — this returns the in-memory ledger), the
  editor↔reviewer convergence loop (#2285), roster reconcile-at-PR-open (#2635), the disposition judge (#2652),
  and the design-pixels screenshot-vs-target grounding (deferred in its adapter, #2657).
- Gate: check:standards green (0 errors); full vitest green (3960 tests). Adversarial self-review run to
  convergence (shell-injection, fail-open-accept, absent-mandatory-lens backstop, and an engine-logic leak fixed).
