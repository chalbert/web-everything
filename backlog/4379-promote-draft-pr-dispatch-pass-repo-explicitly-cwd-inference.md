---
bornAs: x4ua3v8
kind: task
tier: pinned
status: resolved
scope: ["we:scripts/lib/draft-promote-provider.mjs", "we:scripts/operations/promote-draft-pr-dispatch.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
graduatedTo: 467349c87,bc5693278
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

1. **Executable** — this card resolves with `graduatedTo` naming the two commits that already shipped
   the fix + its owed soak break (no new code in this PR); verify both are on `main` and the unit test
   covering the `--repo` fix still passes:

   ```
   git merge-base --is-ancestor 467349c87 origin/main && git merge-base --is-ancestor bc5693278 origin/main
   npx vitest run scripts/lib/__tests__/draft-promote-provider.test.mjs
   ```

   Both commands exit 0 on `main` today. The soak break itself lives at `we:scripts/conveyor/soak/breaks/promote-draft-cross-repo.mjs`
   and runs under `npm run test:soak` (`we:vitest.soak.config.ts`) — CI's own `daemon-soak` job on PRs
   that touch daemon code, not this resolve-only PR, which touches no code. This is NOT a fresh
   red-before/green-after run of the fix itself — that proof already happened at `bc5693278`'s own
   authoring time; this criterion only re-confirms the shipped fix is still on `main` and its unit test
   still passes, which is all a resolve-only card (no new code) can assert.

## Progress

**Premise check (2026-09-29, conveyor-4379): already done on `main` before this card was JIT-numbered.**
This card was born as `x4ua3v8`. The fix it describes landed directly under that hash-id, in two
commits already on `main` — no `--repo` code change was needed here:

- `467349c87` — `we:backlog/x4ua3v8 - promote-draft-pr-dispatch: pass --repo explicitly (fix
  cwd-inferred cross-repo PR bug)`. Added `buildReadyArgs(pr, repo)` / threaded `repo` through
  `createDraftPromoteProvider` (`we:scripts/lib/draft-promote-provider.mjs`) and
  `runReconcilePromoteDraftDispatch` (`we:scripts/operations/promote-draft-pr-dispatch.mjs`) — the exact
  `## Fix` this card describes (confirmed by reading both files on this lane's fresh `main`: `graduatedTo`
  above is `git merge-base --is-ancestor`-verified reachable from it). The extended
  `we:scripts/lib/__tests__/draft-promote-provider.test.mjs` on `main` covers the same two cases this
  card's `## Tests` section describes (the `--repo`-appending case and the byte-identical omitted case).
- `bc5693278` — `we:backlog/x4ua3v8 - promote-draft-cross-repo: add the owed soak break (author
  continuation, PR #2880)`. Closed the daemon-behaviour-change soak-break obligation the mocked unit
  tests alone didn't cover (added `we:scripts/conveyor/soak/breaks/promote-draft-cross-repo.mjs`, proven
  red-before/green-after against the real live-incident failure text).

A later drain JIT-numbering pass (`ce5648e62`) assigned this hash the number `#4379` but never flipped
the card's `status:` — it stayed `open` on `main` while the code (and its soak break) were already
resolved. Re-confirmed against this lane's own fresh `main` (base of this lane clone): both commits are
ancestors of `HEAD`, `buildReadyArgs`/`createDraftPromoteProvider` already carry the `repo` param, and
`runReconcilePromoteDraftDispatch` already threads `repo: repoKey === 'we' ? undefined : repoSlug` — no
`blockedBy` edges, nothing stale, nothing to build. Resolved with `graduatedTo: 467349c87,bc5693278`
(the fix commit and the soak-break commit that together close this card's `## Done when`) rather than
building anything new.
