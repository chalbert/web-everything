---
bornAs: xdqy6xk
kind: decision
parent: "3383"
status: open
relatedTo: ["3772", "3443", "3804", "3802", "3805", "3797"]
scope: ["we:skills-src/conveyor/runner.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/conveyor/session-reaper.mjs", "we:scripts/operations/dispatch-lane-io.mjs"]
dateOpened: "2026-09-21"
relatedReport: reports/2026-09-21-catchup-merge-forks-grounding.md
tags: []
---

# Decision: accept each of the five catch-up merge forks before the prototype branch is fast-forwarded

Rule whether to accept, in five places, the behaviour the merge of `main` into the prototype branch `lane/mechanical-dispatcher` kept. The merge (54 conflicted files, no rebase, no force) is staged on `origin/lane/mechanical-dispatcher-catchup`, sha dd9d51bfb, and was NOT pushed to the shared branch. It kept the BRANCH's behaviour in four places (fork 4 took `main`'s argv) and named `main`'s half. **After this ruling the operator brings the staging ref up to the shared branch and fast-forwards it** (steps under "At ratification"). One card, not five: the forks share one ref and one fast-forward. Relates #3772, #3443 and the reaper graduation card #3802.

**Prepared 2026-09-21.** No design is invented here: every fork ratifies a resolution that already exists on the staging ref, so the grounding is a read of the three refs (`main`, the branch, the staging ref), published as [the grounding report](/reports/2026-09-21-catchup-merge-forks-grounding.md), not a web survey; no `/research/` topic. All `:line` cites are to the staging ref unless marked `main`. **The recommendation is to accept all five as staged**, with named follow-up work. Three claims in the card as first written were wrong and are corrected below: fork 2's account of `main`'s evidence, fork 3's "coverage is gone" (part of it is pinned, and the rest pins the opposite outcome), and fork 5's "cannot be exercised today". Prep also found one defect the merge introduced (fork 5: the foreign-repo guard refuses WE's own PRs when land-advance calls it with a slug), fixed in the follow-up commit.

## FOUND (re-verified 2026-09-21, evening)

- **The staging ref can no longer be fast-forwarded.** `git merge-base --is-ancestor origin/lane/mechanical-dispatcher origin/lane/mechanical-dispatcher-catchup` fails: **15** commits are only on the branch (the card first said 12), 427 only on the ref. The first step is to merge the new branch tip into the staging ref (one conflicting file, `we:scripts/operations/__tests__/http-adapter.test.mjs`), run the branch's tests there, then push. Never `--force`, never a push of the staging ref to `main`.
- **`main` keeps moving, and that does not change the five forks.** The newest `main` commit inside the staging ref is `5ab140f50` (2026-09-20); `main` was 155 commits past it at `b69c470aa` this evening, and merging them into the staging ref is a fresh 7-file conflict (`we:backlog/3474-review-dispatch-s-staleness-guard-should-auto-sync-a-clean-f.md`, `we:scripts/__tests__/guard-bash.test.mjs`, `we:scripts/operations/__tests__/review-dispatch.test.mjs`, `we:scripts/readiness/__tests__/heavy-admission.test.mjs`, `we:scripts/readiness/dispatch-plan.mjs`, `we:scripts/readiness/file-locks.mjs`, `we:scripts/readiness/heavy-admission.mjs`). These numbers drift by the hour. None of the five forked files changed on `main` since `5ab140f50`, so each "main" side below is still current. That merge is not part of this ruling: the sync pass takes it after the fast-forward (#3804, ratified: merge promptly).
- **Checks on the staging ref (the worker's numbers, not re-run here):** `npm run check:standards` 0 errors; scripts, conveyor and skills-src suites green with 15 skipped (3 of them fork 1's). Not run: branch-coverage (`check:standards` needs a clean tree for it) and nothing ran live.
- **Nothing is renumbered.** No card was renamed; the one id fix is a prose reference in #3331 (main says #3605, the tree now says #3606).

## Statute check — why this card exists, and what it does not do

`we:docs/agent/platform-decisions.md#poc-branch-mechanical-sync` point 2 says a resolution the reconcile agent cannot make on merit, **including one that changes a test's assertions, comes back as a decision card**; every fork here skipped, rewrote or dropped assertions, so this card is that decision card, and its own title makes the fast-forward of THIS staging ref wait on it. That a person fast-forwards at all was the operator's ruling for this first catch-up only (#3772, its correction note); for later conflicts #3804 ruled that no person does (its Ruling, Fork 2 (a)) and the sync pass promotes a green staging ref itself. `#poc-branch-declared-delivery-mode` clause 2 (landing inside a POC branch skips the review gate) is not in conflict: the wait comes from the changed assertions, not from a review of the landing, and clause 3 (the full review runs once, at graduation) is where the follow-up work is finally checked. One more anchor governs a single fork: `#conveyor-dispatch-calls-the-declared-operation` (fork 4). If the operator overrides a default, the change is one follow-up commit on the staging ref before the push. The ruling sets no `codifiedIn`: it accepts merge resolutions, and the rules they rely on are already in these anchors.

## Axes

The five forks are five independent places where the two sides disagreed: the runner's pass list (`we:skills-src/conveyor/runner.mjs:461`, `main` `:267`), the fix planner's handling of a PR with no item number (`we:scripts/conveyor/reconcile-fix-dispatch.mjs:116-172`, `main` `:108-148`), the reaper's handling of an untagged session name (`we:scripts/conveyor/session-reap-plan.mjs:182-198`, `main`'s `we:scripts/conveyor/session-reaper.mjs:163`), the spawn banner handling (`we:scripts/operations/dispatch-lane-io.mjs:1404-1433`, argv `:1534-1546`), and one test that lost the coverage it existed for (`we:scripts/operations/__tests__/action-dispatch-paths.test.mjs:41-52`). They share a ref and a fast-forward but no code: any subset can be ruled either way without touching the others. Classification, in the fixed order: layer = repo-operations tooling in `we:scripts/` and `we:skills-src/conveyor/`, not a block, intent, protocol or plug definition, so the WE-holds-no-implementation rule (#1282) is not in play; no intent dimension; no config-dimension question (each fork picks a behaviour for one input, not a knob with two legitimate values). Forks 1, 3, 4 and 5 are forced invariants, a ratify each; fork 2 is the one real either/or.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| Fork 1 — runner pass list | (a) Keep the branch's heartbeated list as the base; the end state is one list scoped per repo | (b) Take `main`'s function | High — a ratify: (b) and (c) are broken |
| Fork 2 — PR with no item number | (a) Dispatch it, attributed `PR #<n>` | (b) Refuse it, as `main` does | Med-high — the one real judgment: is `PR #<n>:` an honest prefix |
| Fork 3 — untagged session name | (a) No guess; keep the cross-repo check | (b) Guess `we`, as `main` does | High — a ratify: the guess is wrong for legacy names |
| Fork 4 — unparseable spawn banner | (a) Throw (the branch's behaviour) | (b) Fall back to the minted id (`main`'s) | High — a ratify: (b) is the #3331 defect |
| Fork 5 — the foreign-fix refusal and the changed case | (a) Accept the refusal (comparing repo keys, so WE's own slug is not refused) and pin the independence in the direction still reachable | (b) Revert `main`'s foreign-repo refusal | High — a ratify: (b) undoes a deliberate refusal |

## Supported by default (not decisions)

- **The spawn flag itself.** Whether the argv carries `--session-id` cannot be seen outside the dispatcher: `claude --bg` discards it (5 of 5 probes across CLI 2.1.246 and 2.1.269, recorded in `#conveyor-dispatch-calls-the-declared-operation`) and prints one stderr warning. The merge dropped it, on `main`'s more than seven pinned argv tests; the statute already says the dispatcher addresses a session by the id the CLI prints back. Recorded, not ruled.
- **Item-numbered fix PRs.** Unchanged on both sides (`WE #<n>`); only the no-item-number case is in question.

## Fork 1 — `we:skills-src/conveyor/runner.mjs#makeCliMechanicalPasses`

*Fork-existence:* one runner has one pass list, and neither *whole* list is acceptable on the other's terms. `main`'s function (b) is a flawed branch: it runs every pass through the injected `exec` (`execFileSync`, `we:skills-src/conveyor/runner.mjs:276-278` on `main`), which blocks the event loop, so combined with the branch's blocking review dispatch (`:615`) and verify-dispatch it cannot renew the 15-minute singleton lease while they run, and it has neither sync pass. (`main` alone does not lapse the lease: its own review dispatch forks and returns.) Two side-by-side lists (c) is the second flawed branch: one runner with two sources of truth for what it runs each tick. The composability probe passes for the *capabilities*: `runQuietHeartbeating` already takes a repo per call (`:720`), so a per-repo fan-out is a loop around it. The end state is therefore one heartbeated list scoped per repo, which is (a), and the ruling is a ratify of that end state.

Branch: heartbeated passes (each renews the lease, every 60 s mid-pass, `we:skills-src/conveyor/runner.mjs:335,485,720`), `main-ref-sync` and `poc-branch-sync` first (`:501,:512`; neither script exists on `main`), and a blocking mechanical review dispatch. Main: a repo-scoped fan-out over the constellation repos, a per-repo PR snapshot (`--prs-file=`), the advisory-label sweep and the operator-notify pass, and the `unsupported-repo` ledger write. The merge kept the branch's function whole (main-only fragments spliced into it were a syntax error) and `describe.skip`ped the three cases in `we:skills-src/conveyor/__tests__/runner-repos.test.mjs:47`, with a header (`:1-20`) saying how to re-enable them.

**What the fast-forward does not gain, stated exactly:** `we:scripts/operations/operator-notify.mjs` and `we:scripts/conveyor/advisory-label-sweep.mjs` are on the staging ref but nothing on it calls them (grep over `skills-src` and `scripts`, tests excluded), so the prototype's runner sends no desktop push when a `review:human` PR is ready and runs no advisory-label sweep; `we:skills-src/review/SKILL.md:275` still says the runner sweeps them. The prototype's runner never had either (both were added to `main` after the merge base), so nothing that runs today stops.

- **(a) [default] Accept the branch's function as the base; the end state is ONE heartbeated pass list, scoped per repo.** **The port is not a precondition of the fast-forward** (part of this option, not a separate choice): nothing that runs today stops, and holding the fast-forward keeps the branch behind `main`, against the purpose of #3804's merge-promptly rule. Follow-up (a build item on the prototype): port `main`'s per-repo fan-out, the `--prs-file=` snapshot, the advisory-label sweep, the operator-notify pass and the `unsupported-repo` write into it, and restore the three skipped cases. Two constraints the port carries. The three cases inject a synchronous `exec` and `fetchOpenPrs` and assert on `exec.mock.calls`, but the branch's `runQuietHeartbeating` spawns asynchronously and has no such seam, so the port adds a spawn seam and rewrites each case keeping the meaning of its assertion (a rewrite of assertions comes back as its own decision card, per the statute). And the mechanical review wrapper mints its session slug without a repo (`we:scripts/operations/review-dispatch-wrapper.mjs:164`), so a fan-out to foreign repos would mint untagged names, the very ambiguity fork 3 rules on; the port makes the wrapper carry the repo.
- **(b) Take `main`'s function.** Rejected: loses the heartbeat, both sync passes, verify-dispatch and the blocking review dispatch, which the running conveyor depends on.
- **(c) Keep both pass sets side by side.** Rejected: two sources of truth for what one runner runs.

```js
// Fork 1 (a) — the end-state shape (a sketch). `runQuiet` (runner.mjs:485) closes over ONE `repo`; the per-repo call is `runQuietHeartbeating` (runner.mjs:720)
for (const [key, { slug }] of Object.entries(repos)) {         // main's fan-out, we:skills-src/conveyor/runner.mjs:307 on main
  await runQuietHeartbeating(join(scriptsDir, 'conveyor/advisory-label-sweep.mjs'),
    { repo: slug, args: ['sweep', ...prsArgs], heartbeat, label: `advisory-label-sweep [${key}]` });   // still heartbeated
}
await runQuiet('operations/operator-notify.mjs', ['--once'], { forwardRepo: false });               // repo-agnostic: once per tick
```

Skeptic: SURVIVES-WITH-AMENDMENT → applied. Classification attack landed in part: with (b) and (c) both broken this is a ratify of the composed end state, and the "port before or after the fast-forward" question is a sequencing call; it is stated as a term of option (a), with its reason, instead of being offered as a separate option (a first version called it settled by statute, which overclaimed: the statute's points 1 and 4 cover merging `main` in and graduating to `main`, not a port onto the prototype). The lease claim was narrowed (true only in combination with the branch's blocking dispatch). The follow-up gained the spawn seam and the repo-carrying review slug. The "nothing calls the two scripts" claim held.
Screen: clear. The reviewer noted (c)'s reason had read as maintenance; reworded to "two sources of truth".

## Fork 2 — `we:scripts/conveyor/reconcile-fix-dispatch.mjs`: a pull request with no item number

*Fork-existence:* for a PR whose head ref names no item number the fix pass either dispatches or refuses; it cannot do both. Neither side is broken on its own premise: `main`'s refusal was correct because there was "no honest `WE #<n>:` commit prefix" (`main` `:108-111`, refusal `:148`), and the branch removes that premise by attributing the repair `PR #<n>`. Composability probe, run and failed to produce a second end-state: a `refuseNoItem` policy over the one shared planner is trivially buildable, but its "on" value has no principled use. A fix is owed only after the conveyor's own review has bounced the PR (`OWED.bounced`, `we:scripts/conveyor/reconcile-core.mjs:192`), so the conveyor has already taken the PR on; and whether a head ref carries an item number is a naming accident (PR #2210's ref carried `2206`, another PR's number), not a property that separates PRs the agent may repair from PRs it may not. A knob keyed on it would withhold repairs at random, so there is no second legitimate value to configure. The choice is whether `PR #<n>:` is an honest attribution. The affected population is real conveyor work, not only hand-opened PRs: `we:scripts/conveyor/reconcile-core.mjs:20-22` names four `lane/review-…` PRs whose refs return no item number.

Both sides cite the same evidence (PR #2210, head ref `lane/file-2206-review-findings`) **and agree on the fact**: `2206` is the reviewed PR's number, not the item this PR delivers, and the fix planner never derives an item number from branch digits. (The card as first written said `main` calls the refusal "a bug to route around"; `main`'s docblock says the opposite. The disagreement is only the prefix.) Branch (`:116-121`, plan `:142-172`): `itemNum: null`, scope from the PR's own changed files, attribution `PR #<n>`, and `no-scope` still refuses when that scope comes back empty (`:161`). The merge kept the branch's; two of `main`'s cases that encode the refusal were dropped and its three safe-scope-sanitiser cases were ported and pass.

- **(a) [default] Accept the branch: dispatch it as `PR #<n>`.** The attribution says truthfully what the repair is, so `main`'s stated reason for refusing (no honest prefix) no longer applies. This already includes the narrow refusal the card first listed as a separate option (refuse only when no scope can be derived): the staging ref does exactly that (`:161`). Owed at graduation: `main` takes the two brief tokens (`we:skills-src/conveyor/fix-agent-brief.md:44-45`, commit line `:203`) and the token requirement (`we:scripts/operations/dispatch-lane.mjs:117,156`), and drops its `no-item-num` refusal (`main` `:148`) and two tests.
- **(b) Take `main`: refuse.** Rejected: `main`'s only stated reason is answered by (a)'s attribution, and refusing leaves a reviewed PR with no fix agent, so a person must fix it by hand.

```text
# Fork 2 (a) — the fix commit's subject (we:skills-src/conveyor/fix-agent-brief.md:203)
WE #3438: address review:changes on PR #2301 — <fix>     # PR delivers an item: unchanged
PR #2210: address review:changes on PR #2210 — <fix>     # head ref names no item: was refused on main (no-item-num)
```

The attack that could have flipped this, and did not: does anything read a commit subject or PR text as an item number, so that `PR #2210:` would be taken for backlog #2210 (a real, unrelated card, `we:backlog/2210-dev-browser-panel-wire-live-page-we-conformance-detection-in.md`)? The delivered-item reader anchors its title match to a `WE`-or-bare number (`we:scripts/lib/open-pr-items.mjs:243`, `^\s*(?:WE\s+)?#?(\d{2,5})\s*:`), which `PR #2210:` cannot match; there is no `commit-msg` hook (`we:.githooks/` holds `post-merge`, `pre-commit`, `pre-push`); and the fix brief forbids `pr-land`, which is the only place a commit subject becomes a PR title. Not in this decision: the *mention* reader `itemNumsFromPr` (`we:scripts/lib/open-pr-items.mjs:45-46`) does read `lane/file-2206-review-findings` as a mention of item 2206. It is unanchored by design (it answers "which items does this PR mention", not "which does it deliver") and separate from the fix planner's rule, so it is neither changed nor ruled here.

Skeptic: SURVIVES — beat the "attribution read as an item number" attack (evidence above). Amendments folded in: the title-regex invariant should be pinned by a test (`deliveredItemNumsFromPr('lane/file-2206-review-findings', 'PR #2210: …')` returns `[]`), and the stale deferral label `we:scripts/operations/wip-report.mjs:180` ("no backlog item number to plan a fix from") is corrected; both go in the follow-up commit. Not traced: the conflict and `ci:failed` entry paths into a fix dispatch (only the bounced path was read); the fork's outcome is the same on each.
Screen: clear. The reviewer asked (b)'s rejection to lead with the merit half rather than the toil half, and asked for a facade attempt instead of "no knob to expose"; both done, and the probe (a `refuseNoItem` policy, and why its "on" value has no principled use) is now in the fork-existence line.

## Fork 3 — `we:scripts/conveyor/session-reaper.mjs`: untagged session names

*Fork-existence:* for one input, an untagged PR session name such as `review-148`, the reaper either resolves it as `we` or leaves it repo-less; it cannot do both. `main`'s guess is the flawed branch: `we`'s slug tag is the empty string (`we:scripts/lib/constellation-repos.mjs:19`), so an untagged name is ambiguous by construction (a current WE session and a legacy `plateau-app` one look alike), and a guessed `we` can be wrong in either direction, one of them irreversible: a wrong "merged" answer makes the reaper stop a live session.

Main's reaper parses the name to `repo: 'we'` for every untagged name (`we:scripts/conveyor/session-slug.mjs:29`, identical on both refs) and caches under the guessed key (`pr:we:<n>`, `we:scripts/conveyor/session-reaper.mjs:285-317` on `main`), so a legacy `plateau-app` session and a WE session with the same number share one answer. The branch leaves an untagged name repo-less ("the resolver must not guess `we`", `we:scripts/conveyor/session-reap-plan.mjs:182-198`), resolves it from the session's own ledger entry or else against every constellation repo (`we:scripts/conveyor/session-reap-evidence.mjs:165-181`; only an OPEN PR blocks, closed-unmerged is terminal per the operator's 2026-09-20 rule), keys the cache by repo, and caps `gh pr view` at 25 per tick (`:48`). The merge kept the branch's split reaper (a facade re-exporting the 19 names the monolith exported, over three modules; the card first said "26 against 13", which counts the three modules' own exports). Main's three test cases asserted the guessing shape and were rewritten to assert the repo axis they exist for (tag parsing, an explicit `--repo` on every lookup, a global call cap).

**What is and is not still pinned** (corrected from the first version, which said both outcomes were unpinned): repo-less reap and keep are pinned on the staging ref (`we:scripts/conveyor/__tests__/session-reap-evidence.test.mjs:215-235`, `we:scripts/conveyor/__tests__/session-reap-evidence-cli.test.mjs:171-186`). What was lost is `main`'s two mixed-listing cases (`main` `we:scripts/conveyor/__tests__/session-reaper.test.mjs:371-384` and the call-cap case `:399-410`), which is why the adapted cases at `we:scripts/conveyor/__tests__/session-reaper.test.mjs:62-86` assert calls only. **They cannot simply be restored: on the same input they pin the opposite outcome.** Both list an untagged `review-49` beside `review-fui-49` (PR 49 open in `frontierui`, merged in `we`); `main` guesses `we`, sees "merged" and **reaps** `review-49`; the branch leaves it repo-less, sees the open PR in `frontierui` ("still open in some repo — never reap") and **keeps** it, and over the cap of one lookup it keeps both. That flip is the observable effect of this fork.

- **(a) [default] Accept the branch's no-guess resolution, including that flip; the follow-up writes the two listing cases in the branch's form, asserting the new outcome (keep while the number is open in another repo; keep over the cap).** A guessed `we` is wrong for legacy sessions (the live `review-148` was `plateau-app#148`). **Stated cost:** because `we`'s tag is empty, WE sessions stay untagged for good, so the cross-repo check never ages out; each untagged session with no ledger entry costs one to three `gh pr view` calls, bounded by the cap of 25 per tick. The check can only leave a finished session running, never stop a live one.
- **(b) Take `main`'s guess and cache.** Rejected: wrong for legacy untagged names, and one cached answer serves two repos.

`main`'s guess has real grounding: `we:scripts/lib/constellation-repos.mjs:82` documents "Untagged sessions belong to WE", which is true of every name minted since tags began. It is wrong only for names minted before tags, a population that only shrinks; whether the check should retire once it has shrunk is the question behind #3802's option (c), not this fork's. This fork rules the staged branch only. **#3802 Fork 3 (graduation to `main`) stays open and is not decided here** (that card is not prepared). Two facts for whoever prepares it: its option (a) says the cross-repo check stays "until sessions minted before repo markers age out", which does not hold (see the cost above), and it has a third option, keying on the marker cutover time, that this fork does not need.

```js
// Fork 3 (a) — what changes for an untagged name
sessionTarget('review-148')     // main:  { kind: 'pr', id: '148', repo: 'we' }   ← guessed
                                // staged: { kind: 'pr', id: '148' }              ← repo-less; resolved from the session's ledger entry, else every repo
sessionTarget('review-pa-148')  // both:  { kind: 'pr', id: '148', repo: 'plateau-app' }
```

Skeptic: SURVIVES-WITH-AMENDMENT → applied. Harm-direction attack: the resolver can only under-reap, but a guess errs both ways and the live `review-148` incident was an under-reap, so the argument is now stated as "wrong in either direction, one irreversible". Landed, folded in: the perpetual cost of the check, the two errors (cache key per PR number; "coverage not covered any more"), and the coupling to #3802, which cannot be "ruled together" while #3802 is unprepared, so the fork now rules the branch only. Found while re-reading `main`'s two lost cases: they pin the opposite outcome, so "restore the coverage" was wrong and the follow-up writes them in the branch's form. Option (c) of the first version (drop the lost coverage) is removed as a strawman; the new cases are part of (a).
Screen: clear.

## Fork 4 — an unparseable spawn banner in `we:scripts/operations/dispatch-lane-io.mjs` (the one place `main` won)

*Fork-existence:* a forced invariant. When `claude --bg` exits 0 but prints nothing parseable, the dispatcher either throws or records a made-up id; the made-up id (b) is the flawed branch, because it stores a session id the CLI never created, which is how #3331 started. (The argv flag is not part of this fork; see "Supported by default".)

Both sides fixed #3331. The merge took `main`'s argv shape (no flag, `we:scripts/operations/dispatch-lane-io.mjs:1534-1546`) and kept the branch's throw (`no parseable session handle`, `:1433`, doc `:1404`), where `main` fell back to the minted id. **The cost of (a), named:** `main`'s own docblock (`main` `we:scripts/operations/dispatch-lane-io.mjs:1000-1010`) argues that a missing handle pushes the dispatch into the `unknown` bucket, which only a person can close; the throw accepts that, because the replay guard blocks a double dispatch. Four branch comments and two branch test hunks were adapted, each with a dated note at the site; **one comment was missed**: `we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs:231` still says `--session-id` IS emitted, above an argv that omits it (corrected in the follow-up commit).

- **(a) [default] Accept the branch's throw on an unparseable banner.** A spawn with no parseable handle is a loud failure, and the statute already has the dispatcher address a session by the id the CLI prints back (`#conveyor-dispatch-calls-the-declared-operation`).
- **(b) Take `main`'s fallback to the minted id.** Rejected: records a session id that may not exist.

```js
// Fork 4 (a) — argv on the staging ref (we:scripts/operations/dispatch-lane-io.mjs:1534-1546); the handle comes only from the banner
['--bg', '-n', String(payload.sessionSlug || `conveyor-${payload.num}`), ...extraArgs, prompt]   // no '--session-id'
// no parseable banner → throw ('no parseable session handle', :1433), never the minted id
```

Skeptic: SURVIVES. The "forced invariant" attack landed only as a named cost (above): the throw is a real trade against a person-closed `unknown` dispatch, accepted because the replay guard holds. A missing statute citation was added, and the "three runs" count was replaced by the statute's 5 of 5.
Screen: flagged(impl) → the first version had the argv flag as option (b) of this fork; the flag is invisible outside the dispatcher, so it was moved to "Supported by default" and only the banner half stays a fork.

## Fork 5 — `we:scripts/operations/__tests__/action-dispatch-paths.test.mjs`: the changed record-independence case

*Fork-existence:* a forced invariant, and the statute routes it here (a changed assertion comes back as a decision card). The revert (b) is the flawed branch: it undoes a deliberate refusal `main` added, and the refusal has a merit reason, not only an authority one: the fix brief and gate are WE-only (`we:scripts/lib/we-only-checks.json:28,32`), so a foreign fix would run the WE brief in another repo. The branch tip did dispatch a foreign fix (its case asserted `frontierui` returned an `agentId`); the merge reversed that capability, on purpose.

The branch's case asserted that a review on `we#77` does not block a fix on another repo's PR #77. Main has since made `dispatchFix` refuse any repo but `we` outright (`we:scripts/conveyor/reconcile-fix-dispatch.mjs:521`, at the top of the function and before the record is read). The case now asserts that refusal (`:41-52`). **The card as first written said the record's repo-independence cannot be exercised today. It can, in the other direction:** review dispatch accepts a foreign repo (`planReviewDispatch` refuses only when the checkout is missing, `we:scripts/operations/review-dispatch.mjs:396-413`, and `checkoutExists` is injectable), it keys its record by repo (`actionResource(planned.repo, { type: 'pr', id })`, `:499`; the CLI path at `:614` too, the default path being the mechanical one, `dispatchReview` the `--agent` opt-in at `:583`), and the real caller for a foreign review is `we:scripts/operations/land-advance-io.mjs:208`, with PRs read from every swept repo (`:95-99`). The key shape itself is pinned (`we:scripts/operations/__tests__/action-records.test.mjs:17-20`); what nothing pins is that the two dispatchers pass the repo into it.

**A defect the merge introduced, found while checking this fork:** the guard compares `repo !== 'we'` (a repo KEY), but `we:scripts/operations/land-advance-io.mjs:210` (code that exists only on the branch) calls `dispatchFix(..., { repo: row.slug })` with the SLUG `chalbert/web-everything`, so every fix dispatched through land-advance, WE's own included, now throws `unsupported-repo` (the same guard is at `:382` in `tryResumeFix`). On the branch tip it worked, because the guard was `main`'s; no test covers the combination. Land-advance's fix path does not run live yet (the drain does not call it, per the #3383 tracker), so nothing is broken today, but the refusal this fork ratifies is broader than the one `main` meant.

- **(a) [default] Accept the foreign-repo refusal and the changed case, with the guard corrected to compare keys** (`repoKeyForSlug(repo) !== 'we'`; that helper accepts a key or a slug, `we:scripts/lib/constellation-repos.mjs:60-75`) at `we:scripts/conveyor/reconcile-fix-dispatch.mjs:382` and `:521`, **and add two cases:** a `we` fix called with the slug is not refused, and the independence case in the direction that is reachable (dispatch a review for a foreign repo, then a `we` fix on the same number, and assert the fix is not held). Same rule as fork 3: what the merge dropped or broke comes back, it is not left unpinned.
- **(b) Revert `main`'s refusal on the branch.** Rejected: the WE-only brief and gate (above).

```js
// Fork 5 (a) — the guard, comparing keys (we:scripts/conveyor/reconcile-fix-dispatch.mjs:521; the same at :382)
if (repoKeyForSlug(repo) !== 'we') throw new Error(`unsupported-repo: ${repo} requires its own fix brief and gate`);
// (today: `if (repo !== 'we')`, which refuses 'chalbert/web-everything' as land-advance-io.mjs:210 passes it)

// Fork 5 (a) — the reachable direction (sketch, against the existing fixtures in the file)
const actions = createActionStore();
dispatchReview({ pr: 77, repo: 'frontierui', root: '/fake-primary', actions, spawnAgent,
  checkoutExists: () => true, checkStaleness: () => ({ fresh: true }), readBrief: () => reviewBrief });
const fix = dispatchFix(planned, { root: '/fake-primary', actions, spawnAgent, readBrief: () => fixBrief });
expect(fix.agentId).toBe('aabbccdd');            // not held
expect(spawnAgent).toHaveBeenCalledTimes(2);     // the review and the fix both spawned
```

Skeptic: REFUTED as a fork, kept as a ratify. The attack: there is no live alternative to the test, so this is an owed test, not a ruling. Accepted in part: the first version's option (a) ("leave it unpinned until cross-repo dispatch exists") was a strawman and is removed, its false premise ("no test would fail") corrected (the key shape is pinned; the call sites are not), and the sketch's assertion strengthened. It stays a `## Fork` only because the statute sends a changed assertion here. The re-screen then found the slug-versus-key defect above by running the guard against the caller; folded into (a).
Screen: flagged(prio) → the first version offered "test now" against "test when cross-repo dispatch is enabled", which is timing; dissolved to one ratify (accept the changed case and the refusal) with the revert as the only excluded branch. Re-screened after the rewrite: clear. The reviewer noted that the added cases and the guard correction are unconditional work (listed in "At ratification"), and that the ruling itself is only "accept the foreign-fix refusal".

## At ratification

**The rule for the split:** work that only touches tests, comments or a guard on the staged tree, and needs no new design, goes in one follow-up commit on the staging ref before the push; work that changes what the runner does, or graduates to `main`, is a build item carved at resolve. First, merge the new branch tip into the staging ref and resolve its one conflict (`we:scripts/operations/__tests__/http-adapter.test.mjs`); a resolution there that changes an assertion comes back as its own card (statute point 2).

**Before the push, one follow-up commit on the staging ref:**

| From | Change | Files |
| --- | --- | --- |
| Fork 5 (a) | Compare repo keys in both `unsupported-repo` guards; add the WE-slug case and the reachable-direction independence case | `we:scripts/conveyor/reconcile-fix-dispatch.mjs`, `we:scripts/operations/__tests__/action-dispatch-paths.test.mjs` |
| Fork 4 (a) | Correct the stale "flag IS emitted" comment | `we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs` |
| Fork 3 (a) | Write the two mixed-listing cases in the branch's form (an untagged number open in another repo is kept; over the cap it is kept) | `we:scripts/conveyor/__tests__/session-reaper.test.mjs` |
| Fork 2 (a) | Pin `deliveredItemNumsFromPr` against `PR #<n>:` titles; correct the `no-item-num` deferral label | `we:scripts/lib/__tests__/open-pr-items.test.mjs`, `we:scripts/operations/wip-report.mjs` |

**After the push, build items carved at resolve** (each carrying only its own slice of the scope):

| From | Work | Predicted scope | Lands on |
| --- | --- | --- | --- |
| Fork 1 (a) | Port the fan-out, snapshot, advisory sweep, operator-notify pass and `unsupported-repo` write into the heartbeated list, with a spawn seam; restore the three skipped cases; make the review wrapper carry the repo | `we:skills-src/conveyor/runner.mjs`, `we:skills-src/conveyor/__tests__/runner-repos.test.mjs`, `we:scripts/operations/review-dispatch-wrapper.mjs` | the prototype branch |
| Fork 2 (a) | At graduation, `main` takes the brief tokens and drops its `no-item-num` refusal and two tests | `we:scripts/conveyor/reconcile-fix-dispatch.mjs`, `we:skills-src/conveyor/fix-agent-brief.md`, `we:scripts/operations/dispatch-lane.mjs` | the reconcile-fix slice of #3443 |

## Ruling

Not yet ruled.

## Done when

1. **Executable** — `grep -l '^## Ruling' we:backlog/*decision-accept-each-of-the-five-catch-up-merge-forks*.md` lists this card (it fails until the operator has ruled and a `## Ruling` section names the chosen option for each of the five forks).
2. After the fast-forward: the old branch tip is an ancestor of the new one (`git merge-base --is-ancestor <old-tip> origin/lane/mechanical-dispatcher`), no commit on the branch was rewritten, and `5ab140f50` (the newest `main` commit in the staging ref) is an ancestor of the branch. The commits only on `main` are not zero and keep growing; the sync pass takes those (#3804, ratified: merge promptly).

### Review jury (provisional — pre-registered #2638)

Care level: `elevated`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

**Predicted touch-set (#2619)** for the work this decision authorizes, coarse and prefix-shaped — the follow-up commit
on the staging ref: `we:scripts/conveyor/reconcile-fix-dispatch.mjs` ·
`we:scripts/operations/__tests__/action-dispatch-paths.test.mjs` ·
`we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs` · `we:scripts/conveyor/__tests__/session-reaper.test.mjs` ·
`we:scripts/lib/__tests__/open-pr-items.test.mjs` · `we:scripts/operations/wip-report.mjs`. Each carved build item takes
its own slice: the runner port (`we:skills-src/conveyor/runner.mjs`,
`we:skills-src/conveyor/__tests__/runner-repos.test.mjs`, `we:scripts/operations/review-dispatch-wrapper.mjs`) and the
graduation of the fix-attribution change (`we:scripts/conveyor/reconcile-fix-dispatch.mjs`,
`we:skills-src/conveyor/fix-agent-brief.md`, `we:scripts/operations/dispatch-lane.mjs`). The frontmatter `scope:` was set at filing and is not the
build scope.
