---
kind: task
parent: "4075"
status: open
scope: ["we:scripts/lib/github-app-auth-env.mjs", "we:scripts/lib/github-app-token.mjs", "we:scripts/conveyor/github-app-status.mjs"]
dateOpened: "2026-09-26"
tags: []
---

# github-app-auth-env: an all-repos installation's repo-access check can wrongly report insufficient-access during GitHub's own listing lag

Live-caught 2026-09-26 ~10:05 ET: both daemons logged 'App installation is missing access the fleet needs' every tick, listing ALL required permissions and ALL required repos as missing, while a fresh manual we:scripts/lib/github-app-token.mjs#mintInstallationToken call at the same time showed every permission correctly granted and GET /installation/repositories returning all 3 required repos (of 42 total). Root cause: we:scripts/lib/github-app-auth-env.mjs#findInstallationGaps' repo check depends entirely on enumerating GET /installation/repositories, which can lag the installation's own repository_selection field right after a permission/repo-access change (GitHub-side propagation delay) — so a transient, incomplete listing gets reported as a confirmed, permanent gap, and a listing failure was indistinguishable from a confirmed miss. Fix: read repository_selection off GET /app/installations/{id} (via the App's own JWT, we:scripts/lib/github-app-token.mjs) and treat 'all' as satisfying every repo requirement without depending on the enumeration; add a distinct access-check-failed reason (we:scripts/conveyor/github-app-status.mjs) so a verification failure never gets reported as though every required permission/repo were confirmed missing.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
