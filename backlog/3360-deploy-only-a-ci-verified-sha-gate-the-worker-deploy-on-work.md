---
bornAs: xmiuo0r
kind: story
size: 2
status: open
scope: ["we:.github/workflows/deploy.yml"]
dateOpened: "2026-08-26"
tags: []
---

# Deploy only a CI-verified SHA — gate the Worker deploy on workflow_run and re-derive the verdict

`we:.github/workflows/deploy.yml` fired on push to main in PARALLEL with CI and deployed the branch tip regardless of whether CI passed or whether that tip was the tree CI tested. Branch protection never covered it (required checks gate a merge, not a push-triggered deploy). Switch the trigger to workflow_run on CI success, check out workflow_run.head_sha, and add a re-derive step that queries the check-runs API for the candidate SHA and refuses unless it is an ancestor of `main` **and** test and smoke are both green on their latest run.

**Retraction (review of PR #1611).** This card first ended with: *"trigger is wiring, the re-derive is the
guarantee."* **That was wrong**, and it under-specified the work in the one place it mattered:

- The trigger filter is not wiring. `workflow_run.branches: [main]` matches `head_branch` — a branch NAME on
  the HEAD repo — so a FORK pull request whose source branch is named `main` passes it. The job `if:` must
  therefore also require `workflow_run.event == 'push'` and a head repository equal to this one, or
  fork-authored code runs in a job holding this repo's deploy secrets.
- A green-checks re-derive alone is not the guarantee either: it proves only that the SHA once had green
  checks, which an unmerged PR head satisfies. The re-derive must also assert ancestry on `main`.

Both halves are load-bearing. See the header of `we:.github/workflows/deploy.yml` for the full retraction.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
