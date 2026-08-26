---
kind: story
size: 2
status: open
scope: ["we:.github/workflows/deploy.yml"]
dateOpened: "2026-08-26"
tags: []
---

# Deploy only a CI-verified SHA — gate the Worker deploy on workflow_run and re-derive the verdict

`we:.github/workflows/deploy.yml` fired on push to main in PARALLEL with CI and deployed the branch tip regardless of whether CI passed or whether that tip was the tree CI tested. Branch protection never covered it (required checks gate a merge, not a push-triggered deploy). Switch the trigger to workflow_run on CI success, check out workflow_run.head_sha, and add a re-derive step that queries the check-runs API for the candidate SHA and refuses unless test and smoke are both green — trigger is wiring, the re-derive is the guarantee.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
