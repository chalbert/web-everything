# Backlog taxonomy — one `kind` axis vs separate `type` + `workItem`
**Date**: 2026-06-13
**Point**: Prior-art survey grounding decision #466 — every mature tracker keeps one structural type axis + a separate size field, so collapsing WE's redundant `type` + `workItem` into a single `kind` axis is the strongly-supported call.
**Research page**: `/research/backlog-kind-axis/`
---

## Question

Decision #466: collapse the backlog's two near-redundant axes — `type` (idea/issue/decision) and
`workItem` (story/epic/task) — into one `kind` axis (`story | epic | task | decision`), or keep two
axes and accept the redundancy?

## Recommendation

**Unify (Fork-A).** Keep `size` as the separate orthogonal axis; let the existing `tags` array carry any
fix-vs-feature flavour. Confidence moved from "lean" to "strong" after the survey.

## Key Findings

- **No mature tracker runs WE's two-axis model.** GitHub Issues (issue types GA Mar 2025) converged on
  ONE org-level type axis and told teams to migrate bug/feature *labels* into types. Jira runs ONE
  issue-type enum that folds Epic (role) and Bug (nature) together, with story points fully separate.
  Linear/GitLab keep one structural type + a separate estimate/weight + free-form labels.
- **The two WE axes are correlated, not orthogonal** — `type∈{idea,issue}` co-varies with
  `workItem∈{story,task}`. Merging correlated axes is the honest model; the genuinely-orthogonal `size`
  stays separate (honours bias-toward-separation where it actually applies).
- **The fix/feature sub-question dissolves** — the existing `tags` array absorbs a `fix`/`feature` tag
  with zero new machinery, so it is not a second fork.
- **Only `decision` and the sizing rules are load-bearing**; `idea`/`issue` is a badge colour + an
  unimplemented filter order. The lingering `review` enum string is cleanup the migration absorbs.

## Files Created/Modified

| File | Action |
| --- | --- |
| `we:src/_data/researchTopics.json` | Added `backlog-kind-axis` topic entry |
| `we:src/_includes/research-descriptions/backlog-kind-axis.njk` | Research write-up |
| `we:backlog/466-...md` | Rewritten to prepared-fork shape; `preparedDate` stamped |
| `we:reports/2026-06-13-backlog-kind-axis.md` | This report |
