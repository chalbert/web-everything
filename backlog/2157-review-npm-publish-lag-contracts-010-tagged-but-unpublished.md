---
kind: task
status: open
relatedTo: ["907", "2156", "2138", "2152"]
humanGate: { kind: credential, what: "Publishing the tagged 0.1.0 requires a credentialed npm publish (workflow_dispatch of we:.github/workflows/publish-contracts.yml with NPM_TOKEN) AND main reliably green via the operating PR-lane merge flow — neither agent-executable. The auto-lock-on-merge reassessment can follow once the publish itself is unblocked." }
dateOpened: "2026-07-02"
tags: [npm, publishing, ci, release-please, pr-flow]
---

# Review the npm-publish lag: @webeverything/contracts 0.1.0 tagged but not published

The first release ran but only half-completed and is now **lagging** — a GitHub Release + tag exist, but npm
does not have the package. Review and clear this once the blocker lifts.

## State (verified 2026-07-02)

- ✅ Release PR #2 merged → tag **`contracts-v0.1.0`** + GitHub Release created; manifest and
  `we:contracts/package.json` are at `0.1.0`.
- ❌ **npm publish never ran.** `npm view @webeverything/contracts` → E404. The publish job runs the
  **whole-repo** `npm run check:standards`, which was red with ~27 foreign errors (other items' `relatedReport`
  files missing on `main` + stale `we:AGENTS.md` inventory) — nothing about the contracts package.
- Side issue: a bot (`github-actions[bot]`) **auto-locks release PRs seconds after merge**, racing
  release-please's post-release comment and failing that job (release still gets created). Recurs every release.

## Why blocked

`npm publish` is coupled to the whole-repo health gate, so releasing is hostage to unrelated backlog debt on a
shared, concurrently-edited `main`. **Blocked by the PR-lane merge flow fully delivering** (#2138 / #2152):
once landing goes through PRs with required green CI + a merge queue, `main` can no longer sit red, and the
gate stops blocking releases. Owner decided (2026-07-02) NOT to decouple the publish gate for now.

**Review 2026-07-04 — the code blocker has LIFTED (stale `blockedBy` cleared).** #2138/#2152 are resolved and
the PR-lane merge flow is the operating reality: `main` moves only through CI-gated PRs (reinforced by the
#2203 strict lock + #2217 pre-push hook + #2216 green-reconcile drain landed this session), so `main` no longer
sits red from unrelated debt and the whole-repo gate stops holding releases hostage. **The one remaining gate
is the humanGate** — a credentialed `npm publish` of the already-tagged `0.1.0` (`workflow_dispatch` of
`we:.github/workflows/publish-contracts.yml`, `dry-run=false`, with `NPM_TOKEN`), which is **not
agent-executable**. So this stays `open` on the credential gate only, not on a backlog dependency.

## To do when unblocked

- Publish 0.1.0 once via the fallback (release-please won't re-publish it — its manifest already records 0.1.0
  as released): `we:.github/workflows/publish-contracts.yml` dispatched with `dry-run=false`. Confirm
  `npm view @webeverything/contracts` returns `0.1.0`. Future versions (0.1.1+) flow through release-please.
- Reassess the **auto-lock-on-merge** race (find/adjust the locking automation, or make release-please tolerant)
  so release jobs stop reporting failure.
- Revisit whether to decouple the publish gate or give it a package-scoped check (#2156 option C).
