---
bornAs: xm9goqs
kind: task
parent: "4075"
status: open
scope: ["we:scripts/lib/jury-core.mjs", "we:scripts/lib/__tests__/jury-core.test.mjs", "we:scripts/lib/review-core.mjs", "we:scripts/lib/__tests__/review-core.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Add a deterministic spec-consistency review lens (or truth-check red-team step) to the jury panel

Follow-up from we:backlog/4314-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md, guard 3 (prevention owed by chalbert/web-everything#2831's independent review, referencing we:backlog/4308-drain-lands-a-ready-pr-after-not-before-a-larger-overlapping.md): "A deterministic review lens (Verify that spec constraints are mathematically consistent) or a truth-check red-team step (like the Jury refinement method) would catch it."

## Background
we:backlog/4308-drain-lands-a-ready-pr-after-not-before-a-larger-overlapping.md's own review history (its Independent plan review sections) shows more than one blocking/major finding that was a pure LOGICAL/mathematical inconsistency inside the spec itself — a window counted from the wrong anchor failing to bound total wait, an overlap-relative size order that can cycle, a filtering point that misses a live code path — caught only by an ad hoc Codex prose pass, not by any of the panel's EXISTING deterministic lenses (we:scripts/lib/jury-core.mjs#PANEL_LENSES / MANDATE_LENSES). This finding asks for a repeatable, deterministic lens or red-team step that specifically targets that class of gap: a spec's own stated invariants/rules contradicting each other or failing to hold under a stated edge case, independent of whether the CODE matches the spec.

## Design gist
Add either (a) a new ADVISORY lens (we:scripts/lib/jury-core.mjs#ADVISORY_LENSES) whose prompt/validation asks each juror to restate every numbered rule/invariant the spec section under review declares and check them pairwise for a contradiction or an unhandled edge case (a cycle, an unbounded value, a boundary the rules never resolve) — never a code-correctness question, purely "do these stated rules agree with each other and cover their own stated edge cases" — or (b) a red-team step in the existing convergence loop (we:scripts/lib/converge-core.mjs) that runs after the panel accepts, specifically trying to construct a concrete counterexample input that breaks one of the spec's own stated invariants.

## Edge cases the lens/step must handle
- A spec with no explicit numbered rules/invariants at all (prose only): the lens must degrade to "no structured claim found, nothing to check" rather than fabricating rules to critique.
- A spec whose rules are consistent but INCOMPLETE (a case the rules simply do not address): distinguish "contradiction" (must flag) from "silence" (may flag as a gap, must never be conflated with a hard contradiction in the verdict wording).
- A very large spec section (many rules): bound the pairwise check so it cannot blow up the panel's round budget or juror cost — a documented cap, not an unbounded all-pairs scan for a huge rule count.
- The lens finding something: it must render through the existing renderPanelComment/Prevention-OWED machinery (we:scripts/lib/review-render.mjs) like every other lens finding, not a bespoke output shape.

## Test plan
Unit tests in we:scripts/lib/__tests__/jury-core.test.mjs (or we:scripts/lib/__tests__/review-core.test.mjs, whichever owns the new lens/step) covering the positive case (two stated rules that contradict, e.g. two conflicting orderings that can cycle) and every edge case above. Plus ONE integration/wiring test proving the new lens is actually included in PANEL_LENSES/ADVISORY_LENSES and fans out through the real panel-assembly path (we:scripts/lib/jury-core.mjs), not only unit-tested as an isolated function.

## Why filed, not built here
we:backlog/4314-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md's own MVP built a different, self-contained guard (finding 4, in we:scripts/operations/completion-store.mjs); this finding is a review-process design change spanning the jury/converge machinery and deserves its own dedicated build, filed separately per this repo's single-responsibility/small-file preference. Its own `Done when` is left as the standard un-prepared placeholder on purpose — like every mechanically-filed card, it gets its own PREPARE pass when a delivery agent picks it up.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
