---
kind: story
size: 8
parent: "2241"
status: resolved
scaffoldedBy: "drain-all-3-repos"
dateScaffolded: "2026-07-04"
dateOpened: "2026-07-04"
dateResolved: "2026-07-04"
tags: []
---

# Make the single /drain lander repo-aware — sweep ready-to-merge across all 3 constellation repos

Supersedes the per-repo skill-copy approach of #2244/#2245: keep ONE /drain skill and make its lander (we:scripts/merge-ai-prs.mjs) repo-aware instead of copying transport + skills into each repo. Every gh pr list/view/edit/merge is repo-scoped via --repo; --all-repos expands to the constellation (WE+frontierui+plateau-app). One GLOBAL blockedBy cascade across all repos — required because backlog is WE-global (no backlog dir in frontierui) so blockedBy edges cross repos and independent per-repo drains cannot sequence them. Rebase-drop + local-main sync stay scoped to repos with a local sibling clone. Prereqs #2242/#2243 (per-repo CI test check) + #2246 (branch protection) gate actual FUI/plateau landing.

## Why central, not per-repo (the red-team)

The epic's original plan (#2244/#2245) copied the transport + `/drain` `/merge` `/pr` skills **into** each repo. That fails twice: (1) it's 3 skills, not 1 (user directive: "I want 1 skill"); (2) it's **incorrect** — three independent per-repo drains each see only their own repo, so none can tell whether a **cross-repo `blockedBy`** blocker has landed. The backlog is WE-global (there is no backlog directory in frontierui — verified), 844 items carry `blockedBy` edges, and dependencies flow WE→FUI→plateau by nature, so a frontierui PR routinely depends on a WE item. Ordering a cross-repo dependency **requires a single sequencer that sees all three repos at once**. So central is the only design that is both 1-skill AND correct.

## What this delivers (this story)

- `resolveRepos()` (pure, unit-tested): `--all-repos` → constellation (self first); `--repos=a,b` → explicit; neither → single-repo default `[null]` (cwd repo, no `--repo` — established behaviour byte-for-byte unchanged).
- Every `gh pr list/view/edit/merge` in `sweepOnce` is `--repo`-scoped; candidates from all repos collect into ONE global list (each verdict carries its own `repo` + head ref — PR numbers are per-repo, WE#10 ≠ FUI#10) and merge in one global `blockedBy` cascade.
- Remote-repo manifest read via the GitHub API (`gh api` contents endpoint fetching the lane manifest at the PR head ref) — clone-free.
- Git-side ops (rebase-drop, local-`main` sync) stay scoped to the LOCAL clone; a remote CONFLICTING/BEHIND PR is left for its author with a clear pointer.
- `/drain` skill invokes `--all-repos`; help/docs updated.

## Validation

- `resolveRepos` unit tests (7) green; full `merge-ai-prs` suite 53/53.
- Live dry-run `--all-repos` now SEES `frontierui#10/#11` (invisible to the WE-only drain before) and correctly skips them: `required check "test" is not green` — i.e. waiting on the frontierui CI prereq (#2242), exactly as designed.
- Default (no flag) and explicit `--repos=` dry-runs verified unchanged / scoped.

## Deferred (follow-ups, not this story)

- Rebase-drop for a remote-repo CONFLICTING/BEHIND PR needs a sibling clone of that repo (provision sibling `frontierui` / `plateau-app` clones in the drain-clone setup) — file as a child of #2241.
- Whether the PRODUCER transport (`we:scripts/pr-land.mjs` + `/pr`) likewise centralizes via `--repo` or is ported — the residual of #2244/#2245.
- Actual FUI/plateau **landing** is blocked on #2242/#2243 (per-repo required `test` check) + #2246 (branch protection); without them GitHub blocks the merge and PRs surface here as skipped.

## Progress

- Status: implemented in lane; gated + resolving.
- Done: `resolveRepos` + repo-aware `sweepOnce` (repo-scoped gh, global cascade, API manifest read, local-only git ops), tests, `/drain` skill `--all-repos`, header/usage docs.
- Next: gate → resolve → PR.
