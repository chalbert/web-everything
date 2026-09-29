---
bornAs: x4ua3v8
kind: task
tier: pinned
status: open
scope: ["we:scripts/lib/draft-promote-provider.mjs", "we:scripts/operations/promote-draft-pr-dispatch.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# promote-draft-pr-dispatch: pass --repo explicitly (cwd inference silently targets WE for cross-repo PRs)

## Problem

`we:scripts/lib/draft-promote-provider.mjs#buildReadyArgs(pr)` builds `gh pr ready <pr>` with no `--repo`
flag, relying on `gh` inferring the target repo from the current process's `cwd` git remote. That is safe for
`we:scripts/pr-land.mjs` (`we:scripts/lib/forge-land-provider.mjs`'s own convention), which always runs with
`cwd` pointed at a checkout of the exact repo it is landing into.

It is NOT safe for `we:scripts/operations/promote-draft-pr-dispatch.mjs`:
`we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs#runPromoteDraftDispatchAllRepos` drives it from ONE
process rooted in the WE checkout, looping every constellation repo (`we:scripts/lib/for-each-repo.mjs`) via
`repo` slug only — `cwd` never changes. Every `chalbert/plateau-app` / `chalbert/frontierui` PR number the
daemon tries to un-draft is resolved against `chalbert/web-everything` instead. Confirmed live 2026-09-28:
`reconcile-fix-dispatch-daemon: refused ready-failed chalbert/plateau-app PR #187 — Command failed: gh pr
ready 187`; the operator promoted #187 by hand as a labelled emergency.

## Fix

Thread the resolved gh `owner/name` slug through `createDraftPromoteProvider`/`buildReadyArgs`
(`we:scripts/lib/draft-promote-provider.mjs`) as an explicit `--repo` flag (mirrors
`we:scripts/lib/review-label-provider.mjs`'s `GH_ARGV`, which never relied on `cwd` inference at all), wired
through `we:scripts/operations/promote-draft-pr-dispatch.mjs`'s default provider construction. `repo` stays
optional so the WE-default path (and existing unit tests) are byte-identical when omitted.

## Audit follow-up (this same card)

Sibling gh providers audited for the same cwd-inferred-repo assumption:
- `we:scripts/lib/forge-land-provider.mjs` (`createGhLandProvider`, used only by `we:scripts/pr-land.mjs`) —
  SAFE. Its own header documents why: `cwd` is always bound to a checkout of the repo being landed into (a
  lane clone or the primary), never a cross-repo PR number resolved from an unrelated cwd.
- `we:scripts/lib/review-label-provider.mjs` (`createGhProvider`, used by the review daemon and
  `we:scripts/review-set-label.mjs` / `we:scripts/conveyor/review-round-tag.mjs` /
  `we:scripts/conveyor/review-status-tag.mjs` / `we:scripts/conveyor/parked-pr-conflict-watch.mjs` / others) —
  SAFE. Every `GH_ARGV` builder already takes an explicit `repo` and passes `--repo <repo>` per call; no cwd
  inference.
- `we:scripts/lib/draft-promote-provider.mjs` (`createDraftPromoteProvider`) — THE BUG, fixed by this card.

No other cwd-inferred-repo `gh` provider found in the fix/review daemon families as of this audit.

## Tests

`we:scripts/lib/__tests__/draft-promote-provider.test.mjs` extended: `buildReadyArgs(pr, repo)` appends
`--repo <repo>` when given, omits it when not (byte-identical default). A plateau-app PR fixture proves the
dispatcher now emits `--repo chalbert/plateau-app` for a non-WE reconcile entry (fails before this fix, passes
after).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
