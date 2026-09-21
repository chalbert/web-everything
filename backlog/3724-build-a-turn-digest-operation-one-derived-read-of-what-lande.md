---
bornAs: xcqg649
kind: story
size: 5
parent: "3718"
status: open
relatedTo: ["3677", "2612", "3722"]
scope: ["we:scripts/operations/turn-digest.mjs", "we:scripts/operations/turn-digest-io.mjs", "we:scripts/operations/__tests__/turn-digest.test.mjs"]
dateOpened: "2026-09-19"
tags: []
---

# Build a turn-digest operation: one derived read of what landed, what is owed, what needs the operator, and what is live

Every turn a session re-derives live state by hand. Compose the reads that already exist into ONE declared, read-only operation, and add the one missing piece: a "landed since" cursor.

## The hand-run checks this replaces

From the 2026-09-19 session: fetch `main`; list open PRs with labels and `mergeStateStatus` in each repo; work out which PRs merged since last turn; run the operator queue; run the reconcile plan; spot conflicts and stale labels; list live sessions and free lanes. Search verdicts (checked by reading, not by the token score alone):

| Check | What exists | Gap |
|---|---|---|
| Live PR state, both repos | `we:scripts/operations/pr-status.mjs`, `we:scripts/conveyor/open-pr-fetch.mjs` (one shared snapshot) | one call across repos; `we:scripts/conveyor/reconcile-pass.mjs` is single-repo (`--repo`), `we:scripts/operations/operator-queue.mjs` already spans three |
| What landed since last turn | nothing found | no cursor or "since" primitive anywhere; nearest evidence is the drain daemon's per-pass history and `git log` on `main` |
| What needs the operator | `we:scripts/operations/operator-queue.mjs` (hardened by #2338) | none; call it |
| What is owed | `we:scripts/conveyor/reconcile-pass.mjs` | none; call it |
| Conflict, and a stale `merge-status:conflicting` label | `we:scripts/conveyor/parked-pr-conflict-watch.mjs` detects (merge-tree, no checkout) and self-clears, but only inside the runner tick, and only for review-parked PRs | the digest REPORTS a label that disagrees with current mergeability; it does not write |
| Live sessions and lanes | `we:scripts/operations/runner-activity-io.mjs`, `lane-pool list --acquirable` | depends on #3725 and #3721 to be trustworthy |

## Shape

- A `compute`-only declared operation (no effects, no model), `turn-digest [--since=<cursor>] [--repos=…]`, that calls the reads above and returns one structured verdict: `landed[]`, `needsOperator[]`, `owed[]` (dispatch and refusals), `staleLabels[]`, `live` (sessions, in-flight dispatches, free lanes), `runner` (up, down, paused), and `generatedAt`.
- **The one new piece — a landed-since cursor.** `landed` = the first-parent merge commits on `origin/main` after the cursor sha (each is `Merge pull request #N …`), a pure git read that needs no `gh` call. The cursor is stored per consumer (a session id), so two sessions each get their own "since", and a first call with no cursor returns the last N.
- Read-only, so it is safe to run every turn, and it can be the plan step of other operations (#3720 calls the same reads for capacity and ownership).
- Persist the last result as a snapshot file with `generatedAt`, written atomically under the operations state root (the way `we:scripts/operations/run-store.mjs` resolves it, with an env override), never committed. The delivery hook (#3726) reads only this file.

## Irreducible judgment stays out

The digest states facts and refusals. It does not decide whether to clear a stood-down PR, rule a decision, pick a duplicate-PR keeper, resolve a semantic conflict, or choose what to build next. Those are the model's or the operator's, and the digest's job is to hand them a correct, current picture.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/turn-digest.test.mjs` passes; its cases fail before: `landed` lists exactly the PR numbers merged after the cursor on a fixture history and is empty when nothing merged; a PR whose `merge-status:conflicting` label disagrees with its current mergeability appears in `staleLabels`; the same fixture yields the same digest twice (deterministic); no effect is declared.
2. **Probed live** — one call against the real repos reproduces what the 2026-09-19 session assembled by hand: the same needs-operator set as `we:scripts/operations/operator-queue.mjs`, the same owed set as `we:scripts/conveyor/reconcile-pass.mjs`, and the PRs that merged since a chosen `main` sha.
