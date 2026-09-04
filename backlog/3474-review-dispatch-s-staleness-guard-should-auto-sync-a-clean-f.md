---
bornAs: xpezx0h
kind: task
parent: "3383"
status: open
dateOpened: "2026-09-03"
tags: []
---

# review-dispatch's staleness guard should auto-sync a clean fast-forward instead of refusing

`we:scripts/operations/review-dispatch.mjs`'s `assertMainNotStale` guard (citing `#3439`) correctly refuses to dispatch when the checkout is behind `origin/main`, but stops one step short: it always refuses and hands the sync back to the caller, even when a plain fast-forward would apply with zero conflict. Make the mechanical case mechanical.

## The gap, confirmed live (2026-09-03/04)

`assertMainNotStale` (`we:scripts/operations/review-dispatch.mjs:257-285`) wraps `checkMainStaleness` (`we:scripts/lib/main-staleness.mjs`) with `autoFf: false` and throws:

> `review-dispatch: the dispatching checkout is N commit(s) behind origin/main — refusing to dispatch a review that would run STALE code from this checkout's own import path (#3439). Sync (git pull --ff-only) or dispatch from a fresh clone of origin/main and retry.`

Hit for real tonight: the primary checkout fell 2 commits behind mid-dispatch-loop (other PRs merged concurrently), the guard correctly refused, and a person had to manually `git fetch` / `git merge --ff-only` before retrying — a fully mechanical, zero-judgment step. A clean fast-forward has, by definition, no conflict to resolve, so nothing about performing it needs a human or an agent's judgment.

The operator's own framing, verbatim: "We should better handle the rebase, ideally mechanical unless conflict to resolve."

## Where the guard actually lives (both call sites use the SAME function)

`assertMainNotStale` is not local to `we:scripts/operations/review-dispatch.mjs` — `we:scripts/conveyor/reconcile-fix-dispatch.mjs` imports it directly (line 66) and calls it in `runReconcileFixDispatch` (line 192), guarding fix-agent dispatch the identical way. So the fix belongs in `assertMainNotStale` itself, once — not duplicated per caller. (`we:scripts/operations/dispatch-lane.mjs` was checked and does **not** import `checkMainStaleness`/`assertMainNotStale` at all; it has no staleness guard of this shape today, which is a separate, pre-existing gap, not something this item's fix needs to touch.)

Useful, already-landed precedent: the underlying `checkMainStaleness` helper (`we:scripts/lib/main-staleness.mjs`) already HAS an auto-fast-forward mode (`autoFf`, default `true`) — `git pull --ff-only --autostash`, used exactly this way today by `we:scripts/check-readiness.mjs:104` (`checkMainStaleness({ autoFf: true })`). `we:scripts/operations/review-dispatch.mjs` deliberately opted OUT of it (`autoFf: false`), reasoning in its own comment that "this checkout may carry uncommitted work a caller does not expect mutated" — i.e. it didn't want the helper's `--autostash` silently stashing/popping a dispatching session's dirty tree. That reasoning is sound but the fix it produced (always refuse) is stronger than needed: a **clean** tree that is merely behind (not diverged) should still auto-sync; only a dirty tree needs the caller's judgment preserved.

## The fix, precisely

When the checkout is behind `origin/main` but a fast-forward would apply cleanly — not diverged (no local commits ahead) — perform the sync automatically (`git merge --ff-only origin/main` or equivalent) and let dispatch proceed, instead of throwing. Only refuse/escalate when the fast-forward itself would fail:

- **Diverged** (local commits ahead of the merge-base) — a genuine conflict risk; keep refusing with (a shape of) today's message.
- **Dirty working tree** — local uncommitted changes. **Must also block the auto-sync**, not merely be tolerated by an autostash-and-pop the way `we:scripts/lib/main-staleness.mjs`'s existing `autoFf` mode does for the read-only ranker. Never auto-merge over dirty local state in a dispatch chokepoint — this is an explicit edge case the fix must handle correctly, not an oversight to discover later. (Whether that reuses `checkMainStaleness`'s existing `autoFf` semantics with a stricter clean-only gate, or a narrower purpose-built check, is an implementation choice for whoever builds this — not re-litigated here.)
- **Fetch failure / offline** — keep the existing fail-soft behavior (don't block on a network miss).

This is a forced-invariant fix, not a design fork worth scaffolding as a `decision`: auto-sync-when-clean is strictly better than always-refuse, at any reasonable implementation cost — there is no real tradeoff to rule on, which is why `kind: task` is correct here. Per this repo's own Hookable-vs-Judgment rule, "sync a clean fast-forward" is script-decidable (a `--ff-only` check either succeeds or doesn't) and belongs in the guard itself, not punted back to a caller every single time.

## Done when

1. **Executable** — a test (e.g. added to `we:scripts/operations/__tests__/review-dispatch.test.mjs`'s existing `assertMainNotStale` `describe` block) exercises three shapes and asserts: (a) behind + not diverged + clean → no throw, sync performed, dispatch proceeds; (b) behind + diverged (local ahead) → still throws, same refusal class as today; (c) behind + not diverged + dirty working tree → still throws / refuses, auto-sync NOT attempted over the dirty tree.
2. Both existing call sites — `we:scripts/operations/review-dispatch.mjs#dispatchReview` and `we:scripts/conveyor/reconcile-fix-dispatch.mjs#runReconcileFixDispatch` — pick up the fixed behavior through the single shared `assertMainNotStale`, with no per-caller duplication.
3. The refusal message for the still-refusing cases (diverged, or dirty-and-behind) stays as informative as today's — a future hit of either case should not read as a regression in clarity, only in frequency.
