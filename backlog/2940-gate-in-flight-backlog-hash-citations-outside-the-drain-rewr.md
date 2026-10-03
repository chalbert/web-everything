---
bornAs: xabqoah
kind: story
size: 3
parent: "x0hvbwx"
status: open
blockedBy: ["xcs4nce"]
scope: ["we:scripts/check-standards.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards.test.mjs", "we:scripts/__tests__/check-standards-main-state-parity.test.mjs"]
dateOpened: "2026-08-05"
preparedDate: "2026-10-03"
preparedAgainstSha: "838e849ab8b35fa4b94216b7d474b3138d979ba5"
tags: [backlog, gate, hygiene, policy, ci]
---

# Gate in-flight backlog hash citations outside the drain's rewrite scope

**Re-aimed 2026-10-03** under epic #x0hvbwx as the `prCi.mainStateParity` story. A PR's check now runs the
drain's post-land numbering as a dry run on the PR merged with current main, so a PR that would make the
drain refuse fails on the PR, not on main. Governed by `prCi.mainStateParity` (default `on`).

## Original premise (kept for lineage)

JIT numbering (#2288) gives a new item a temporary hash id (`x` + six chars) that the drain rewrites to its
real `NNN` at land. Every hash citation planted outside the rewrite scope dangles once the item lands. PR
#1046 (`#2942`) planted about 60 across `we:scripts/` and `we:skills-src/`; three were runtime text shown to a
reviewing model. The original ask: a `check:standards` rule that errors on in-flight hash citations outside
the drain's rewrite scope, derived from the same code the drain uses, so the gate follows any change to the
scope.

**Prevention for:** PR #1046 review, round 2 finding 8 (`#2942`).

## Progress

Prepared 2026-10-03 against `838e849ab`.

| Old premise or scope | Corrected, with evidence |
| --- | --- |
| The drain rewrites only `backlog/` and `docs/agent/`. | Wider now: `backlog/`, `docs/agent/`, `agent-memory-src/` and the conveyor flows (`we:scripts/lane-drain.mjs:647-652`). Open PR #3788 adds the top-level soak break definitions. |
| An out-of-scope citation silently dangles after land. | Since the #4075 hardening, a hash-**path** citation outside the scope makes the drain **refuse the whole numbering pass** (`we:scripts/lane-drain.mjs:840-875`). That is worse: every pending card stays un-numbered. On 2026-10-03, the merge of PR #3176 (`bc9db934c`) put a soak citation outside the scope, the numbering refused, 282 cards stayed hash-named on main, and main's CI went red with 270 errors. |
| The fix is a new scan over a path constant. | The drain's own refusal logic can run as a dry run: `numberPendingHashes(cwd, { dryRun: true })` reaches the refusal check before its dry-run return (`we:scripts/lane-drain.mjs:840-875`, then `:889`). Calling it **is** "derive from the same code". No second path list. |
| PR CI and main judge the same thing. | **No.** `strandedHashesOnMain` hard-errors on main but only warns in a lane or in PR CI (`we:scripts/check-standards.mjs:774`, through `isPullRequestCiRun` at `we:scripts/check-standards-rules.mjs:2865-2868`, rule at `:2870-2899`). So PR #3176 was green while its land turned main red: failure mode (1). |

Scope widened from "a citation rule" to "PR-side parity for main-only rules", with the dry run as the first
parity rule. The original goal, catching the dangling citation before land, is kept and delivered by the dry
run.

## Design

1. **Dry-run parity rule** `drainPostLandDryRun(root)` in `we:scripts/check-standards-rules.mjs`. It calls
   `numberPendingHashes(root, { dryRun: true })`. If the result has `error`, under `on` it is a hard error:
   "after this lands, the drain's JIT numbering will refuse: <detail>. Cite the durable thing, or widen the
   sweep." It runs in every locus:
   - In PR CI, the checkout is the PR merged with current main (`we:.github/workflows/ci.yml:168-172`,
     check-standards at `:215`).
   - In a lane, it runs on the lane's tree.
   - On main, an error means a strand is about to happen.
2. **Main-state rule registry.** Export `MAIN_STATE_RULES` from `we:scripts/check-standards-rules.mjs`. It
   lists each rule whose severity depends on the locus (today `strandedHashesOnMain`) next to its PR-side
   twin (`drainPostLandDryRun`). A test fails if `we:scripts/check-standards.mjs` branches on
   `isPullRequestCiRun` or `inLane` for a rule that is not in the registry. So a new main-only difference
   cannot land without a PR-side twin.
3. **Policy.** `on`: the dry-run rule runs. `off`: it is skipped (today's behaviour). Read through the loader
   from story #xcs4nce.

This also covers failure mode (3), a CI heal turning a PR green without fixing the cause. Under `on`, a heal
is judged by the same post-land rule, so it cannot green a PR whose land would stop the numbering.

## MVP

Steps 1 to 3.

## Test plan

- **Capability (RED today, fails before this lands):** `we:scripts/__tests__/check-standards-main-state-parity.test.mjs`:
  - **Replay of the PR #3176 merge (`bc9db934c`):** a temp repo with a pending card `xhash01-alpha` and a file
    outside the rewrite scope citing that card by its hash-named backlog path. Use the nested fixture path from PR #3788's
    refusal cases, so the case stays valid after #3788 widens the sweep. Run with
    `GITHUB_EVENT_NAME=pull_request` and `GITHUB_ACTIONS=true`.
    - Before this story: no error on the PR.
    - After, under `on`: one error naming the file and the hash.
    - Under `off`: no error.
  - Default (no config): behaves as `on`.
  - A clean tree (citations only in scope): no error under either value.
  - The registry test: a locus branch with no registered twin fails.

## Proof plan

1. In a scratch clone, check out the PR #3176 merge state (`bc9db934c`) and run `npm run check:standards`
   with the pull-request environment set. **Before** (current main's rules): passes, with only the
   stranded-hash warning path. **After:** fails with the dry-run error naming the soak citation.
2. Run the same on current origin/main. It must show no new error, so the rule adds no false red.
3. Paste both outputs in the PR.

## Follow-ups

- Bare hash tokens (an `x` plus six characters, without a backlog path) outside the scope do not make the
  drain refuse. They only dangle. A warning for them was part of the original ask. It is left as a follow-up,
  because it never turns main red.

## Done when

1. **Executable:** the replay case in `we:scripts/__tests__/check-standards-main-state-parity.test.mjs` fails
   before this lands and passes after.
2. Proof steps 1 and 2 are pasted in the PR.
