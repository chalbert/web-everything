---
bornAs: x4g6sxa
kind: task
status: open
dateOpened: "2026-08-05"
tags: [governance, agent-memory, check-standards, citation-verification]
---

# Lint the agent-memory corpus like the backlog corpus — resolve every #NNNN cite, claimed relationship and quoted heading

Nothing validates cross-references inside we:agent-memory-src/. The /review of PR #1045 found three factual errors in one 7-line paragraph — a wrong impl arm, a quoted guard section that exists in no cited document, and a gloss that inverted a ruling's direction — none caught by check:standards, check:memory or check:memory-freshness, all three deterministically checkable. Add a memory-corpus reference linter with three signals: every bare #NNNN resolves to a backlog item; a claimed impl/decision relationship appears in the cited item's blockedBy or title; a quoted section name attributed to a cited target exists in that target.

## Why now — three wrong facts in seven lines, all gate-invisible

PR #1045 appended one paragraph to `we:agent-memory-src/land-on-no-regression-not-perfection.md`. Every gate
was green: `check:standards` 0 errors, `check:memory` ✓, `check:memory-freshness` ✓. The four-lens `/review`
panel then found three assertions that are simply false against the repo, and all three fail a mechanical test:

| the claim | reality | the check that catches it |
|---|---|---|
| "their impl arm (#2785)" — offered as the impl arm of **both** #2771 and #2840 | #2785's `blockedBy` is `["2771","2844"]`; it never names #2840. #2840's impl arm is #2892, `status: open`, titled "enforces #2840" | signal 2 — a claimed relationship must appear in the cited item's `blockedBy` or title |
| "the ruling's own \"retained invariants\" are the guard" | `grep -c "retained invariant" we:docs/agent/platform-decisions.md` → **0**. The phrase lives only in `we:backlog/2771-*.md` and `we:backlog/2785-*.md` bodies, and in no script | signal 3 — a quoted section name must exist in the target it is attributed to |
| "#2771 and #2840 both deliberately shrink the `review:human` trigger" | #2840's own lineage says it *extends* #2771 by adding the edit/guarantee axis; it adds human-gating on every axis except one statute-term narrowing | not fully mechanizable (gloss faithfulness is judgment) — but signals 2 and 3 put the source one resolvable hop away |

The corpus is loaded into context every session and acted on before anything is opened. A wrong fact there is
not a documentation nit; it is an instruction.

## The three signals

1. **Cite resolution.** Every bare `#NNNN` in a leaf body resolves to an existing `we:backlog/NNNN-*.md` (or a
   `xNNNNNN` hash file). Report the item's `kind`/`status` alongside, so a stale or wrong cite is visible at
   gate time. Note the corpus's own convention — a bare `#NNNN` is a **backlog** item; a pull request is
   written `PR #NNNN` — so the linter must not treat `PR #1045` as a backlog cite.
2. **Claimed-relationship check.** When leaf text asserts a structural relationship ("impl arm of", "enforces",
   "implements", "blocked by"), the cited item must actually carry that edge — the decision id in `blockedBy`,
   or the decision named in its title. This is the signal that fires deterministically on PR #1045's line 40.
3. **Quoted-section resolution.** When a cite quotes a section or heading name alongside a `#NNNN` or a
   `we:<doc>.md#anchor`, that heading must occur in the cited target's text. Fires on line 41.

Signal 3 is the same shape as the statute-side gaps already filed (#2849 interim-claim expiry, #2852 verbatim
duplication, #2856 owed-work back-link) — none of those tests "does the named section exist in the cited doc",
and none scans `we:agent-memory-src/`.

## Where it lives

Two candidates, both already scanning what is needed — pick one, do not build new plumbing:

- **`we:scripts/lib/memory-freshness.cjs`** (`auditMemoryFreshness`) already iterates leaves and already
  resolves statute-anchor cites against a live anchor index. Adding three signals here reuses the iterator and
  the index. Its findings are currently advisory — these three should be **errors**, so either promote
  per-signal severity or emit them on the `check:standards` error channel.
- **`we:scripts/lib/citation-check.mjs`** (the #2821 family) already owns anchor-authority checking, but ships
  with `CITATION_GATES_ENFORCED = false` and its `scanFiles` scope excludes `we:agent-memory-src/`. If the
  linter lands here, widening that scope is part of the work — and the disabled flag must be resolved, not
  inherited, or the gate is decorative.

Related but distinct: `we:scripts/lint-locus-prefix.mjs` scopes its `CORPUS_RE` to `backlog/` and `reports/`
only, so the memory corpus gets no locus-prefix pressure either. Worth folding in if it is cheap; not the
point of this item.

## Not in scope

- **Relative-link form.** Two review lenses flagged the paragraph's relative markdown links to the statute as
  broken. They are **not**: the read path chains `~/.claude/projects/<key>/memory` → `.claude/agent-memory` →
  `we:agent-memory-src/`, so a two-hop relative link resolves back into the repo and reaches
  `we:docs/agent/platform-decisions.md` correctly (verified on disk). The genuinely broken relative links are
  the pre-existing ones in `we:agent-memory-src/41-feedback_wait_for_explicit_ratification.md` and
  `we:agent-memory-src/36-feedback_ratified_decisions_are_reversible_stay_agile.md`, which carry decayed
  five-level-up paths into `workspace/webeverything/`. File that separately if it is worth fixing.
- **Gloss faithfulness** (row 3 above) — judgment, not script-decidable. Signals 2 and 3 are the cheap half.
- **The escalation-surface hole** that let PR #1045 merge unreviewed — that is #2909, extended in the same pass
  as this item.

## Done when

- The three signals run over `we:agent-memory-src/*.md` in `check:standards` and **error** (not warn).
- A fixture test proves each signal fires on the exact PR #1045 text it was written for, and that the corrected
  text passes.
- The existing 232-leaf corpus is either clean or its findings are triaged — a linter landing red across the
  corpus is a linter that gets muted.
