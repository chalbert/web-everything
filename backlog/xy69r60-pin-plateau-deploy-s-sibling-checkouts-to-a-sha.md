---
kind: task
parent: "xtfrvc3-real-multi-repo-support-across-the-conveyor"
status: open
scope: ["plateau:.github/workflows/deploy.yml"]
dateOpened: "2026-09-23"
tags: []
---

# pin plateau deploy's sibling checkouts to a SHA

Found fixing plateau-app #170 (2026-09-23): plateau:.github/workflows/deploy.yml checks out the web-everything and frontierui siblings at their default branch, not a pinned SHA, and runs their scripts during the deploy job. #170 split the smoke step so the publish token never shares a process with that code, which contains the token exposure, but any other step running sibling code inherits the same unpinned-supply risk. Pin both checkouts to a verified SHA.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
