---
kind: story
size: 5
parent: "2193"
status: open
dateOpened: "2026-07-03"
tags: [lane, pr-flow, merge-queue, session-tooling, drain]
---

# The lander rebase-drops the transient lane manifest on land (or manifests go per-item path)

The label lander (`we:scripts/merge-ai-prs.mjs`, converged in #2194) merges each lane PR **with** its
`we:.lane-manifest.json`. Every lane writes that manifest to the **same repo-root path**, so:

1. the manifest lands on `main` on the first merge, then
2. **every other open lane PR conflicts with `main` on that one shared path** (modify/modify, or modify/delete
   once it's stripped) — so the lander can land **at most one PR** before the rest cascade to `CONFLICTING`.

Observed live 2026-07-03: after one PR merged, all ~24 other open lane PRs went `CONFLICTING` on
`we:.lane-manifest.json` alone (real code merged clean). GitHub's server-side `gh pr merge` cannot auto-resolve
it.

**Fix (proven this session):** before merging each PR, the drain **rebases it onto `main` and drops the
transient manifest** — done with pure plumbing, NO branch checkout (so it stays inside the `guard-git-branch`
single-branch rule; pushing the rebuilt tip to a `lane/*` ref is already allowed):

- `git merge-tree --write-tree origin/main origin/<laneRef>` → the merged tree (carries the manifest + any real
  conflict markers).
- read that tree into a **temp index** (`GIT_INDEX_FILE`), `git rm --cached` the manifest, `git write-tree`.
- `git commit-tree <resolvedTree> -p origin/main -p origin/<laneRef>` — `main` as the FIRST parent, so GitHub
  sees the branch up-to-date — then push that commit to the `lane/*` ref and `gh pr merge <n> --merge`.
- merge-readiness gates only on the required `test` check (`UNSTABLE` + `test=pass` **is** mergeable;
  `cla`/Workers-Builds are non-required).

If `merge-tree` reports any conflict **beyond** the manifest, skip (real conflict, needs a human). Fold this
`rebase-drop-manifest` step into the lander's per-PR land path. **Alternative that removes the root cause:**
producers write the manifest to a **per-item path** (`we:.lane-manifests/<NNN>.json`) or don't commit it at all
(derive `blockedBy` from the backlog item frontmatter, which already carries it) — then there is nothing to
conflict on and no strip needed. Pick one; the per-item path is the smaller change. Relates to #2194.
