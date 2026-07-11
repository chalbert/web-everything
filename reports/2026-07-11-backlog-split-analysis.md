# Backlog split analysis — 2026-07-11

Focus: **#2418** — *Main loop as coordinator: delegate the review pipeline, script the glue, template the renders* (`kind: epic`, unsliced, no children).

## Candidate

#2418 is a genuinely unsliced epic: `kind: epic`, no `size`, and no item names it as `parent` (#2419 only *relates* to it). Condition (1) "size is volume not a fork" is already settled at the parent level — the epic is decided to decompose. Its body proposes 6 candidate slices; each was verified against the real code tree, not taken from the body.

### Work-investigation notes (what's actually on disk)

- `we:scripts/lib/review-core.mjs` (436 lines) already **exports every pure function** the slices need — `normalizeFindings`, `deriveVerdict`, `buildPanelMandate`, `derivePanelVerdict`, `buildEditorMandate`, `deriveNegotiationOutcome`, `deriveReviewDisposition`, `renderPanelVerdictTable` — but has **no CLI** (`grep` finds no `import.meta`/`process.argv`/shebang). So slices 2/3 are thin wrappers + one new renderer over an existing engine, not new logic.
- Sibling libs `we:scripts/lib/review-escalation.mjs` and `we:scripts/lib/review-baseline-state.mjs` hold the escalation/gate and baseline-diff functions the "escalation/clearance notice" renderer draws on.
- No `.claude/workflows/` dir yet — slice 1's Workflow script is greenfield (lands as a `scriptPath` script).
- No `who-cleared` / `fetch-parked` / `wait-green` / `pr-state` scripts exist yet.
- **#2416** (`Gate: honor review:accepted only when a human applied it`, `story` size 3, `status: open`, parent #2405) is the **same provenance gap** slice 5 names.
- Scaffold CLI flag is `--kind` (not `--workitem`); 2418 already has no `size`, so no in-place conversion is needed — just scaffold children under it.

## Could split

Seven files come out of six candidates (slice 3 splits in two to hold each ≤ 3). Slice 5 does not split (below).

| # | Slice | kind / size | Home | blocked-by | Batchable? |
|---|-------|-------------|------|-----------|-----------|
| A | **review-core CLI: `reduce` + `mandate`** — command line over the pure fns; `reduce` (findings→verdict/outcome/disposition + table), `mandate` (`--lens`/`--editor`). Replaces 5× inline `node -e`. | story · 3 | `we:scripts/lib/review-core.mjs` | — | yes (serialize with B on same file) |
| B | **PR review-comment renderer** — add `renderPanelComment({findings, verdict, disposition})` (extends existing `renderPanelVerdictTable`) + expose it as the `comment` CLI subcommand. | story · 3 | `we:scripts/lib/review-core.mjs` | — | yes (serialize with A on same file) |
| C | **`review-parked-prs` Workflow** — `pipeline(parked, panelReview → reducePanelVerdict → editorRound → reReview)` calling review-core, returning `{pr, disposition, verdict, commentBody}`. Collapses ~24 hand-run steps into one launch. | story · 3 | new `we:scripts/workflows/review-parked-prs.mjs` | **A, B** | after A+B |
| D | **Session/notice renderers** — render from structured data: drain end-of-run summary, close-session report, escalation/clearance notice. *Template the render, not the prose.* | task · 2 | `we:scripts/lib/review-core.mjs` + drain/close skills | — | yes |
| E | **Fetch/state helpers** — `fetch-parked <nums…>` (`{diff,title,body,files,state,checks}` in one call), `wait-green <pr>`, `pr-state <nums…>`. | task · 3 | `we:scripts/` | — | yes |
| F | **`closing-session` standing efficiency-introspection step** — every close, scan the transcript for (a) main-loop steps that should've been delegated and (b) ad-hoc sequences that should be scripted; emit a bounded, evidence-based proposals table. The meta that keeps surfacing A–E. | story · 3 | `we:skills-src/closing-session/` + `we:.claude/skills/closing-session/` | — | yes |

**DAG**

```
A ─┐
   ├──► C          D   E   F   (independent roots)
B ─┘
```

- **Independent roots:** A, B, D, E, F. C is the only dependent (needs the CLI from A and the comment renderer from B).
- **File-collision note:** A and B both edit `we:scripts/lib/review-core.mjs` — fine serially under `/batch`, but they can't run as two parallel lanes. D also touches review-core (adds renderers) — sequence D after A/B if batched, or keep it in a separate lane on the skill files only.
- Slice 3 was split into **B** (the PR-comment renderer that slice C needs) and **D** (the other three renderers). The epic's original slice-3 bundled four renderers across three homes → size ~5; splitting keeps each ≤ 3 and lets C depend only on the one renderer it uses.
- The epic's original slice-2 `comment` subcommand was folded into **B** (it's the CLI face of the same renderer) to remove the 2↔3 overlap.

## Could not split

| # | Slice | Failed condition | Unblocking action |
|---|-------|-----------------|-------------------|
| 5 | **`who-cleared <pr>` clearance-provenance checker** | *Real independence / no buried fork* — the epic itself says "That IS the #2416 gap." Whether `who-cleared` is a distinct diagnostic CLI or is **subsumed by #2416's in-gate enforcement** (`decideReviewGate` reading actor provenance) is an unresolved scope boundary. Scaffolding it now risks duplicating open #2416. | **Work #2416 first**, then decide: if #2416's enforcement exposes a reusable `clearanceProvenance()` fn, slice 5 collapses to a thin CLI over it (or drops); if not, file `who-cleared` as a standalone helper then. No new item needed — #2416 already tracks the provenance work. |

## Net

Approve → **+6 slices** (A, B, C, D, E, F) scaffolded under #2418 (already an epic; no conversion). Slice 5 stays in the epic body as a could-not-split, gated on #2416. Freshly batchable → chain A/B → D/E/F, then C, via `/batch`.
