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

- **Run from a LEASED lane-pool clone — NEVER the shared primary checkout (#2197 / ratified #2123).** The
  drain is an edit-action session (it advances `main` and, per #2198, rebuilds lane tips), so #2123's "every
  edit-action session runs in an isolated clone" applies. The primary tree almost always carries a peer
  session's uncommitted work, and the drain's own post-merge `git pull --ff-only --autostash` then hits an
  autostash-pop conflict and strands the tree mid-merge (observed 2026-07-03: an autostash-pop conflict on
  `claims.json` left the primary half-merged; recovery was manual). **Acquire a lease on the general
  lane-pool allocator (#2275/#2303)** instead of hand-rolling a clone — the drain is just another consumer
  of the same primitive `/batch`/solo `#2123` lanes use:

  ```
  node scripts/lane-pool.mjs acquire --purpose=drain --session=<drain-session-slug> --json
  ```

  This claims an exclusive `.git/.lane-lease` marker on the lowest free pool lane (or `--lane=N`), then
  `reset --hard`s it to `origin/<branch>` and ensures its `node_modules` (`npm ci`, real per-lane deps — no
  primary symlink) — exactly the "land on true `main` with deps present" state the old hand-rolled recipe
  manually constructed, but held so no concurrent `refresh`/`provision`/`acquire` can yank it mid-cascade.
  The JSON reply is `{ lane, path, session, purpose, branch }` — `cd` into `.path` and work there. `cd` back
  to `.path`'s repo root before every command below; do not run them from the primary. When the drain is
  done (a one-shot pass finishes, or a `--watch` loop exits/is stopped), hand the lane back:

  ```
  node scripts/lane-pool.mjs release --lane=<lane> --session=<drain-session-slug>
  ```

  `--session` (or the `LANE_SESSION` env) ties one `acquire` to its matching `release` — reuse the SAME
  slug for both calls. A `--watch` drain acquires ONCE at start and releases ONCE at exit, not per pass. If a
  release is skipped (a killed `--watch`), the lease self-reclaims after its TTL (`DEFAULT_LEASE_TTL_MINUTES`
  = 240) — a crashed drain returns its lane to the pool the same day, not never. The checkout root is
  allocator config (`LANE_POOL_ROOT` env, default `~/workspace/.lanes`) — no skill embeds a literal
  `../we-drain-clean` or `.lanes` path.

  The pool already carries the render sibling every WE checkout needs: `../frontierui` at the pool root
  (`scripts/lane-pool.mjs` `ensureFuiSibling`, #2166), resolvable from a leased lane exactly as from a
  provisioned one — no extra step. `../plateau-app` has no pool-root sibling **yet** (tracked separately,
  #2349 — generalizing the FUI symlink into a per-repo pushable+built clone for both `frontierui` and
  `plateau-app`); until that lands, `--all-repos`' rebase-drop (#2198) degrades exactly as it did before
  #2263 for any repo with no sibling present — `left for its author`, never an error. The branch guard blocks
  `checkout -B`/`worktree add` even in a lane, so `acquire`'s own `reset --hard` is how the lane lands on
  `main` — never a manual checkout. **Never `git pull` in the primary** — all of this runs in the leased lane
  only.
- `gh` is authenticated (`gh auth status`) — landing is the same self-approved `gh pr merge` (0 required
  reviewers + the required `test` check) `/pr` uses. See [`/pr`](../pr/SKILL.md) for the transport.
- The lane's tree is clean on acquire (a fresh `reset --hard` + `clean -fd`): the post-merge sync (`git pull
  --ff-only --autostash`, in the lane) is a pure fast-forward there, so it never conflicts with a peer
  session's edits the way the primary would.

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
> through that repo's **sibling clone** (`../frontierui`, `../plateau-app`) when the leased lane's pool root
> carries one (#2263; the pool-root `../frontierui` symlink, #2166 — see the precondition above) — so a
> CONFLICTING/BEHIND non-local lane tip gets rebuilt too, not just left for its author. No sibling clone
> provisioned ⇒ unchanged legacy skip. **Landing a frontierui/plateau PR still needs
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
> alternates. **A leased lane-pool clone (#2303) IS `git clone --reference`-based**, so it carries an
> alternates file pointing at the pool's reference checkout (normally the primary) — the fallback now
> usually resolves it automatically, unlike the old hand-rolled `git clone --local` recipe (which created
> **no** alternates file, so without `--primary`/`WE_PRIMARY` the primary silently drifted — observed 75
> commits behind). Still pass `--primary`/`WE_PRIMARY` explicitly when you want it guaranteed (e.g. the pool
> was provisioned with a non-primary `--reference`). The sync is a pure `git pull --ff-only` and **only
> touches a primary that is on `main` with a clean tree** — a dirty primary (a peer session's uncommitted
> work) is left UNTOUCHED and logged, never autostashed or stranded (the 2026-07-03 incident). Omit the flag
> deliberately if you do NOT want your primary advanced.

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

**Report the pass to the operator via `renderDrainRunSummary()` (#2433), not hand-composed prose.** Feed it the
(sub)shape of the pass's own `--json` result (`{merged, failed, deferred, parked, skipped, dryRun}` — the exact
fields `merge-ai-prs.mjs` already returns, see `## Run it` above) and post its output verbatim as the end-of-run
line(s) — this is the ONE place that wording is templated, so a plain one-shot pass, a `--watch` loop's final
pass, and a batch-closeout drain all report the same way.

## Auto-review the parked PRs (#2285 v1 + v2)

The #2171/#2262 review-escalation gate **parks** a blast-radius PR (`review:pending`) and waits for an
independent reviewer to apply `review:accepted`/`review:changes` — otherwise every escalated PR stalls the
queue until a human gets to it. **v1 makes the drain run that independent review itself, via a subagent** — for
the PRs where an agent reviewer is genuinely independent of the *producer*. **v2 (#2311) replaces v1's
author-bounce with a bounded editor↔reviewer negotiation loop** (below). The one invariant BOTH preserve:
**a landed PR was accepted by an agent that did not author it.**

> **One engine (#2326).** The `{findings, verdict}` contract is single-sourced in `we:scripts/lib/review-core.mjs`
> (#2325): `buildMandate()` renders the judge-only instruction the review subagent is seeded with (it bakes in
> the #2336 diff-only, **no-checkout** clause), `normalizeFindings()` shapes what it returns, and
> `deriveVerdict()` maps findings → `accept`/`changes`/`needs-human`. The drain review below and the
> [`/review`](../review/SKILL.md) human-verdict skill BOTH render through it — no hand-rolled reviewer prose.
> **#2311 (v2)** adds `buildEditorMandate()` (seeds the editor subagent's revision round) and
> `deriveNegotiationOutcome()` (the ONE deterministic `continue`/`land`/`escalate` derivation from a round's
> verdict + the round cap) — same module, same single-sourcing discipline. **#2310 (v3)** adds the
> `MANDATE_LENSES`/`MANDATORY_LENSES`/`ADVISORY_LENSES` panel, `buildPanelMandate()` (seeds one reviewer per
> lens), `derivePanelVerdict()` (reduces the panel's per-lens verdicts to the ONE combined verdict
> `deriveNegotiationOutcome` already consumes — the round loop itself is unchanged) and
> `renderPanelVerdictTable()` (the operator-facing split-verdict surface). **#2433** adds the SESSION/NOTICE
> renderers (distinct from the PR-comment table above): `renderDrainRunSummary()` (the end-of-run pass
> summary) and `renderReviewNotice()` (the in-chat escalation/clearance notice — used by both this skill and
> [`/review`](../review/SKILL.md)) — same module, same discipline: template the render, never hand-type the
> prose.

The lander classifies each parked PR (see `we:scripts/lib/review-escalation.mjs` `isGateSelfPath`) and emits it
in the `--json` output's `parked` array as `{ num, repo, humanRequired, reasons }`.

> **The converge-vs-human branch is ONE derivation (#2285).** Don't hand-branch on `humanRequired` — call
> `deriveReviewDisposition({ reasons })` in `we:scripts/lib/review-core.mjs` and act on `{ mode, autoLand }`. It
> is single-sourced so **every** review surface (this drain, `/review`, `/merge`) shares the policy, keyed on WHY
> the PR escalated. `mode: 'converge'` → run the panel↔editor loop below; `mode: 'human'` → hand straight to a
> human, no convergence. `autoLand: false` → an agent may FIX but never CLEAR it (a human gates the merge). Map
> the drain's signals to reasons: `humanRequired` ⇒ `gate-self`; the escalation `reasons` (blast-radius / size /
> dismissed-findings / cross-repo / sampling) are the sensitivity reasons; a negotiation that hits the round cap
> or a mandate conflict (below) is `non-convergence` / `mandate-conflict`.

> **No park ever times out (x30jq9n, resolving #2412 Gap 1).** The old 30-minute merge-anyway window
> (`--review-window-minutes`, #2262) is REMOVED: it raced the very review it was waiting for — observed
> 2026-07-10, PR #396 merged mid-negotiation at its round-1 head while mandatory-lens fixes were still being
> written. A parked PR now rests parked until a verdict label (`review:accepted`/`review:changes`) arrives. A
> genuinely stuck park is the OPERATOR's call: run a manual `/drain`, or use the documented
> `--no-review-escalation` override to push a green-but-parked `review:pending` PR through (it still refuses
> `review:human`/`review:changes`). **Careful — the override is PASS-WIDE, not per-PR:** it turns the
> escalation rubric off for EVERY candidate in that pass, so a fresh PR with no `review:*` label yet (even a
> gate-self diff) would merge unscored. Only run it when the stuck `review:pending` PR is the ONLY unlabelled
> candidate: scope the pass (`--this-repo`, a narrow `--label`) and confirm with `--dry-run` that the plan is
> that one PR first. A per-PR override is tracked as backlog item #x2u9e9d. Landing unreviewed code on a clock is never the
> drain's failure mode.

- **`gate-self` (`humanRequired: true`) → `{ mode: converge, autoLand: false }`.** The diff edits the **auto-review
  trust chain itself** (`we:scripts/lib/review-escalation.mjs` or `we:scripts/merge-ai-prs.mjs`) — the code that
  decides whether the gate fires and what clears it. This is a **sensitivity** park, not a deadlock, so an agent
  reviewer/editor is still useful: **run the SAME panel↔editor negotiation loop as the agent-reviewable path
  below** to actually fix any clear bug (an advisory FIX, not just an advisory comment). The one difference is
  `autoLand: false` — on a `land` outcome the drain **does NOT apply `review:accepted`**; it keeps `review:human`,
  posts the converged diff's findings + verdict table as a PR comment clearly marked `🤖 advisory AI review /
  fix (non-clearing)` **and flags that the diff now carries agent-authored trust-chain edits the human must
  scrutinize**, and surfaces the PR to the operator, who clears it with [`/review <PR>`](../review/SKILL.md). This
  PR is **never agent-clearable** — an agent policing a change to its own leash is the conflict of interest the
  gate exists for; the panel may improve the diff but only a human merges it (the #2285 invariant, enforced by
  `autoLand: false`).

  > **Single PAT ⇒ you cannot verify a gate-self clearance by actor (#2416).** The whole constellation runs on
  > ONE personal access token, so EVERY `review:accepted` label + `"cleared by the operator"` comment is
  > applied as `chalbert` whether a human ran [`/review`](../review/SKILL.md) or an automation (a
  > closing-session / batch flow) did. The GitHub actor therefore proves nothing — this is exactly the #2416
  > gap ("honor `review:accepted` only when a human applied it"), for which the buildable fix is a
  > closed-set-of-callers guarantee, NOT actor provenance. **Operational rule when draining:** if a `gate-self`
  > PR arrives already carrying `review:accepted`, do NOT treat the label/comment as proof of human clearance —
  > surface it and get the operator to confirm they personally cleared it before letting it land. Do not,
  > however, treat "shows as `chalbert`" as suspicious on its own — it is the only actor there is.
- **sensitivity park (`humanRequired: false`) → `{ mode: converge, autoLand: true }` — agent-reviewable.** Escalated (blast-radius / size / dismissed-findings / sampling)
  but independent of the producer. **v3 (#2310) runs a bounded MULTI-MANDATE PANEL↔editor NEGOTIATION LOOP** —
  v2's single reviewer fans out into a panel of distinct mandated reviewers (`PANEL_LENSES`: `correctness` /
  `security` / `simplicity` / `standards-conformance`, the `/code-review` lenses), driven up to
  `NEGOTIATION_ROUND_CAP` (3) rounds of propose → critique → revise, in-session, before escalating:
  1. **Round 1 panel review.** Get the diff (`gh pr diff <num> --repo <repo>`, `gh pr view <num> --repo <repo>
     --json title,body,files`). Spawn ONE **fresh-context adversarial review subagent per lens** (the `Agent`
     tool, fanned out in parallel via the Workflow orchestrator), each seeded with `buildPanelMandate({ lens
     })` — same diff-only, no-checkout isolation as v2 (#2336), but judging only its own lens and blind to the
     other lenses' reviewers. Shape each reply with `normalizeFindings()`, reduce each to its own verdict with
     `deriveVerdict()` — you now have one `{ lens: verdict }` map (`lensVerdicts`) and, via
     `buildPanelFindings()`, one lens-tagged findings list.
  2. **Reduce the panel to one verdict** — `derivePanelVerdict({ lensVerdicts, humanRequired, conflict,
     mandatoryLenses })`. `MANDATORY_LENSES` (`correctness`, `security` — real invariants with no other gate)
     must **unanimously accept** to land; `ADVISORY_LENSES` (`simplicity`, `standards-conformance` —
     `standards-conformance` already has a deterministic backstop in `check:standards`, #2199; `simplicity` is
     genuine stylistic judgment) are always surfaced but never block on their own. `conflict` is a **judgment
     call, not a mechanical one** (#51): read the mandatory lenses' findings — if they are a genuine
     MUTUALLY-EXCLUSIVE tradeoff (e.g. security's fix directly undoes simplicity's, or vice versa within the
     mandatory pair), pass `conflict: true`; a merely-unlucky pair of independent "changes" verdicts is not a
     conflict, it is ordinary non-convergence and follows the round-cap path below.
  3. **Decide what's next** — `deriveNegotiationOutcome({ verdict, round, roundCap })` on the REDUCED panel
     verdict from step 2 (pure; the round-cap decision is deterministic, not a judgment call):
     - **`land`** (verdict `accept` — every mandatory lens unanimously accepted) → **gate on the disposition's
       `autoLand`.** `autoLand: true` (a plain sensitivity park) → apply `review:accepted` (`gh pr edit <num>
       --repo <repo> --add-label review:accepted`) and **re-run the drain** (a bare pass) — the invariant holds:
       non-author reviewers accepted the FINAL diff. `autoLand: false` (`gate-self`) → **do NOT apply
       `review:accepted`**: the panel converged and fixed the diff, but a human must clear a trust-chain edit.
       Keep `review:human`, post the converged findings + `renderPanelVerdictTable(...)` as the `🤖 advisory AI
       review / fix (non-clearing)` comment, and surface the PR to the operator via
       `renderReviewNotice({ event: 'escalated', pr, repo, verdict, disposition, reasons })` (#2433) rather than
       hand-typing the in-chat notice — the fix rode the PR branch, the clearance did not.
     - **`escalate`** (verdict `needs-human` — a genuine mandate `conflict` or the global `humanRequired`
       conflict-of-interest flag — OR `changes` with `round >= roundCap`) → this is the `deriveReviewDisposition`
       DEADLOCK case (`mandate-conflict` / `non-convergence` → `{ mode: human }`): the loop already ran and could
       not agree, so **hand it to the human — do NOT re-enter convergence.** Apply `review:human` (never
       `review:changes`/author-bounce — that path is retired by v2) and post BOTH the round-by-round findings
       history AND `renderPanelVerdictTable({ lensVerdicts, mandatoryLenses })` (the per-lens
       mandatory/advisory/verdict breakdown) as a PR comment, so the human sees exactly which lens(es)
       disagreed and whether via non-convergence or a genuine mandate conflict. Then report it the same way as
       the gate-self case, via `renderReviewNotice({ event: 'escalated', pr, repo, verdict, disposition,
       reasons })` (#2433). This is the **only** escalation shape agents produce; the operator clears it with
       [`/review <PR>`](../review/SKILL.md).
     - **`continue`** (verdict `changes`, `round < roundCap`) → step 4.
  4. **Editor round.** Spawn a **fresh-context editor subagent** seeded with `buildEditorMandate({ findings,
     round, roundCap })`, where `findings` is `buildPanelFindings(lensFindings)` — the WHOLE panel's
     lens-tagged findings merged into one list (not just one lens) — so the editor sees every mandate's
     concerns in one pass. It does its writing in an **isolated throwaway clone of the PR branch** (never the
     drain's shared checkout — the #2336 constraint applies to the editor too), then **pushes back to the SAME
     PR branch** (the PR updates in place; no new PR opens). It must fix each finding or explicitly dismiss it
     with a stated reason (never drop one silently) — a dismissal of a MANDATORY lens's finding is exactly what
     the next round's reviewer for that lens re-checks.
  5. **Next round.** Re-fetch the now-updated diff and re-spawn the full panel (fresh-context, one subagent per
     lens, same `buildPanelMandate()` seed — no memory of the prior round) → back to step 2 with `round + 1`.

  The pushed revision re-runs the PR's required `test` check — a round's editor commit is a normal PR update,
  not a merge, so a red check simply blocks that round's land/continue decision until it goes green, same as
  any other PR.

> **The label must exist.** `review:human` is provisioned like the other `review:*` labels (see #2262/#2279);
> if it is missing, `gh pr edit --add-label review:human` silently no-ops. Ensure it exists once:
> `gh label create review:human --description "conflict-of-interest: gate-self edit, a human must review" --color B60205 --force`.

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
- **Rebase-drop can livelock on an overlapping batch — `--no-rebase-drop` breaks it.** When several
  `ready-to-merge` PRs in the SAME batch overlap on the same files (e.g. multiple PRs each touching
  `scripts/merge-ai-prs.mjs` / `scripts/readiness/lane-manifest.mjs`), every pass rebase-drops whichever tips
  read as BEHIND/CONFLICTING, which pushes a NEW commit → resets each tip's `test` check to pending → the tip
  is behind/pending again at the next merge attempt → rebuilt again. The check-reset outruns the poll, so no
  tip stays green long enough to land. Observed 2026-07-10: **12 `--watch` passes, 0 merges, `main` never
  advanced**, even though tips individually reached CLEAN+green between passes. **Remedy:** stop the churn and
  run one pass with `--no-rebase-drop` — it skips the commit-fabricating rebuild and merges every PR GitHub
  already reports CLEAN + green directly (GitHub's merge-commit strategy handles a not-behind mergeable PR).
  This landed 3 of 4 overlapping PRs in a single pass. A genuinely BEHIND straggler is then left as a skip;
  land it on a follow-up pass (a normal rebase-drop pass rebuilds the LAST one cleanly, no siblings left to
  race). Relates to #2391 (drain dual-lock / whole-process critical section).
