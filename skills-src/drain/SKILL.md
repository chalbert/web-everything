---
name: drain
description: Launch the deferred merge-queue drain — land the queued `lane/*` couples onto `main` via the standard PR transport, impl-first/WE-last, in cross-item `blockedBy` order. Use when the user asks to "drain the queue", "run the merge monitor/drain", "land the queued lanes", "watch the merge queue", or "clear the ready-to-merge couples". NOT for landing one specific committed change (that is `/pr`).
---

# Drain the deferred merge queue (#2162)

The whole mechanism lives in **[scripts/merge-ai-prs.mjs](../../../scripts/merge-ai-prs.mjs)** — this skill is
the trigger + the ceremony around one invocation, so there is nothing to keep in sync here. The drain is the
consumer side of the #2183 PR fan-out: producing sessions (parallel `/workflow` lanes, solo `#2123` lanes, and
batch closeout) each **open a `ready-to-merge` PR per item** (#2196); this drain lands those labelled PRs
serially, in a later session, under the same self-approved PR transport the producers use.

> **Converged label lander (#2188/#2194).** `/drain` **is** the label lander
> `scripts/merge-ai-prs.mjs --label=ready-to-merge` — bare = one cascade pass, `--watch` = the poll loop. It
> merges the open `ready-to-merge` PRs (incl. orphans opened directly by `/pr`) in cross-item `blockedBy` order
> (each PR's `.lane-manifest.json`, read off its head ref, supplies the edges), and the PR-merge IS the single
> clear point (no `queued.json` unqueue). `/merge` (bare) is the same lander without the label scope. The old
> `queued.json` / `scripts/lane-drain.mjs` couple-drain is retired to a legacy no-op fallback (see below) — new
> producer output lands via the label lander.

> **Two-form ids — the drain numbers hashes at land (#2288).** A queued item's files may lead with EITHER a
> landed numeric `NNN` or a provisional `xNNNNNN` **hash** (born hash-keyed so parallel lanes never race on
> `max+1`). The drain is the **sole serial writer to main**, so it assigns the real sequential `NNN` at land
> (`numberPendingHashes`, blind-rewriting the hash → number across the filename, the item's frontmatter/body,
> and every other item's edges) — you never hand-assign one. Both the primary lander (`merge-ai-prs.mjs`) and
> the `pr-land --fallback-git` route number, so no land path strands a hash on main (#xzxc92d).

## Preconditions

- **Run from an isolated clean clone on `main` — NEVER the shared primary checkout (#2197 / ratified #2123).**
  The drain is an edit-action session (it advances `main` and, per #2198, rebuilds lane tips), so #2123's
  "every edit-action session runs in an isolated clone" applies. The primary tree almost always carries a peer
  session's uncommitted work, and the drain's own post-merge `git pull --ff-only --autostash` then hits an
  autostash-pop conflict and strands the tree mid-merge (observed 2026-07-03: an autostash-pop conflict on
  `claims.json` left the primary half-merged; recovery was manual). Provision a fresh clone instead:

  ```
  git clone --local <primary> ../we-drain-clean && cd ../we-drain-clean
  git remote set-url origin <origin-url>           # push PRs to the real remote
  git reset --hard <origin/main sha>               # land on the true main (the local clone may be stale)
  ln -s <primary>/node_modules node_modules        # generators/gates need deps (+ siblings ../frontierui, ../plateau-app)
  ```

  A clone sibling of `webeverything` keeps `../frontierui` resolvable (cross-repo artifact builds need it).
  **Provision `../frontierui` and `../plateau-app` too (#2263)** — real clones next to `we-drain-clean`, same
  pattern as the WE clone itself:

  ```
  git clone <frontierui-origin-url> ../frontierui && (cd ../frontierui && git reset --hard origin/main)
  git clone <plateau-app-origin-url> ../plateau-app && (cd ../plateau-app && git reset --hard origin/main)
  ```

  With those present, `--all-repos`'s rebase-drop (#2198) can rebuild a CONFLICTING/BEHIND frontierui/
  plateau-app lane tip too — routed through the matching sibling clone, not just the local WE one. Missing a
  sibling clone is a graceful degrade, not an error: that repo's rebase-drop candidates fall back to `left for
  its author`, exactly as before #2263. The branch guard blocks `checkout -B`/`worktree add` even in a clone,
  so move `main` with `git reset --hard`, not a checkout. **Never `git pull` in the primary** — the sync below
  runs in the clone only.
- `gh` is authenticated (`gh auth status`) — landing is the same self-approved `gh pr merge` (0 required
  reviewers + the required `test` check) `/pr` uses. See [`/pr`](../pr/SKILL.md) for the transport.
- The clone's tree is clean: the post-merge sync (`git pull --ff-only --autostash`, in the clone) is a pure
  fast-forward there, so it never conflicts with a peer session's edits the way the primary would.

## Run it (the label lander — #2194)

`/drain` now drives the ONE label lander `scripts/merge-ai-prs.mjs --label=ready-to-merge`, **not**
`lane-drain.mjs` (the constellation sweep is the default since #2287 — no `--all-repos` needed; pass
`--this-repo` to scope to the cwd repo only). It sweeps the open `ready-to-merge` PRs and merges each as it becomes eligible (green +
mergeable), in cross-item `blockedBy` order (each PR's `.lane-manifest.json`, read off its head ref, supplies
the edges — the #2188 convergence).

> **One skill, all 3 repos — BY DEFAULT (#2257/#2287).** The single lander sweeps **every** constellation repo
> — web-everything **+ frontierui + plateau-app** — in ONE global `blockedBy` cascade, with **no flag needed**
> (#2287 made all-repos the default). This is why `/drain` stays a single skill instead of a copy per repo
> (#2244/#2245 superseded): the backlog is WE-global, so a frontierui PR can be `blockedBy` a WE item, and only
> a single cross-repo sequencer can order that. Every `gh` call is `--repo`-scoped; a remote-repo PR reads its
> manifest via the GitHub API (never a local clone). The rebase-drop (#2198) still needs local git plumbing
> (merge-tree/commit-tree/push): for the LOCAL clone's own repo it runs in place; for a remote repo it routes
> through that repo's **sibling clone** (`../frontierui`, `../plateau-app`) when the precondition above
> provisioned one (#2263) — so a CONFLICTING/BEHIND non-local lane tip gets rebuilt too, not just left for its
> author. No sibling clone provisioned ⇒ unchanged legacy skip. **Landing a frontierui/plateau PR still needs
> that repo's own required `test` check + branch protection (#2242/#2243/#2246)** or GitHub blocks the merge;
> until those land, those PRs surface here as `skip (required check "test" is not green)` rather than silently
> vanishing. Pass `--this-repo` to scope to the cwd repo only, or `--repos=owner/a,owner/b` for an explicit set.
> (`--all-repos` is still accepted — it's a no-op alias of the default now.)

```
node scripts/merge-ai-prs.mjs --label=ready-to-merge --dry-run                          # plan only — print the blockedBy-ordered merge order (across ALL 3 repos, the default) + deferred set, merge NOTHING
node scripts/merge-ai-prs.mjs --label=ready-to-merge --primary=<primary>                 # /drain (bare): ONE cascade pass across all 3 repos — land every ready labelled PR, exit
node scripts/merge-ai-prs.mjs --label=ready-to-merge --primary=<primary> --watch --interval=30 # /drain watch: keep polling; land each PR the instant it goes green (--max-idle=N bounds it; Ctrl-C stops)
node scripts/merge-ai-prs.mjs --label=ready-to-merge --primary=<primary> --watch --until-batches-idle # /drain watch that SELF-TERMINATES when the active batch is fully delivered (#2330)
node scripts/merge-ai-prs.mjs --label=ready-to-merge --this-repo                         # opt OUT: scope to the cwd repo only (a deliberately single-repo drain)
```

**Always dry-run first** to show the merge plan, then run bare (one-shot) or `--watch` (follow). Prefer the
one-shot unless the user wants a long-lived monitor waiting for producers still opening PRs.

**`--until-batches-idle` — a batch-aware exit for a drain launched to land a batch (#2330).** `--max-idle=N` is
UNSAFE for a live batch: items take minutes, so the watch goes idle *between* PRs and `--max-idle` would exit
mid-batch. `--until-batches-idle` instead exits only when the safe conjunction holds — **no `kind:batch
status:running` run remains** AND the **ready-to-merge queue is empty** AND **nothing is deferred** — debounced
over `--batch-idle-debounce` passes (default 2). It reads the running-batch signal from the active-progress feed
(`_site/active-progress.json`, written by `scripts/dev/active-progress-watch.mjs`); an **absent/stale feed ⇒
keep watching, never a false stop**. The feed only exists while that dev watcher runs, so for a drain-only
session point `--batch-feed=<path>` at the primary checkout's copy (else the drain harmlessly runs unbounded —
it now prints a one-time note when the feed is absent so the inert degrade is visible). Before honoring the
exit the drain **re-polls once** to confirm the ready-to-merge queue is genuinely empty (the last PR's label
can lag the producer's resolve — the #2230 defense, so the final PR is never dropped). Keep
`--batch-feed-stale-sec` (default 30s) comfortably above the watcher's ~4s write cadence.
*(Design note carried from the #2330 review: the feed is a dev-only, website-facing artifact — a later
refinement should read the batch journals directly to drop that coupling; the exit contract above is unchanged.)*

> **Pass `--primary=<primary>` so the post-land sync can find your primary checkout (#xwokc1n).** After each
> land the drain fast-forwards the user's primary checkout to the advanced `origin/main` so it never rots. It
> locates that primary via `--primary=<path>` (or the `WE_PRIMARY` env), falling back to the clone's git
> alternates. The provisioning above uses `git clone --local`, which creates **no** alternates file — so
> **without `--primary`/`WE_PRIMARY` the primary is never synced and silently drifts** (observed 75 commits
> behind). The sync is a pure `git pull --ff-only` and **only touches a primary that is on `main` with a clean
> tree** — a dirty primary (a peer session's uncommitted work) is left UNTOUCHED and logged, never autostashed
> or stranded (the 2026-07-03 incident). Omit the flag deliberately if you do NOT want your primary advanced.

## How it works (per pass)

1. Lists the open PRs carrying the `ready-to-merge` label (`gh pr list --label ready-to-merge`) — every
   producer (`/workflow`, `/pr`, solo `#2123` lanes, batch closeout) applies it (#2196), so this is the single
   collection point for ALL AI-generated work.
2. For each candidate, reads its `.lane-manifest.json` off its head ref and orders by cross-item `blockedBy` —
   a PR whose blocker is still an open (unlanded) PR **defers** to a later pass (the cascade). Orphan PRs (no
   manifest) are always ready.
3. **Rebase-drops the shared manifest (#2198)** — a certified + green PR that is only CONFLICTING/BEHIND on the
   one shared `.lane-manifest.json` path is rebuilt onto `main` (manifest dropped) via pure plumbing (no
   checkout) before merging, so the "manifest lands then conflicts every other PR" wall no longer stalls the
   queue. A real (non-manifest) code conflict is left as a skip for a human. On by default; `--no-rebase-drop`
   disables. A rebuilt tip re-runs `test`, so it lands on a later `--watch` pass (expected, not a failure).
4. Merges each ready PR via the SAME self-approved, non-admin `gh pr merge --merge --delete-branch` the `/pr`
   flow uses — only when its required `test` check is green and GitHub reports it cleanly mergeable. A merge
   **frees its dependents** the next inner pass; a failed/behind PR stays blocking its dependents (never land
   past a broken blocker). The closed PR carries the label away — that PR-merge IS the single clear point (no
   `queued.json` unqueue).
5. After anything merged, fast-forwards **the clone's** local `main` to the advanced `origin/main`
   (`git pull --ff-only --autostash`, best-effort) — in the isolated clone, never the primary checkout.

## Auto-review the parked PRs (#2285 v1)

The #2171/#2262 review-escalation gate **parks** a blast-radius PR (`review:pending`) and waits for an
independent reviewer to apply `review:accepted`/`review:changes` — otherwise every escalated PR stalls the
queue until a human gets to it. **v1 makes the drain run that independent review itself, via a subagent** — for
the PRs where an agent reviewer is genuinely independent of the *producer*. The one invariant it preserves:
**a landed PR was accepted by an agent that did not author it.**

> **One engine (#2326).** The `{findings, verdict}` contract is single-sourced in `we:scripts/lib/review-core.mjs`
> (#2325): `buildMandate()` renders the judge-only instruction the review subagent is seeded with (it bakes in
> the #2336 diff-only, **no-checkout** clause), `normalizeFindings()` shapes what it returns, and
> `deriveVerdict()` maps findings → `accept`/`changes`/`needs-human`. The drain review below and the
> [`/review`](../review/SKILL.md) human-verdict skill BOTH render through it — no hand-rolled reviewer prose.

The lander classifies each parked PR (see `we:scripts/lib/review-escalation.mjs` `isGateSelfPath`) and emits it
in the `--json` output's `parked` array as `{ num, repo, humanRequired, reasons }`:

- **`humanRequired: true` → `review:human`.** The diff edits the **auto-review trust chain itself**
  (`we:scripts/lib/review-escalation.mjs` or `we:scripts/merge-ai-prs.mjs`) — the code that decides whether the
  gate fires and what clears it. An agent reviewing this would be policing a change to its own leash (conflict
  of interest), so a **human** review is essential. The drain applies `review:human` and this PR **never times
  out** to `merge-anyway`. It is **not agent-clearable** — never auto-apply `review:accepted` to a `review:human`
  PR.
  **New (#2326) — still run an ADVISORY AI review.** Don't leave it dark: run the shared core on the
  `review:human` diff too (seed a fresh-context subagent with `buildMandate()`; shape via `normalizeFindings()`
  + `deriveVerdict()`) and **post its take as a PR comment clearly marked `🤖 advisory AI review (non-clearing)`**
  — findings + verdict, to inform the human. It **must not** apply any `review:*` label (the conflict-of-interest
  invariant is unchanged); it only informs. Then surface the PR for the operator, who clears it with
  [`/review <PR>`](../review/SKILL.md).
- **`humanRequired: false` → agent-reviewable.** Escalated (blast-radius / size / dismissed-findings / sampling)
  but independent of the producer. **Auto-review it through the core:**
  1. Get the diff: `gh pr diff <num> --repo <repo>` (and `gh pr view <num> --repo <repo> --json title,body,files`).
  2. Spawn a **fresh-context adversarial review subagent** (the `Agent` tool, e.g. `general-purpose`) seeded with
     `we:scripts/lib/review-core.mjs` `buildMandate()` — it sees ONLY the diff + PR description, not this
     session's context, and (per the mandate) **never checks out the PR branch** in the shared tree (#2336; any
     test/repro runs in a throwaway clone). Shape its answer with `normalizeFindings()` and reduce it to a
     verdict with `deriveVerdict()`: **accept** (empty/non-blocking findings) or **changes** (a concrete blocking
     finding, cited).
  3. Apply the verdict as a label: accept → `gh pr edit <num> --repo <repo> --add-label review:accepted`;
     changes → `--add-label review:changes` (which routes the fix back to the **author lane**, not the drain —
     v1 does **no** drain-side editing; that convergence loop is v2, epic #2285).
  4. **Re-run the drain** (a bare pass) — a PR now carrying `review:accepted` clears the gate and lands.

> **The label must exist.** `review:human` is provisioned like the other `review:*` labels (see #2262/#2279);
> if it is missing, `gh pr edit --add-label review:human` silently no-ops. Ensure it exists once:
> `gh label create review:human --description "conflict-of-interest: gate-self edit, a human must review" --color B60205 --force`.

**v2/v3 (later, under epic #2285):** v2 replaces the author-bounce with an editor↔reviewer **negotiation loop**
(auto-fix that converges, N-round cap → `review:human`); v3 adds a **multi-mandate reviewer panel** (correctness
/ security / simplicity / standards — unanimous accept lands, mandate conflict → `review:human`).

## Exit codes (surface these)

- `0` = swept clean (merged 0+ qualifying PRs, none failed) or a dry-run.
- `2` = at least one merge attempt FAILED (surfaced per PR). A deferred PR (blocker unlanded) is not a failure.

## Legacy `queued.json` fallback

The old `queued.json` / `scripts/lane-drain.mjs` couple-drain is **retired as the primary path** — new producer
output opens a `ready-to-merge` PR (above), never a `queued.json`-only couple. `lane-drain.mjs` stays only as a
no-op fallback for any **legacy** couple still sitting in `queued.json` (`node scripts/lane-drain.mjs drain
--dry-run` shows it; it is a clean no-op when the queue is empty). Do not reach for it unless a dry-run shows a
stranded legacy couple.

## Guardrails

- **Re-uses the shared transport, never re-implements it:** PRs land via the same self-approved `gh pr merge`
  (0 required reviewers + the required `test` check) `/pr` uses — never `--admin`, never a raw `git merge`/`git
  push` of `main`.
- **Never force-updates a PR branch** — a `BEHIND` PR (needs rebase) is left for its author / a later pass,
  never force-rebased by the sweep.
- **Label-scoped:** with `--label=ready-to-merge` the sweep only touches PRs a producer certified (#2196).
  Bare (`/merge`, no label) it also sweeps orphan AI PRs on the every-commit-AI gate — see [`/merge`](../merge/SKILL.md).
