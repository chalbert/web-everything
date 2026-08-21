---
name: pr
description: Open a self-approved pull request for the current committed work and land it on `main` via the standard PR transport — the SAME self-approval the parallel `/workflow` integrator uses (`scripts/pr-land.mjs`, #2138 Fork 5 / #2153). Use when the user asks to "create/open a PR", "raise a PR", "land this via PR", "ship it", or "land it the standard way". NOT for reviewing an existing PR (that is `/review`).
---

# Open a self-approved PR (standard land flow)

The whole mechanism lives in **[scripts/pr-land.mjs](../../../scripts/pr-land.mjs)** — this skill
is the trigger + the ceremony around one invocation, so there is nothing to keep in sync here. The
flow is identical to what the `/workflow` integrator uses: a **self-approved** PR (`gh pr create`,
**0 required reviewers** + the required `test` check, #2151/#2152). **#2290 — pr-land no longer merges:
the drain is the SOLE writer to `main`.** `/pr` opens the PR, waits for green, labels it `ready-to-merge`,
and **triggers a single-couple fast drain** (`merge-ai-prs.mjs --only=<pr>`) that lands it — so `/pr` still
feels instant while a single serialized writer owns every merge (the prerequisite for JIT NNN numbering).
GitHub's native merge queue stays OFF.

## One producer, every repo — never hand-roll `gh pr create`

`pr-land` is the canonical producer for **all three constellation repos** (web-everything, frontierui,
plateau-app), not just WE. It is repo-agnostic: it resolves the target GitHub repo from the clone's `origin`
slug, so you run it **from that repo's lane clone** (`--repo=<lane-path>` or just `cwd`) and it opens the PR
against the right repo. Because it always scores the SAME deterministic rubric
(`scoreEscalation` → `producerReviewLabel`, #2307) it applies the correct **`review:human` / `review:pending`
label at PR-open** — identically in every repo.

**Do NOT open agent PRs with a hand-rolled `gh pr create` + a manual `gh pr edit --add-label ready-to-merge`.**
That path SKIPS the #2307 producer review-labeling, so a PR that the rubric would gate goes out unlabelled and
you rely entirely on the drain's re-score backstop — and, as importantly, you will mis-expect the review
outcome (a plain PR the rubric passes lands in ~60s; you cannot "hold it for review" after the fact by
starting a review — it must carry `review:pending` from open). Route every constellation-repo PR through
`pr-land`. The plateau-app resident drain and the WE drain both re-score on sweep, so the rubric is uniform
across repos either way; producer-time labeling via `pr-land` is how you get it applied at open, not on the
first sweep.

## Preconditions

- The work is **committed** (on the checked-out branch — commit-on-current-branch, #104). `pr-land`
  publishes a *commit*, never a local branch. If there are uncommitted changes the user wants to land,
  commit them first (tight pathspec — your changeset only, per the shared-index-race rule).
- `gh` is authenticated (`gh auth status`) and the change is small/coherent enough for one PR. Split
  unrelated concerns into separate PRs.
- Per lane isolation (#2123) the edit should already have happened in a lane clone; the commit you are
  landing is that lane's HEAD (or a commit already ff'd onto the primary's `main`).

## Never open a PR any other way (#xlqwz62)

Everything below runs through `we:scripts/pr-land.mjs`, and there is a declared operation over it:

```
node scripts/operations/run.mjs open-pr --ref=lane/<slug> --title="<title>" --bodyFile=<path> --json
```

**Reaching for the GitHub API directly — a connector, a hand-rolled `gh pr create`, anything — skips
every guard on this page in one step.** The lane-ref carve-out (#1934), the bodyless-PR refusal (#2332),
the park label (#2622) and the #2833 lane-verification finish-guard all live in the home, and none of
them fires for a PR opened around it. This is not hypothetical: three PRs in one session were opened via
the connector because on a credential-less host `gh` fails and the connector plainly works, and one of
the three shipped with a red suite.

**On a host with no `gh` credential the operation FAILS rather than falling back**, reporting `unrun` —
never `opened`, and never a quiet reroute. What it always gives you is the `plan`: the exact argv it
decided on. Submit *that*, unedited, through whatever channel does hold a credential. The decision was
still made by the operation; only the execution moved.

> **The fallback DROPS THE PARK LABEL — you must re-apply it by hand.** This instruction used to stop at
> "submit the argv", and that is not sufficient: the argv carries `--park=review:pending`, but a
> connector's create-PR call has **no label parameter**, so a submission that follows this page perfectly
> still opens the PR **unheld**. Observed 2026-08-21 — three PRs opened this way came out labelled
> `["checking"]` with no `review:*` at all, which the #2820 merge predicate reads as nothing to wait for.
>
> So the fallback is **two** calls, not one, and the second is not optional:
> 1. create the PR from the plan's `--ref` / `--title` / body file;
> 2. immediately apply the plan's `--park=<label>` value as a label on that PR, and **re-read the PR to
>    confirm it stuck** before moving on.
>
> Until step 2 lands, the PR is a candidate for the drain on its next green sweep. Do not batch step 2 to
> the end of a run of PRs — apply it per-PR, as each one is created.

It parks by default (`review:pending` — an independent review is owed), because an agent PR marching to
`ready-to-merge` unreviewed is what park exists to stop. `--mode=` chooses otherwise, deliberately.

## Steps

1. **Pick a `lane/*` ref name** — the #1934 guard carve-out only allows pushing to `lane/*` (never a
   local branch, never `main` directly). Use a descriptive slug: `lane/<short-slug>` for an ad-hoc
   change, or `lane/<NNN>-<slug>` when it closes a backlog item.
2. **Dry-run first** to show the user the exact `gh` sequence, execute nothing. **Pass the SAME `--mode` you
   will pass in step 4** — a rehearsal that previews a different mode is worse than no rehearsal, because it
   shows the user a plan that is not the one about to run. The operation defaults to `park`, which is NOT the
   raw home's default, so the mode has to be explicit on both:
   ```
   node scripts/operations/run.mjs open-pr --ref=lane/<slug> --sha=HEAD --base=main --mode=land --dryRun=true --json
   ```
3. **Write a PR body to a file and ALWAYS pass `--body-file`** — this is required, not optional:
   `pr-land` derives the title from the commit subject, and `gh pr create --title …` with **no** body
   drops into an interactive body prompt that **fails headless** (there is no `--fill` fallback for a
   remote-only `lane/*` head). So a bodyless run errors on create. Compose the body (the change summary,
   plus any `/review` findings/dismissals audit trail) to a file first.
4. **Open + hand off** (self-approved, wait for the `test` check, label green, trigger the drain — #2290
   pr-land NEVER merges):
   ```
   node scripts/operations/run.mjs open-pr --ref=lane/<slug> --sha=HEAD --base=main --bodyFile=<path> --mode=land --json
   ```
   - **`--mode=land`** (the home's default path, named explicitly by the operation): open → wait for
     required checks → label `ready-to-merge` when green → **trigger a single-couple fast drain**
     (`merge-ai-prs.mjs --only=<pr> --this-repo`) that lands it. The trigger is
     best-effort: if review parks the PR (or the drain hiccups), `/pr` still exits success with the PR
     labelled and the standalone drain lands it later. **No `gh pr merge` runs from pr-land.**
   - `--mode=label-on-green` is the **batch producer** mode (#2199): open the PR, **wait for the required
     checks, apply `ready-to-merge` only once they are green**, then STOP — does NOT trigger a drain (a
     `/workflow` or `/batch` closeout runs the standalone drain over the whole set).
   - `--no-wait` opens the self-approved PR **UNLABELLED** and returns immediately (CI unconfirmed). **This is
     NOT a hold** — do not reach for it to keep a PR back for a human. `shouldLabelOnGreen` (#2216) labels any
     producer-owned AI PR `ready-to-merge` once its required check reads green, and the resident drain daemon
     runs that reconcile every ~60s, so `--no-wait` only changes *who* labels it — a couple of poll periods,
     not a hold. Use it only when you want the PR raised now and are content for the daemon to land it on
     green. Measured proof: [[pr-land-dogfood-mechanics]].
   - `--park=<review:human|review:pending>` (#2622) is **the hold** — it applies the review label **at open**,
     before any check-wait, and the #2820 merge predicate (`classifyPr` → `hasUnclearedReviewLabel`) skips a PR
     carrying an uncleared `review:*` label regardless of `ready-to-merge`. It runs the same numbering /
     land-prep as the normal path, so a parked PR's hash-keyed backlog items are not stranded. Park takes
     precedence over `--label-on-green` / `--no-wait`; it exits **0** with `reason:"parked"` (the PR is open and
     HELD, *not* merged), and an off-list value fails fast (exit 3, `reason:"bad-park"`) before any push. Reach
     for this whenever a diff must not land on its author's own say-so — including any diff **you** authored and
     therefore may not clear yourself (#2439). **The two values are not interchangeable:**
     - `review:pending` — the routine park, and the one an independent review can actually clear
       (`decideSetLabel({ to: 'accepted' })` allows it, and the operator's `--no-review-escalation=<pr>` relief
       valve, #2423, can also pass it through). It does **not** enforce *who* clears it: no code compares the
       clearer's identity to the author's (`--actor` is free text that only reaches the comment body), so
       non-author independence is a NORM you honour, not a predicate that runs. The reviewer-id check is
       build-pending on the OPEN #2785 (`docs/agent/platform-decisions.md`,
       `#fix-review-convergence-independent-root-cause`, says so in as many words).
     - `review:human` — the gate-self tier. `decideSetLabel` refuses `→ review:accepted` whenever `review:human`
       is present, unconditionally (INVARIANT 2); the ONE thing that clears it is the separate `--to=clear-human`
       target (#2895), which requires `--actor` and a `--reason` quoting the operator's instruction. A
       `check:standards` rule — `checkReviewLabelSingleHome` in
       [`we:scripts/lib/review-skill-guard.mjs`](../../../scripts/lib/review-skill-guard.mjs), #2882 — also stops
       the docs in its scope (`skills-src/review/`, `docs/agent/`) from prescribing the raw-`gh` workaround.
       **Nothing verifies that a human ran `clear-human`** — #2895 ruled that signal deferred — so what holds the
       tier is the rule in `skills-src/review/SKILL.md`: you may run it only on an explicit in-conversation
       operator instruction naming that PR. Park `review:human` whenever the diff is genuinely gate-self; do not
       downgrade it to `review:pending` to make the clearance easier.
     The `--label=<name>` trap and the measured `--no-wait` cost: [[pr-land-dogfood-mechanics]].
   - **The `ready-to-merge` label is applied ONLY after the required checks are green (#2196/#2199)** — never
     eagerly at open, so a red PR never enters the drain's queue. In the default land path (above) and the
     `--label-on-green` path `pr-land` applies it once CI passes. Pass `--no-label` to opt out; `--label=<name>`
     overrides the name.
   - `--fallback-git` degrades to a local `git merge --no-ff` + push. **#2290 — this is a write to `main`,
     so it is routed through the shared merge gate (`scripts/lib/pr-merge-gate.mjs`, caller `pr-land`) and is
     BLOCKED unless the documented `WE_MERGE_BREAK_GLASS=1` emergency admin override is set (which logs a loud
     audit line).** Normal landing goes through the drain, never `--fallback-git`.
   - **If `pr-land` fails on create, do NOT hand-roll the PR.** There is no safe manual equivalent: a
     `gh pr create` + a hand-applied `ready-to-merge` + a `merge-ai-prs.mjs --only=<n>` run lands the change
     with **no review scoring at all**. It skips the #2307 producer rubric (`scoreEscalation` →
     `producerReviewLabel`), and a drain invoked without `--label` has `REVIEW_ESCALATION` false
     (`we:scripts/merge-ai-prs.mjs`), so the drain's rubric never runs either — while the #2366 concurrent-lander
     backstop only refuses a PR that **already** carries an uncleared `review:*` label. Nothing catches it, so a
     statute or trust-chain diff can land unreviewed. Use the real recovery instead: exit 4
     (`blocked-on-infra`) is already recorded and auto-retried by the conveyor, and exit 3 `gh-error` is
     re-runnable once `gh` works — a re-run re-uses an already-open PR for the same head (`gh pr list --head`)
     rather than creating a duplicate, so it resumes rather than restarts. If a PR must
     exist right now, open it with `pr-land … --park=review:pending` so it is HELD — never with a hand-applied
     `ready-to-merge`. And never `gh pr merge` yourself: the gate rejects any non-drain merge.
5. **Sync the local checkout** — the drain (which lands the PR) ff-syncs the lane clone's local `main` to the
   advanced `origin/main`; pr-land best-effort ff-syncs the user's PRIMARY checkout too (`git pull --ff-only
   --autostash`, #2205). If you landed from a lane clone, also reset that lane back to `origin/main` so the
   pool stays reusable.

## Exit codes (surface these, never merge a red PR)

**Always report the `reason` field, never the exit code alone** — the codes below are derived from the
`emit(<result>, <code>)` sites in `we:scripts/pr-land.mjs`, and `merged: true` appears on exactly ONE of them.
Since #2290 `pr-land` never merges: the drain is the sole writer to `main`, so even a fully successful default
run comes back `merged: false`.

- **`0` — the run did what it was asked.** Six reasons, only the last a merge:
  - `enqueued` — the **DEFAULT**, no flags: checks green → `ready-to-merge` applied → a single-couple fast
    drain triggered. `merged: false`; the drain lands it moments later. Report it as *enqueued*, not merged.
  - `labelled-on-green` — `--label-on-green`: green + labelled, no drain triggered.
  - `parked` — `--park`: the PR is open and **HELD** for review. Nothing landed. **Confirm the label actually
    landed:** a failed label apply still reports `parked` with exit 0 today — `reviewLabelApplied: false` in
    the JSON is the only tell, and the `gh` warning is suppressed under `--json`. Read
    `gh pr view <pr> --json labels`.
  - `opened` — `--no-wait`: the PR is open, UNLABELLED, CI unconfirmed.
  - `dry-run` — nothing pushed, nothing created.
  - `merged-git-fallback` — the only `merged: true`, and only via `--fallback-git`, which is break-glass-only
    (see *Guardrails*).
- **`2` — `check-red`:** the required check was RED. Nothing merged, `main` untouched. Report the failing
  check; fix and re-run.
- **`3` — a producer-side stop; `main` untouched.** The recovery is **reason-specific — there is no general
  remedy**, and in particular `--fallback-git` is not one: only the `gh-error` path reads that flag at all (see
  its bullet), and every other reason here exits regardless of it.
  - `conflict` — the lane ref conflicts with `main`. Re-parent the changeset onto the latest `origin/main`,
    resolve, re-run.
  - `empty-body` — the PR description is empty/whitespace (checked before create, and again before the
    label). Write a real summary and re-run with `--body-file`, or fill the open PR's body.
  - `bad-park` — the `--park` value is off-list; correct it to `review:human` / `review:pending`. Fails fast,
    before any push.
  - `locus-prefix` — a bare code-path ref in this lane's corpus changes (#883/#2331). Prefix them
    (`foo.ts` → `we:foo.ts`), `git commit --amend`, re-run. Raised **before** the push, so there is no PR yet.
  - `unverified` / `verify-red` / `verify-unfinished` / `verify-corrupt` — the #2833 stall guard, also before
    the push. Run the OPERATION — `node scripts/operations/run.mjs verify --checkout=<lane> --json`
    (foreground, blocking) on **this** head, then re-run. It declares over `we:scripts/verify-lane.mjs` and
    records the same #2833 HEAD-keyed marker `pr-land` gates on, so the two never disagree; what it adds is
    the three-valued read — `verdict.ok` is true only when EVERY check passed, and a check that could not run
    is `unrun`, never a quiet pass. `--mode=check` reads the marker without running the suites, which is what
    to poll with rather than a `pgrep` loop.
  - `no-ref` / `bad-ref` / `no-such-src` — fix the invocation (`--ref=lane/<name>`, `--sha=<commit>`).
  - `push-failed` / `check-timeout` — transport or CI-wait; re-run. A `check-timeout` leaves the PR open and
    unlabelled, which is **not** a hold — the drain's reconcile labels it from CI truth on its next sweep.
  - `gh-error` — `gh` itself failed (a non-infra `gh pr create` failure, or the PR number could not be read
    after create). **This is the one reason that consults `--fallback-git`**: without the flag `pr-land` stops
    here; with it, it attempts a local `git merge --no-ff` + push to `main`, which the shared merge gate BLOCKS
    unless `WE_MERGE_BREAK_GLASS=1` is armed — so passing it normally just converts this stop into
    `fallback-failed`. Don't. Re-run once `gh` works.
  - `fallback-failed` — the `--fallback-git` attempt above failed (usually the merge gate refusing it).
    `main` is untouched; go back to the normal path.
  - `behind` — **listed by `pr-land`, but not producible from this CLI.** `pollVerdict` returns `behind` only
    when `labelWhenGreen` is false, and the two modes that wait for checks (default land, `--label-on-green`)
    both set it true — so the poll loop never takes that branch. A stale (BEHIND) ref actually resolves as:
    green → labelled `ready-to-merge` and handed to the drain, which rebases before merging (#2284);
    not-yet-green → keeps polling → `check-timeout`. So do **not** rebase-and-re-run on account of behind-ness
    alone; that is the drain's job.
- **`4` — `blocked-on-infra` (#2659):** the lane ref **is pushed**; only `gh pr create` failed, on a known
  outside dependency. This is resumable, **not** a hard failure: `pr-land` recorded the resume handle
  (`ref`/`sha`/`base`/body) in the conveyor infra-blocked store, which auto-retries with backoff and
  resume-opens the PR. Do **not** re-push the lane, loop `pr-land` by hand, or `--fallback-git`. Report
  `blocked-on-infra (<cause>)` and stop.

## Guardrails

- **Self-approved, never request a human reviewer** — 0 approvals + the `test` gate is the contract.
- **Never push `main` directly** and never force-push over a shared ref — the only pushes are to the
  `lane/*` ref (create + delete).
- One PR = one coherent changeset. Do not fold unrelated work (e.g. tooling + a feature) into one PR.
