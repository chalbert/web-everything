---
bornAs: xgfzlj1
kind: story
size: 2
parent: "3383"
status: resolved
scope: ["we:scripts/conveyor/parked-pr-conflict-watch.mjs"]
dateOpened: "2026-09-06"
dateStarted: "2026-09-06"
dateResolved: "2026-09-06"
graduatedTo: none
tags: []
---

# parked-pr-conflict-watch: verify gh pr list --json files is complete for a large PR

PR #1966's independent review (security finding, 3544): isStatuteTierConflict only inspects pr.files from one gh pr list --json ...,files call. If that field is capped/paginated by the GitHub API for a PR touching very many files, a statute-tier file present in the diff but past the returned page would not appear, so the Fork-2 safety carve-out could wrongly route a genuinely statute-tier conflict to auto-dispatch instead of a human stand-down. Add an explicit test/assertion (or documented, verified guarantee) that this files field is complete regardless of PR size, or an explicit fallback (gh pr diff --name-only / paginated gh api) if gh pr list truncates it.

**Confirmed root cause (live, 2026-09-06):** `gh pr list --json files` resolves the `files` field over `gh`'s
own GraphQL query, which hardcodes `files(first: 100)` with **no pagination** — confirmed reading
`cli/cli@trunk`'s `api/query_builder.go` against the installed `gh` 2.95.0, and independently tracked upstream
as an acknowledged bug, not a documented limit (cli/cli discussion #6930, issue #5368: "we would paginate and
fetch all files entries internally instead of being limited to 100 entries"). So a PR touching ≥100 files gets
a **silently truncated** `files` array with no error signal at all — the exact gap the finding named.

**Fix:** `isStatuteTierConflict` now documents that its caller owes a *verified-complete* file list.
`watchParkedPrConflicts` (`we:scripts/conveyor/parked-pr-conflict-watch.mjs`) trusts `pr.files` as-is only when
its length is under the confirmed 100-file cap (`GH_FILES_GRAPHQL_CAP`) — provably complete, since gh would have
returned every file below that count. At or above the cap, it re-fetches via a new `defaultListPrFiles`, which
pages the REST `pulls/{number}/files` endpoint with `gh api --paginate` (follows the `Link` header, no cap). If
that re-fetch itself fails, it fails **over-cautious** (treated as statute-tier → stand-down), never silently
falling back to the possibly-truncated list — matching this predicate's own documented safe direction.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/parked-pr-conflict-watch.test.mjs` — the 5
   `#3543` cases (an under-cap files array is trusted with zero extra `gh` calls; an at-cap array is
   re-verified and a statute-tier file past the truncation boundary is now caught, routing to stand-down instead
   of auto-dispatch; a verified-clean re-fetch still dispatches normally; a failed re-fetch fails over-cautious
   to stand-down) fail against the pre-fix source and pass after.
