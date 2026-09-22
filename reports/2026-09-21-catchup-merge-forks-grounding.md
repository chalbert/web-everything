# The five catch-up merge forks: what the code says today — grounding for #3803

Date: 2026-09-21. Session: prepare-3803. Refs read: `origin/main` at `8a7583b8f`; the prototype branch
`origin/lane/mechanical-dispatcher` at `5ab89f87b`; the staging ref `origin/lane/mechanical-dispatcher-catchup`
at `dd9d51bfb`. Every file was read with `git show <ref>:<path>`. No web survey: the decision ratifies code that
already exists on the staging ref, and the only prior art is inside this repo (the #3804 grounding report and
the two POC-branch statutes). The catch-up worker's result file was not available; anything below that comes from
the worker's account (as quoted on the card) and was not re-read is marked *(worker)*.

## 1. State of the refs (re-measured)

| Fact | Command | Value |
| --- | --- | --- |
| Is the staging ref still a fast-forward of the branch? | `git merge-base --is-ancestor origin/lane/mechanical-dispatcher origin/lane/mechanical-dispatcher-catchup` | **No** |
| Commits only on the branch / only on the staging ref | `git rev-list --left-right --count origin/lane/mechanical-dispatcher...origin/lane/mechanical-dispatcher-catchup` | **15 / 427** (the card said 12) |
| Latest `main` commit inside the staging ref | `git merge-base origin/main origin/lane/mechanical-dispatcher-catchup` | `5ab140f50`, 2026-09-20 |
| Commits only on main / only on the staging ref | `git rev-list --left-right --count origin/main...origin/lane/mechanical-dispatcher-catchup` | **141 / 245** |
| Did `main` change any of the five forked files since `5ab140f50`? | `git diff --stat 5ab140f50 origin/main -- <the five files and the slug helper>` | **No.** Only `we:scripts/operations/review-dispatch.mjs` changed, and it is not one of them. All five "main" sides below are still current. |
| Conflicts, branch tip merged into the staging ref | from the #3804 report | 1 (`we:scripts/operations/__tests__/http-adapter.test.mjs`) |
| Conflicts, main merged into the staging ref | from the #3804 report | 4 (`we:scripts/__tests__/guard-bash.test.mjs`, `we:scripts/readiness/__tests__/heavy-admission.test.mjs`, `we:scripts/readiness/file-locks.mjs`, `we:scripts/readiness/heavy-admission.mjs`) |

Consequence for the card's second "Done when": "zero commits only on main after the fast-forward" cannot hold
for a fast-forward of the staging ref, because `main` has moved 141 commits since the ref was cut and merging
them is a fresh 4-file conflict. The sync pass takes those afterwards (#3804 Fork 1 (a), "promptly").

## 2. Fork 1 — `makeCliMechanicalPasses` in `we:skills-src/conveyor/runner.mjs`

| | Prototype / staging ref | `main` |
| --- | --- | --- |
| Function | `we:skills-src/conveyor/runner.mjs:461` | `we:skills-src/conveyor/runner.mjs:267` |
| How a pass runs | `runQuiet` (`:485`) calls `runQuietHeartbeating` (`:720`); the child runs async and the lease is renewed every `MECHANICAL_PASS_HEARTBEAT_MS` = 60 s (`:335`) | `run` (`:276-278`) calls the injected `exec`, which is `execFileSync`; it blocks the event loop; the lease is renewed only between passes, by `runLoop`; the repo fan-out loop is at `:307` |
| Sync passes ahead of everything | `main-ref-sync` (`:501`) and `poc-branch-sync` (`:512`); neither script exists on `main` | none |
| Review dispatch | blocking and heartbeated (`:615`; `we:scripts/operations/review-dispatch-wrapper.mjs`, not on `main`) | one `execFileSync` per PR |
| Repo scope | one `repo` slug for the whole runner | fan-out over `CONSTELLATION_REPOS` with a per-repo `--prs-file=` snapshot and an `unsupported-repo` ledger write |
| Passes only `main` calls | none | `operator-notify --once`, `advisory-label-sweep sweep` |

Both scripts `main` calls exist on the staging ref (`we:scripts/operations/operator-notify.mjs`,
`we:scripts/conveyor/advisory-label-sweep.mjs`, `we:scripts/conveyor/unsupported-repo.mjs`,
`we:scripts/lib/constellation-repos.mjs`), but **nothing on the staging ref's runner calls `operator-notify` or
`advisory-label-sweep`** (grep over `skills-src` and `scripts`, tests excluded). So the staging ref's runner does not
send the operator the desktop push when a `review:human` PR is ready, and does not run the advisory-label sweep.
The prototype's runner never had them (they were added to `main` after the merge base); the fast-forward does not
remove a running behaviour, it just does not gain these.

The skipped tests: `we:skills-src/conveyor/__tests__/runner-repos.test.mjs:47` is a `describe.skip`; its header
(`:1-20`) says how to re-enable.

## 3. Fork 2 — a pull request with no item number, in `we:scripts/conveyor/reconcile-fix-dispatch.mjs`

Both sides cite the same PR (#2210, head ref `lane/file-2206-review-findings`) and the same fact: `2206` is the
reviewed PR's number, not the item this PR delivers, and backlog #2206 is an unrelated card.

- `main` (`:108-111`, the refusal at `:148`): stamping `WE #2206:` would be "worse than the refusal it replaces", so
  a PR with no item number is refused `no-item-num`. There is "no honest `WE #<n>:` commit prefix".
- Prototype / staging ref (`:116-121`, the plan at `:142-172`): never derive the number; keep `itemNum: null`, scope
  from the PR's own changed files, attribute `PR #<n>`. `no-scope` still refuses when the fallback is empty (`:161`).

The card's Fork 2 text says main's evidence calls the refusal "a bug to route around". That is not what main's
docblock says: main calls the refusal correct *because it had no honest prefix*, and both sides agree never to
derive the number. The disagreement is only whether `PR #<n>:` is an honest prefix. The card's option (c) ("refuse
only when no scope can be derived") is what the staging ref already does (`:161`), not a third behaviour.

What the branch's answer depends on (all on the staging ref, none on `main`):
`we:skills-src/conveyor/fix-agent-brief.md:44-45` (the `{{ATTRIBUTION_KIND}}` and `{{ATTRIBUTION_NUM}}` tokens) and
`:203` (the commit-prefix line); `we:scripts/operations/dispatch-lane.mjs:117,156` (both tokens are required for
kind `fix`); `we:scripts/conveyor/reconcile-fix-dispatch.mjs:527-528`. The item-keyed path
`we:scripts/operations/dispatch-lane.mjs:1039` hard-codes `ATTRIBUTION_KIND: 'WE'`, which is correct because that path
always has an item. The #3383 tracker note "fix dispatch covers PRs with no item number" (2026-09-20) says
`completion-cli` treats a blank `--item=` as none and that `land-advance`'s `dispatch-fix` row stops deferring
`no-item-num` with no code change *(tracker note, not re-read)*. No commit-subject guard for a `WE #` prefix was found
under `scripts/`.

## 4. Fork 3 — untagged session names in the reaper

- Slug grammar: `we`'s `slugTag` is the empty string (`we:scripts/lib/constellation-repos.mjs:19`), so a WE session
  is minted `review-77` with no tag, exactly like a legacy `review-148` minted before tags existed.
  `we:scripts/conveyor/session-slug.mjs:29` (identical on both refs) parses an untagged name as `repo: 'we'` through
  `repoKeyForSlugTag('')`.
- `main`: `sessionTarget` (`we:scripts/conveyor/session-reaper.mjs:163`) returns `parsed.repo`, so `we` for every
  untagged name, and the resolver caches per PR number (`:285-317`).
- Staging ref: `we:scripts/conveyor/session-reap-plan.mjs:182-198` returns no `repo` for an untagged name ("that
  absence is meaningful, not a default"); `we:scripts/conveyor/session-reap-evidence.mjs:180` resolves it from the
  session's own ledger entry, else checks every constellation repo (`:165-178`; only an OPEN PR blocks, closed-unmerged
  is terminal per the operator's 2026-09-20 rule); the cache key carries the repo (`:181`); `gh pr view` calls are
  capped at 25 per tick (`:48`).
- Direction of harm: the cross-repo check can only **under-reap** (a `we` session lingers while a same-number PR is
  open in another repo). A wrong guess **over-reaps** (a live `plateau-app#148` session stopped as if `we#148` were
  merged). The card's example, `review-148`, is real *(card)*.
- Main's rewritten test cases were re-read on `main` (`we:scripts/conveyor/__tests__/session-reaper.test.mjs:371-410`):
  they pin the guessed outcome, so under the branch's resolver the same listings give the opposite result (section 8).

## 5. Fork 4 — `--session-id` in the spawn argv, in `we:scripts/operations/dispatch-lane-io.mjs`

- Staging ref: the argv is `['--bg', '-n', slug, …]` with no `--session-id` (`:1534-1546`; the header comment says
  why); `void sessionId` keeps the parameter. A spawn that exits 0 with no parseable banner throws (`:1433`, doc `:1404`).
- `main` (`:1054` onward): also no flag; its doc block records the CLI's stderr warning
  (`--bg manages the session id; ignoring --session-id`). The branch tip (`:1465`) still passes the flag.
- Both sides' own #3331 probe found the same thing (three runs, three mismatches). The only observable difference of
  sending the flag is that stderr warning on every spawn.

## 6. Fork 5 — `dispatchFix` refuses a foreign repo before the record is read

- `we:scripts/conveyor/reconcile-fix-dispatch.mjs:521`: `if (repo !== 'we') throw new Error('unsupported-repo: …')`
  (a second copy at `:382`), and `we:scripts/operations/land-advance-io.mjs:121`.
- `we:scripts/operations/__tests__/action-dispatch-paths.test.mjs` exists only on the prototype and the staging ref
  (not on `main`); its case at `:41-52` now asserts the refusal. `we:scripts/lib/we-only-checks.json:28,32` records
  that a PR-keyed repair is WE-only by construction.
- The card said the record's repo-independence "is not exercisable" any more. It is, in the other direction: review
  dispatch accepts a foreign repo (`we:scripts/operations/review-dispatch.mjs:396-413` refuses only when the checkout
  is missing, and `checkoutExists` is injectable), and it writes its record as `actionResource(planned.repo, …)`
  (`:499`), the same keyed shape `dispatchFix` uses (`we:scripts/conveyor/reconcile-fix-dispatch.mjs:428,557`). A
  foreign review followed by a `we` fix on the same PR number is therefore a reachable independence case.
- **A defect the merge introduced.** The guards at `we:scripts/conveyor/reconcile-fix-dispatch.mjs:382` and `:521`
  compare `repo !== 'we'` (a repo key), but `we:scripts/operations/land-advance-io.mjs:210` (branch-only) calls
  `dispatchFix(..., { repo: row.slug })` with the slug `chalbert/web-everything`, so a WE fix dispatched through
  land-advance throws `unsupported-repo`. A fresh-context reviewer ran it against the staged code and confirmed the
  throw. `repoKeyForSlug` (`we:scripts/lib/constellation-repos.mjs:67-75`) accepts either form. Latent today: the
  drain does not call land-advance's fix path yet (#3383 tracker).
- No card owns "enable foreign-repo fix dispatch"; the coverage debt has no home yet.

## 7. Statute the five rulings sit under

- `we:docs/agent/platform-decisions.md#poc-branch-declared-delivery-mode`, clause 2 (landing inside a POC branch skips
  the review gate; the tests are the only gate) and clause 3 (the full review runs once, at graduation).
- `#poc-branch-mechanical-sync` (#3804): the reconcile agent resolves on the staging ref; the sync pass promotes it once
  the tests are green; the person's fast-forward was ruled **for the first catch-up only**; the five judgment calls of
  the first catch-up stay on #3803 (its "Not in this decision"). Point 2 also says a resolution that changes a test's
  assertions comes back as a decision card, which is why this card exists (see section 8, last row).

## 8. Corrections found by the prep skeptic and the fresh-context screen

| Card said | The code says |
| --- | --- |
| `runQuiet` "takes a repo per call" | `runQuiet` (`we:skills-src/conveyor/runner.mjs:485`) closes over one `repo` and takes only a `forwardRepo` flag; `runQuietHeartbeating` (`:720`) takes `repo` per call |
| `main` "caches one answer per PR number" | `main` keys the cache `pr:<repo>:<n>`; the shared answer comes from every untagged name being guessed as `we` |
| "26 exported names against 13" | the branch's facade re-exports 19 names (the monolith's set); 26 counts the three split modules' own exports |
| Fork 3's lost cases "assert reap/keep outcomes" that can be restored | `main`'s cases (`we:scripts/conveyor/__tests__/session-reaper.test.mjs:371-384`, cap case `:399-410`, on `main`) list an untagged `review-49` beside `review-fui-49` and assert `review-49` is **reaped** (guessed `we`, merged there). The staged resolver leaves it repo-less and **keeps** it while PR 49 is open in `frontierui`; over a cap of one lookup it keeps both. Same input, opposite outcome |
| Fork 5: dropping the repo from the key "fails no test" | the key shape is pinned (`we:scripts/operations/__tests__/action-records.test.mjs:17-20`); the call sites (`we:scripts/operations/review-dispatch.mjs:499,614`) are not |
| "an item number is never derived from branch digits" | true of the fix planner only; `itemNumsFromPr` (`we:scripts/lib/open-pr-items.mjs:45-46`) reads `lane/file-2206-…` as item 2206. The delivered-item title match is anchored (`:243`) and cannot match `PR #2210:` |
| Fork 4: four comments adapted | five: `we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs:231` still says the flag is emitted |
| "the `--session-id` probe ran three times" | the statute records 5 of 5 across CLI 2.1.246 and 2.1.269 (`we:docs/agent/platform-decisions.md`, `#conveyor-dispatch-calls-the-declared-operation`, around `:3466-3470`) |
| `#poc-branch-mechanical-sync` "left the five calls here" | point 2 of the statute says a resolution that changes a test's assertions comes back as a decision card; "first catch-up only" and "the five calls stay on #3803" are from the #3804 card's own Ruling and "Not in this decision" sections |

Also measured, later the same evening: `main` at `b69c470aa`, 155 commits past `5ab140f50`; merging it into the
staging ref conflicts in 7 files (`we:backlog/3474-review-dispatch-s-staleness-guard-should-auto-sync-a-clean-f.md`,
`we:scripts/__tests__/guard-bash.test.mjs`, `we:scripts/operations/__tests__/review-dispatch.test.mjs`,
`we:scripts/readiness/__tests__/heavy-admission.test.mjs`, `we:scripts/readiness/dispatch-plan.mjs`,
`we:scripts/readiness/file-locks.mjs`, `we:scripts/readiness/heavy-admission.mjs`).

## 9. Ruled out, with evidence

- A `PR #<n>:` fix-commit subject being read as an item number: `we:scripts/lib/open-pr-items.mjs:243` anchors the
  title match to `^\s*(?:WE\s+)?#?(\d{2,5})\s*:`; `we:.githooks/` has `post-merge`, `pre-commit`, `pre-push` and no
  `commit-msg`; the fix brief forbids `pr-land`, the only place a commit subject becomes a PR title. Backlog #2210 is a
  real, unrelated card (`we:backlog/2210-dev-browser-panel-wire-live-page-we-conformance-detection-in.md`), so a
  misparse would be a real misattribution; a pinned test for the anchored match is in the card's follow-up list.
- `main`'s `execFileSync` lapsing the singleton lease on its own: it does not; `main`'s own review dispatch forks and
  returns. The lapse needs the branch's blocking review dispatch (`we:scripts/operations/review-dispatch-wrapper.mjs`,
  not on `main`) or verify-dispatch under `main`'s synchronous pass runner.
