---
bornAs: xd0c0h3
kind: task
parent: "4075"
status: open
scope: ["we:scripts/lib/github-app-auth-env.mjs", "we:scripts/lib/github-app-token.mjs", "we:scripts/conveyor/github-app-status.mjs"]
dateOpened: "2026-09-26"
tags: []
---

# github-app-auth-env: an all-repos installation's repo-access check can wrongly report insufficient-access during GitHub's own listing lag

Live-caught 2026-09-26: both daemons logged an insufficient-access gap every tick, listing every required permission and repo as missing, while a fresh manual mint at the same moment showed everything correctly granted. we:scripts/lib/github-app-auth-env.mjs#findInstallationGaps' repo check depended entirely on enumerating `GET /installation/repositories`, which can lag the installation's own `repository_selection` field right after a permission/repo-access change — a transient, incomplete listing got reported as a confirmed, permanent gap, indistinguishable from a listing failure. Fix: read `repository_selection` off `GET /app/installations/{id}` (via the App's own JWT, we:scripts/lib/github-app-token.mjs) and treat `'all'` as satisfying every repo requirement without depending on the enumeration; add a distinct `access-check-failed` reason (we:scripts/conveyor/github-app-status.mjs) so a verification failure is never reported as a confirmed gap.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/github-app-auth-env.test.mjs we:scripts/lib/__tests__/github-app-token.test.mjs we:scripts/conveyor/__tests__/github-app-status.test.mjs` passes (red against the pre-fix code, green after).
2. **Live confirmation** — the daemon overlay-loaded fix stops logging the gap message and the App auth status reads `applied:true` on the live installation.
