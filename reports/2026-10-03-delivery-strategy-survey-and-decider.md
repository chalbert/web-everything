# Delivery strategies in the wild, and a decider that picks between them

*Session report, 2026-10-03. Operator ask (verbatim): "surely there must be many other such strategy that exist in
the world and a decider could pick between? Opus+codex research as very important".*

Two independent surveys fed this report. One is a Claude (Opus) web survey that fetched and checked its sources.
The other is a Codex survey run through `we:scripts/codex-direct-task.mjs` in a scratch clone (52 entries; Codex
said it had network access, and it marked claims it could not establish). Section 4 compares them. The decider
design is in section 5; the decision card is x1hhjnb. Cards filed are in section 7.

## 1. Bottom line

- Every large shop that lands hundreds of changes a day uses the same four moves. **Test several changes together
  on top of the current trunk. Split a failed batch in half to find the bad change. Run only the tests a change can
  affect. Handle flaky tests and a broken trunk automatically.** We do none of the first two and only part of the
  last two.
- **Our merge rate is past what one-at-a-time testing can serve.** About 312 merges in 12 hours is 26 an hour. One
  14-minute CI run at a time serves about 4 an hour. Today PRs merge on their own green, which is about 6 merges
  stale at merge time.
- **Our own statute already forbids that.** `#gate-on-merged-tree-lane-fast-fail` says the binding gate runs on
  the merged tree before main moves. Merging on a stale own-green does not honour it at this rate. Card xi8vgqq
  (re-check before merge, PR #3794) is the enforcement. If re-checks then queue up behind the drain, tripwire
  #2740 fires and surfaces the already-ruled batched merge queue (`#event-driven-land-is-wake-only` clause 3).
- **GitHub's own merge queue is out twice over.** It needs an organization-owned repo; ours is user-owned. And
  `#pr-flow-rollout-mechanism` keeps it off anyway, because it would land a couple's WE-half PR out of
  impl-first/WE-last order. The custom drain owns every merge.
- **Today, main is mostly unobserved.** Of the last 100 runs of `we:.github/workflows/ci.yml` on main
  (09:25Z–17:55Z), 85 were cancelled, 11 failed and 3 succeeded. Every completed run from 12:00Z to 17:24Z
  failed. The cancellations come from one setting: `we:.github/workflows/ci.yml:50-52` cancels in-progress runs
  per ref, and that applies to pushes to main too.
- **Overlap is the norm for parallel agents.** Two 2026 studies of agent PRs found 28% to 42% conflict rates. At
  this snapshot, 5 of our 23 open PRs share a non-backlog file with another open PR.
- **No single strategy wins everywhere.** The best batch size falls as the failure and flake rates rise. Stacking
  wins when the predecessor is stable and loses while it is still changing. That is the case for a decider: one
  rule table that reads live signals and picks per decision point, with fixed settings always winning.

## 2. What we measured here (2026-10-03, `origin/main` `22103ded6`)

| Signal | Value | How measured |
| --- | --- | --- |
| Merges to main | about 312 in 12 h (26/h) | operator figure |
| PR CI duration | p50 14 min, p90 16 min | operator figure |
| Local verify | p50 2 min, p90 8 min (selected tests) | operator figure |
| Main CI outcomes, last 100 runs | 85 cancelled, 11 failed, 3 success, 1 running | `gh run list` on the CI workflow, branch main, limit 100 |
| Main red window | every completed main run failed from 12:00Z to 17:24Z | same, completed runs only |
| Latest red main jobs | `soak-shard (3)`, `daemon-soak` | `gh run view` on `e3bd114d6` |
| PR CI outcomes, last 100 PR runs | 80 success, 16 failure, 1 cancelled, 3 running | `gh run list --event=pull_request` |
| Open PRs | 23 | `gh pr list --state open` |
| Open PRs sharing a non-backlog file with another open PR | 5 of 23; 4 of 253 pairs | pairwise file intersection |
| Hottest shared files | `we:docs/agent/platform-decisions.md` (3 PRs), `we:scripts/review-set-label.mjs` and its test (2 each) | same |
| Serial CI capacity | about 4 merges/h at 14 min | arithmetic |
| GitHub native merge queue | unavailable (user-owned repo) and ruled off | GitHub docs; `#pr-flow-rollout-mechanism` |

The PR CI failure rate (16 of 97 completed, about 16%) is the per-PR failure probability *p* used below. It mixes
real failures, flakes and red-main fallout. That is why a flake signal comes before any batch tuning. Whether
today's red main came from stale-green integration or from a flaky soak shard is **not established**; card
xmje9g6's replay answers it.

## 3. The survey, by decision point

Each row: what it is, who uses it, when it wins, what it costs, a source. Sources were fetched or seen by the Opus
survey unless marked "Codex". Section 4 lists what only one survey found.

### 3.1 Merge and integration (how a PR reaches main)

| Strategy | What it is | Who | Wins when | Costs and failure modes | Source |
| --- | --- | --- | --- | --- | --- |
| Serial "not rocket science" queue | Test each PR on top of current trunk, merge if green, one at a time. | Rust (bors, homu), Servo | arrival rate × CI time < 1 | Uber: at 1,000 changes/day and 30-min CI the last change waits over 20 days. For us, 26/h vs 4/h. | [bors-ng](https://github.com/bors-ng/bors-ng), [Uber EuroSys'19](https://www.masoud.io/docs/eurosys19.pdf) |
| Merge on own green (today) | Merge any PR whose own CI is green, whatever main did since. | most small repos; us | low merge rate, low coupling | Uber: changes 1–10 h stale had a 10–20% chance of breaking main. | [Uber EuroSys'19](https://www.masoud.io/docs/eurosys19.pdf) |
| Require up-to-date (strict) | Branch must contain the latest main before merging. | GitHub branch protection | low merge rate | A serial queue where the author rebases; can dismiss approvals and re-trigger review. | [GitHub docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) |
| GitHub merge queue | Builds merge-group refs (main + PRs ahead + this PR); group size 1–100; all-green or head-green. | GitHub's monorepo: hundreds of PRs/day, groups of 30+, wait to ship down 33% | high volume, mostly green PRs | Unavailable here and ruled off. A failure restarts the groups behind it. | [docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue), [GitHub blog](https://github.blog/engineering/engineering-principles/how-github-uses-merge-queue-to-ship-hundreds-of-changes-every-day/) |
| GitLab merge trains | Cumulative pipelines in parallel (A, A+B, A+B+C), up to 20. | GitLab | most PRs pass | Each failure restarts every pipeline behind it. | [GitLab docs](https://docs.gitlab.com/ci/pipelines/merge_trains/) |
| Zuul dependent pipeline + adaptive window | Test each change assuming those ahead pass. Window grows +1 per success, halves per failure, floor 3. | OpenStack, Wikimedia | low failure rate; self-tunes as it rises | Aborted speculation wastes CI; Uber found pure optimism does not scale under high conflict. | [Zuul gating](https://zuul-ci.org/docs/zuul/latest/gating.html), [pipeline config](https://zuul-ci.org/docs/zuul/latest/config/pipeline.html) |
| Uber SubmitQueue | Speculation graph; a model predicts which builds pass; changes with disjoint build targets run independently. | Uber (iOS, Android, Go) | very high volume, build graph available | Needs a model and build graph. Before it, iOS main was green 52% of a week. | [EuroSys'19](https://www.masoud.io/docs/eurosys19.pdf) |
| Out-of-order landing | A change may land ahead of earlier ones once every speculation path with it passed. | Uber, since 2023 | big slow diffs block small ones | Needs results for all paths. Wait-to-land 74% better. | [Uber blog](https://www.uber.com/us/en/blog/bypassing-large-diffs-in-submitqueue/) |
| Duration-aware speculation | Predict build time; speculate only on the likeliest, fastest paths. | Uber 2025 | CI cost is a constraint | Model upkeep. 53% less CI resource, 37% better p95 wait. | [arXiv 2501.03440](https://arxiv.org/abs/2501.03440) |
| Mergify queue | Speculative checks, batches (fixed or dynamic min/max), scopes, barriers, serial/parallel/isolated modes, two-step CI, priority rules. | Mergify users | configurable per situation | Isolated mode admits semantic conflicts. User-owned repo support **unverified**. | [batches](https://docs.mergify.com/merge-queue/batches/), [scopes](https://docs.mergify.com/merge-queue/scopes/), [modes](https://docs.mergify.com/merge-queue/queue-modes/) |
| Aviator MergeQueue | Sequential or parallel mode, affected-target partitions, batch bisection, optimistic validation, skip-line. | Aviator users | partitions mostly disjoint | Skip-line resets parallel drafts. | [affected targets](https://docs.aviator.co/mergequeue/concepts/affected-targets), [parallel mode](https://docs.aviator.co/mergequeue/concepts/parallel-mode) |
| Graphite merge queue | Stack-aware queue; CI on a stack in parallel, then fast-forward. | Graphite users | stacked workflows | Incompatible with GitHub's native queue. | [docs](https://graphite.com/docs/graphite-merge-queue) |
| Trunk optimistic merging | A failed PR stays queued; if a later PR containing it passes, it merges anyway. | Trunk.io | flaky suites | A real break fixed by a later PR leaves a broken commit on main. | [Trunk changelog](https://docs.trunk.io/changelog/2024-03-29-optimistic-merging-and-pending-failure-depth) |
| Shopify Merge Queue v2 | Predictive branch, batch size 8, drop a PR after its 4th consecutive failure, audited emergency bypass. | Shopify (~400 commits/day in 2019) | our volume range | Tuned by hand. Closest real analogue to our rate. | [Shopify Engineering](https://shopify.engineering/successfully-merging-work-1000-developers) |
| Prow Tide | Batch-test PRs in a pool; any merge sends others back to retest; skip retest when results exist against the latest base. | Kubernetes | many PRs, shared CI | Retest storms when the pool churns. | [Tide docs](https://docs.prow.k8s.io/docs/components/core/tide/) |
| Chromium CQ / LUCI CV | Dry run (report only) and full run; Quick Run trades about 50% CPU for at most 5% false negatives. | Chromium | huge test matrix | Quick Run figures **unverified** (old doc revision). | [LUCI CV](https://pkg.go.dev/go.chromium.org/luci/cv) |
| Presubmit/postsubmit split (TAP) | Fast subset before submit; the rest after submit in batches; culprit finding repairs red. | Google | tests too slow for presubmit | Main can go red after submit, so it needs culprit finding and rollback. | [SWE at Google ch. 23](https://abseil.io/resources/swe-book/html/ch23.html), [Memon et al. 2017](https://research.google/pubs/taming-google-scale-continuous-testing/) |
| Hierarchical integration | Feature trees batch changes before central testing. | Jane Street (Iron) | many teams, coupled code | More branches to sync. Central build requests fell from hundreds a week to 30–40. | [Jane Street blog](https://blog.janestreet.com/making-never-break-the-build-scale/) |
| Trunk-based development + flags | Short-lived branches; unfinished work lands dark behind a flag or branch-by-abstraction. | widespread | many small changes | Flag debt; flags do not stop build or import breakage. | [trunkbaseddevelopment.com](https://trunkbaseddevelopment.com/), [Fowler: feature toggles](https://martinfowler.com/articles/feature-toggles.html) |
| Release trains / tiered push | Batch commits from trunk every few hours; roll out in tiers. | Meta; Chromium release calendar | deploy risk, not merge risk | About releases, not merges; little fit here. | [Meta engineering](https://engineering.fb.com/2017/08/31/web/rapid-release-at-massive-scale/) |

### 3.2 Batch size (how many PRs to test together)

| Finding | Numbers | Source |
| --- | --- | --- |
| Batch + bisect costs about O(E log N) builds for E bad changes in N, vs O(N). | one culprit adds about 2·log₂ n runs | [bors-ng](https://github.com/bors-ng/bors-ng), Najafi et al. below |
| Best batch size depends on culprit and flake rates. | Ericsson: best size 9 saved 72%; with 2.4× culprit rate, best size 4 saved 46%; flakes cut 9/72% to 4/41% | [Najafi, Rigby, Shang, FSE'19](https://users.encs.concordia.ca/~shang/pubs/Armin_FSE_2019.pdf) |
| A fixed batch of 4 is a safe floor. | Batch4 48%, BatchStop4 50% fewer runs across nine projects | [Beheshtian et al., TSE'21](https://dl.acm.org/doi/abs/10.1109/TSE.2021.3070269) |
| Adjust batch size from the last batch's outcome only. | matches complex dynamic methods; median 4.75% more builds saved than static | [Kamath, Adams, Hassan, EMSE'25](https://mcis.cs.queensu.ca/publications/2025/emse_divya_light.pdf) |
| Human-labelled rollups: risky PRs alone, safe ones together. | Rust starts with "1 iffy, 4 maybes, 5 always" | [Rust forge](https://forge.rust-lang.org/release/rollups.html) |

**Applied to us (inference, not from a source).** With per-PR failure probability *p* and batch size *b*, a batch
passes with probability (1−p)^b, so useful merges per CI cycle are about b·(1−p)^b. That peaks near b ≈ 1/p. At
p ≈ 16% it gives b ≈ 6 and about 2.2 merges per 14-minute cycle per batch in flight. Serving 26/h needs 2–3
batches in flight, or a lower *p*. Codex warns the formula assumes independent failures, and agent PRs are not
independent (shared models and prompts). So when the batched queue is built, start small (b = 2–4) and grow on
success. Cutting flakes and red-main fallout out of *p* is worth more than any batch tuning; the Ericsson data
says the same.

### 3.3 Stacking (building on an unmerged PR)

| Strategy | What it is | Who | Wins when | Costs | Source |
| --- | --- | --- | --- | --- | --- |
| Stacked diffs | Each commit is its own reviewable change; dependants proceed before the base merges. | Phabricator, Meta Sapling, ghstack (PyTorch), spr, Graphite | predecessor is stable; long review or merge wait | Restack churn when a lower change moves. | [ghstack](https://github.com/ezyang/ghstack), [spr](https://github.com/ejoffe/spr), [Sapling](https://sapling-scm.com/docs/introduction/) |
| Stack-aware queue | The queue tests and lands a whole stack. | Graphite | stacks are common | Vendor lock-in. | [Graphite docs](https://graphite.com/docs/graphite-merge-queue) |
| Branch by abstraction | Add a stable interface, migrate callers, remove the old path. | practitioner technique | a broad refactor has a compatible midpoint | Temporary complexity, forgotten cleanup. | [Fowler](https://martinfowler.com/bliki/BranchByAbstraction.html) (Codex) |
| Manager/worker fan-in | One agent merges many workers' branches into one PR. | Devin (MultiDevin) | isolated repetitive tasks | One big PR to review. | [Devin release notes](https://docs.devin.ai/release-notes/2024) |

### 3.4 Test selection (what to run)

| Strategy | Who | Wins when | Costs | Source |
| --- | --- | --- | --- | --- |
| Build-graph affected targets | Bazel, bazel-diff (Tinder), Nx, Turborepo; feeds Uber, Aviator, Mergify partitions | a dependency graph exists | Misses dynamic or config dependencies | [bazel-diff](https://github.com/Tinder/bazel-diff), [Nx](https://nx.dev/docs/features/ci-features/affected) |
| Predictive test selection | Meta: over 99.9% of faulty changes caught, test cost halved | large outcome history | Model upkeep; rare failures slip | [Machalica et al. 2019](https://arxiv.org/abs/1810.05286) |
| Transition prediction | Google: breakage detection 107 → 37 min; 85% recall at 25% budget | long postsubmit queue | Same | [ICST'25 summary](https://hackthology.com/speculative-testing-at-google-with-transition-prediction.html) |
| Confidence subsets | Launchable / CloudBees Smart Tests | long suites | Observation period first | [Launchable docs](https://help.launchableinc.com/features/predictive-test-selection/requesting-and-running-a-subset-of-tests/choosing-a-subset-optimization-target/) |
| Risk-first test order (full set kept) | Codex's adaptation of Launchable ranking | any suite | Little saving if ranking is poor | Codex survey |
| Hermetic caching and test sharding | Bazel remote cache and sharding | many agents re-test unchanged code | Wrong cache keys give false greens | [Bazel remote caching](https://bazel.build/remote/caching) (Codex) |
| RL test prioritization | RETECS (academic) | changing suites | Research-grade | [Spieker et al. 2017](https://arxiv.org/abs/1811.04122) |
| Per-agent random sampling | Anthropic C-compiler run: each agent runs a 1% or 10% sample, so many agents cover the suite | many parallel agents | One agent can miss a failure; never a landing verdict | [Anthropic engineering](https://www.anthropic.com/engineering/building-c-compiler) |

### 3.5 Conflicts and overlap (before and at merge)

| Strategy | Who | Wins when | Costs | Source |
| --- | --- | --- | --- | --- |
| Workspace awareness (Palantír) | research; users caught 27 of 39 indirect conflicts vs 0 | humans editing in parallel | Notifications only | [Sarma et al.](https://web.engr.oregonstate.edu/~sarmaa/wp-content/uploads/2020/08/05928359.pdf) |
| Speculative background merge (Crystal) | research (ESEC/FSE'11) | conflicts frequent and show as build/test failures | CI cost; pairwise growth | [ACM](https://dl.acm.org/doi/10.1145/2025113.2025139) |
| Concurrent-edit detection (ConE) | Microsoft: 234 repos; over 70% of 775 recommendations rated useful | many repos, same-file edits | Advisory only | [arXiv 2101.06542](https://arxiv.org/abs/2101.06542) |
| Conflict-minimizing scheduling (Cassandra) | research: avoids most conflicts in 4 projects | tasks can be reordered | Needs a touch-set prediction | [Kasi & Sarma 2013](https://www.semanticscholar.org/paper/Cassandra:-Proactive-conflict-minimization-through-Kasi-Sarma/61423b1a0920ede7d54595469b4d644e2a3a62bc) |
| Exclusive locks | Perforce `+l`; Unity smart locks; GitLab file locking | binary or unmergeable files | Serializes; stale locks | [Perforce](https://portal.perforce.com/s/article/3114), [Unity](https://unity.com/blog/engine-platform/unity-version-control-smart-locks) |
| Agent claims / intents | Anthropic lock files; AgentRoom; Claim Plane (feasibility only) | many agents | File claims miss semantic conflicts | [AgentRoom](https://arxiv.org/abs/2608.23740), [Claim Plane](https://arxiv.org/abs/2607.21909) |
| Large-change sharding (Rosie) | Google: split a big change by ownership, one global approver, regenerate on fresh trunk | a rename touches many owners | Many small PRs; cross-shard dependencies | [SWE at Google ch. 22](https://abseil.io/resources/swe-book/html/ch22.html) |
| Barriers | Mergify: serialize the queue around changes that touch everything | toolchain or global renames | Queue pauses | [Mergify scopes](https://docs.mergify.com/merge-queue/scopes/) |
| Recorded resolutions (rerere) | Git | the same conflict recurs through rebases | A stale resolution can be wrong now | [git rerere](https://git-scm.com/docs/git-rerere) (Codex) |
| Structured merge | Mergiraf (tree-sitter), Spork, IntelliMerge, SemanticMerge | textual conflicts in supported languages | Not semantic | [LWN](https://lwn.net/Articles/1042355/) |

**Agent evidence.** AgenticFlict (142k agent PRs): 27.7% had merge conflicts in simulation
([arXiv 2604.03551](https://arxiv.org/abs/2604.03551)). Xu et al. (33.6k PRs): cross-agent overlapping pairs
conflicted 41.7% of the time ([arXiv 2607.04697](https://arxiv.org/abs/2607.04697)). Worktrees and sandboxes
(Claude Code, Cursor 2.0, Codex cloud) isolate the edit but move the conflict to merge time. Cursor reports
removing a central integrator role that became a bottleneck and letting workers resolve their own conflicts
([Cursor blog](https://cursor.com/blog/scaling-agents), Codex).

### 3.6 Main red and flakes (what happens when it breaks)

| Strategy | Who | Numbers | Source |
| --- | --- | --- | --- |
| Revert first, sheriff, tree closure | Chromium sheriffs, Google Build Cop | "revert first and ask questions later" | [Chromium sheriffs](https://www.chromium.org/developers/tree-sheriffs/) |
| Automated culprit finding + auto-revert | Chromium Findit / LUCI Bisection | auto-reverts compile and consistent test failures | [LUCI bisection](https://pkg.go.dev/go.chromium.org/luci/bisection) |
| Safe auto-revert model | Google SafeRevert | 55.7% recall at 0.5% bad reverts | [ICST'24 summary](https://hackthology.com/saferevert-when-can-breaking-changes-be-automatically-reverted.html) |
| Flake-aware culprit finding | Google | about 40% of 13,600 breakages were flakes with no culprit | [ICST'23 summary](https://hackthology.com/flake-aware-culprit-finding.html) |
| Rerun + quarantine | Google | 1.5% of runs flaky; 16% of tests have some flakiness | [Google testing blog](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html) |
| Probabilistic flakiness score | Meta | per-test Bayesian P(fail on good code) | [Meta engineering](https://engineering.fb.com/2020/12/10/developer-tools/probabilistic-flakiness/) |
| Auto-detect, suppress, ticket | Slack: main stability 20% → 96% | | [Slack engineering](https://slack.engineering/handling-flaky-tests-at-scale-auto-detection-suppression/) |
| Smarter retries | GitHub: flaky builds 1 in 11 → under 1 in 200 | same host, time shift, other host | [GitHub blog](https://github.blog/2020-12-16-reducing-flaky-builds-by-18x/) |
| Risk-gated landing | Meta Diff Risk Score: block risky diffs in sensitive windows | 10,000+ diffs landed in a freeze | [Meta engineering](https://engineering.fb.com/2025/08/06/developer-tools/diff-risk-score-drs-ai-risk-aware-software-development-meta/) |
| Protect the main observer | Codex: ordinary merges must never cancel the only broad main signal; track unknown minutes | | [GitHub concurrency docs](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency) |

### 3.7 Review and agent dispatch

| Strategy | Who | Numbers or note | Source |
| --- | --- | --- | --- |
| Small changes, fast first response | Google | median change 24 lines; first feedback under 1 h for small changes | [Sadowski et al. ICSE-SEIP'18](https://sback.it/publications/icse2018seip.pdf) |
| Nudge overdue PRs | Microsoft Nudge | −60% resolution time, 8,500 PRs | [arXiv 2011.12468](https://arxiv.org/abs/2011.12468) |
| Approval dismissal on push | GitHub setting | a mechanical cause of repeated review rounds after rebases | [GitHub community](https://github.com/orgs/community/discussions/109549) |
| Delta re-review, carry finding ids | Codex proposal using `git range-diff` | partly exists here: the round-2 anti-spiral clause judges only the previous round's fix (`we:scripts/lib/review-core.mjs:1067`) | [git range-diff](https://git-scm.com/docs/git-range-diff) |
| Bounded WIP / backpressure | load-shedding practice | stop new builds when downstream cannot absorb them | [Google SRE: overload](https://sre.google/sre-book/handling-overload/) (Codex) |
| Repair-first priority with aging | Buildkite job priorities; our xkpbs7b | aging bounds starvation | [Buildkite](https://buildkite.com/docs/pipelines/configure/workflows/managing-priorities) (Codex) |
| Narrow fan-out with an oracle | Anthropic C compiler: re-split a shared failure with GCC as oracle | when agents pile onto one problem, change the split, not the agent count | [Anthropic engineering](https://www.anthropic.com/engineering/building-c-compiler) |

## 4. Two surveys compared (Opus vs Codex)

**Where they agree**

- GitHub's native merge queue is unavailable to a user-owned repo.
- Queueing, stacking, batching and speculation solve different problems and need separate controls.
- The decider should be a deterministic, versioned rule table. A learned or bandit policy is not justified for
  v1; if ever, only for knobs where every choice is already safe, with safety rules outside the reward.
- Fixed settings win over the decider; `auto` is the opt-in; every decision is logged with its signals.
- Shadow mode before live, and a decision log linked to outcomes.
- Rosie-style sharding is the answer to the bulk-rename pain.
- Flakes must be separated from real failures before batching or revert automation is trusted.
- Main observation is broken and must come first.

**Where they disagree**

| Topic | Opus | Codex | Resolution |
| --- | --- | --- | --- |
| Batch size | b ≈ 1/p, about 6 at p = 16%; 2–3 batches in flight | b = 1 by default; 2–4 only with a failure estimate under 2%; agent failures correlate | When the batched queue exists: start at 2–4, grow by one on success, halve on failure (Zuul). Codex's correlation point is folded in. |
| Cause of cancelled main runs | Found it: `we:.github/workflows/ci.yml:50-52` | Said the mechanism was not established and should be inspected first | Measured here; card xbdefjb. |
| When to build the batched queue | First draft: now, and un-gate it on main-red as well as saturation | Only after the local saturation trigger fires; "do not mistake 312 commits for proof the deferral has expired" | **Codex was right.** The skeptic pass refuted the Opus draft: the merged-tree statute already covers the correctness gap, so the remedy is to enforce it (xi8vgqq), not to amend the deferral. |
| Auto-revert | Top-3 item (revert first) | Not first; a tested revert only when culprit attribution is strong | Culprit finding first (card xmje9g6), revert through #3361's drain-owned path. |
| Top-5 picks | Flake score and codemod replay in the top 5 | Conflict-aware dispatch with WIP limits, and delta re-review in its top 5 | Delta review partly exists (anti-spiral clause); dispatch overlap gating exists (`we:scripts/conveyor/build-dispatch-policy.mjs`, card x5qhw83). Both stay runners-up. |
| Re-check rule | Re-check by risk: count merges since the CI base that touched the PR's files | Keep 30 minutes as a pin, and also check identity (base, head, workflow digests) | Both: risk-based staleness as the `auto` behaviour; identity checks belong in xi8vgqq. |

**Only Opus found:** the measured repo state (85 of 100 main runs cancelled, main red from 12:00Z, 5 of 23 PRs
overlapping); the statute deferral and the merged-tree statute as the binding constraints; Uber out-of-order
landing and duration-aware speculation; Shopify's batch of 8 and four-strike rule; Trunk's optimistic merging;
Jane Street's feature trees; the batch-size papers (Ericsson, Beheshtian, Kamath); flake-aware culprit finding and
SafeRevert; Slack and GitHub flake numbers; Meta's Diff Risk Score; ConE and Cassandra; the 2026 agent-PR conflict
studies; Microsoft Nudge.

**Only Codex found:** the "interaction failure" case (A and B each pass, fail together, so neither is a culprit;
keep the pair and record an edge); a green batch tip does not certify every intermediate commit on main;
integration certificates (base, ordered heads, tree, workflow and environment digests); release trains; git
rerere; hermetic caching and sharding; leased idempotent jobs; planner/worker separation and worker-owned
conflict repair (Cursor); bounded WIP; delta re-review; risk-first test ordering; and a list of 16 ways industry
analogies mislead for agents. The most useful: a cheap rebase for an agent is not a cheap overlap (CI, review and
queue time still cost); agents do not tire, so retries need budgets; many agents are not many independent
developers; stacking every overlapping PR confuses shared files with real dependencies.

## 5. The decider

### 5.1 What it is

One pure function in `we:scripts`, `decide(signals, policy) → { choice, source, ruleId, signals, alternatives }`,
called by each daemon at its own decision point with a fresh snapshot. It returns a choice and the reason. It is
never consulted for a field the operator fixed. It is a deterministic rule table, as
`#deterministic-core-thin-judgment` requires for a script-decidable choice. It writes every decision to the
policy-event journal card xcs4nce adds (`we:scripts/lib/delivery-policy.mjs`, `recordPolicyEvent`).

### 5.2 Decision points

| # | Decision point | Choices | Who asks today |
| --- | --- | --- | --- |
| D1 | Verify order for an agent push | local-first, ci-only, parallel | fix, ci-heal and build agent briefs (card xg2fljy) |
| D2 | Overlap with an open PR | queue, stack (depth N), hold at dispatch | `we:scripts/conveyor/reconcile-fix-dispatch.mjs`, `we:scripts/conveyor/build-dispatch-policy.mjs` (card xtzr35y) |
| D3 | Integration check | merge on own green when nothing relevant moved, otherwise re-check then merge | the drain, `we:scripts/merge-ai-prs.mjs` (card xi8vgqq) |
| D4 | Speculation depth and batch size | 1 to W in flight; b | only with the deferred batched-queue build (#2692, after #2740 fires) |
| D5 | Main-red response | warn, halt, halt and revert culprit | `we:scripts/conveyor/main-red-recovery.mjs`, #3361, card xca0u65 |
| D6 | Heavy-slot priority (never the cap) | fifo, repairs-first with r reserved | `we:scripts/readiness/heavy-admission.mjs` (card xkpbs7b); the cap stays with #3611 |
| D7 | Test scope for a PR | selected (affected), full | `we:scripts/verify-lane.mjs`, CI |
| D8 | Dispatch admission | how many new builds may start now | `we:scripts/conveyor/build-dispatch-policy.mjs` |
| D9 | Wide change handling | land normally, or barrier and codemod replay | card xxpai0d |

### 5.3 Signals

| Signal | Exists today? | Source |
| --- | --- | --- |
| Ready-queue depth and age | yes | drain labels, `we:scripts/conveyor/queue-store.mjs` |
| Land-serialization wait | yes | `we:scripts/readiness/conveyor-instrument.mjs` |
| Main red now; red minutes and rate over 24 h | partly | `we:scripts/conveyor/main-red-recovery.mjs`; rate is new |
| Main CI coverage (completed / pushed) and unknown minutes | **no** (15 of 100 completed today) | card xbdefjb |
| PR CI duration p50/p90; Actions queue wait | queue wait yes | `we:scripts/conveyor/ci-queue-watch.mjs`; duration is new |
| PR failure rate *p*, rolling | no | card xv18rog |
| Flake rate per test and overall | **no** | card xb7necp |
| File-overlap rate; overlap for a given PR | yes, per PR | `we:scripts/readiness/overlap-chain.mjs`, `we:scripts/conveyor/land-overlap-yield.mjs` |
| PR size and risk class | partly | care level in `we:scripts/lib/review-core.mjs`; `review:human` class |
| Heavy-slot use and waiters | yes | `we:scripts/readiness/heavy-admission.mjs`, `we:scripts/readiness/heavy-queue-projection.mjs` |
| Merges since a PR's CI base that touched its files | no | card xv18rog |

Each signal carries its sample size and age. A missing source is unknown, never zero, and an unknown signal makes
the point fall back to the platform default.

### 5.4 Selection rules (v1, deterministic)

First match wins. Each rule has an id and a minimum hold time so it does not flap. Thresholds are starting values
to tune in shadow mode, not findings. v1 covers only points with a live mechanism; D4 rules ship with the
batched-queue build, if and when it is approved.

| Point | Rule | Choice |
| --- | --- | --- |
| D1 | job is fix, conflict-repair or ci-heal | parallel |
| D1 | job is an initial build, or main is red | local-first |
| D1 | local verify p90 > 2 × PR CI p50 for this scope | ci-only |
| D2 | either PR is in the statute/gate class | queue |
| D2 | predecessor is in `review:changes` or was pushed in the last 15 min | queue |
| D2 | predecessor is accepted and green, stack depth < cap | stack |
| D2 | a new build would touch a file 2 open PRs already touch | hold at dispatch |
| D3 | no merge since the PR's CI base touched its files, and the base is under the age cap | merge on own green |
| D3 | otherwise | re-check then merge |
| D5 | main red and a single culprit isolated | halt and revert culprit (via #3361) |
| D5 | otherwise main red | halt (never looser than the platform default) |
| D6 | repair jobs waiting | repairs-first, r = min(waiting repairs, slots − 1) |
| D7 | PR touches only docs, backlog or one package | selected |
| D7 | PR touches CI, config, gate or shared lib | full |
| D8 | main red, ready-queue age p50 > 60 min, or CI queue wait high | admit repairs only |
| D9 | PR declares a codemod | barrier and replay |

### 5.5 Precedence: fixed settings always win

Per field, highest first:

1. **Invariants** — never decider fields and never relaxed by anything below: CI parity with main, backlog ids
   numbered before publish, the statute/gate `review:human` class, never merging a red candidate, the sole main
   writer.
2. **Per-item operator override** (a label or card field). It never relaxes an invariant.
3. **Fixed setting.** Any value other than `auto` is final. The decider is not called for that field.
4. **Decider**, only for fields set to `auto`, inside the bounds the sibling fields give (`stackMaxDepth`,
   `reservedForRepairs`). **Safety-class fields** (`mergeGate.onMainRed`, `mergeGate.recheckWhenMainMoved`) may
   take `auto` only as tighten-only: the decider picks values at least as strict as the platform default.
   `dispatchGate.overlapOverride` and `prCi.*` take no `auto`.
5. **Platform default** from `we:config/platformDefaults.ts`, when a signal is unknown.

An impossible pin is reported as `blocked: fixed-policy-conflict`, never replaced by an automatic choice.
Decider-governed values are read only from tracked, committed settings; the delivery-policy loader and the
existing `we:scripts/drain-overlap-yield-config.json` (`#drain-overlap-yield-landing-order`) must share one home
before D2 goes live. `#config-extends-platform-default` is cited for the shape of the setting only, not for its
"most-permissive default" clause, which runs the wrong way for safety knobs.

### 5.6 Explainable and logged

- Every call writes one journal line: `{at, point, subject, choice, source: invariant|override|setting|decider|default,
  ruleId, signals, alternatives, heldSince}`.
- A `--explain` CLI prints each point's current choice and why.
- **Shadow mode first.** An `auto` field logs its choice next to the applied default until the operator flips it
  live. A weekly digest shows where they differed and what happened.

### 5.7 Today's settings mapped onto the decider

| Setting (card) | Point | Fixed values | What `auto` would do |
| --- | --- | --- | --- |
| `verifyMode` (xg2fljy) | D1 | local-first, ci-only, parallel per job kind | rules D1 |
| `dispatchGate.overlapStrategy`, `stackMaxDepth` (xtzr35y) | D2 | queue, stack | stack only onto a stable predecessor, cap from setting |
| `dispatchGate.overlapOverride` (xcs4nce) | D2 | off, logged, free | a safety knob; no `auto` |
| `prCi.mainStateParity` (xcs4nce) | invariant | on, off | no `auto` |
| `mergeGate.recheckWhenMainMoved`, `recheckMaxAgeMin` (xi8vgqq) | D3 | always, if-older-than-N-min, off | tighten-only: skip the re-check only when no merge since the CI base touched the PR's files |
| `mergeGate.onMainRed` (xca0u65) | D5 | halt, warn, off | tighten-only: halt, or halt and revert a culprit |
| `heavyQueue.priority`, `reservedForRepairs` (xkpbs7b) | D6 | fifo, repairs-first, r | r follows waiting repairs, capped; the slot cap is #3611's |
| `drain.onStepRefusal` (xq4p21a) | none | alert, log | not a strategy; no `auto` |
| backlog ids before publish (#3732, PR #3809) | invariant | — | no `auto` |

### 5.8 Skeptic and screen results on the decision card

- **Fork 1 (authority via an opt-in `auto` value):** skeptic SURVIVES-WITH-AMENDMENT (invariants on top of the
  precedence order, tighten-only safety fields, one tracked settings home, heavy-slot cap left to #3611); screen
  clear.
- **Rule table vs bandit:** skeptic found it settled by `#deterministic-core-thin-judgment`, and the screen
  flagged the tuning mechanics as build detail. Dissolved into "supported by default", with a revisit trigger.
- **A correctness un-gate for the batched queue:** skeptic REFUTED (the merged-tree statute already covers it;
  enforce it through xi8vgqq); screen flagged it as prioritization. Dropped as a fork.

## 6. Top five to adopt next

1. **Stop cancelling main CI, and measure main coverage (card xbdefjb).** One setting change makes cancellation
   apply to PR runs only. GitHub then keeps one running and one pending main run, so each finished run brackets a
   known range. Today 85 of 100 runs were thrown away. Cheapest fix, and every main-red strategy needs it. Both
   surveys put this first.
2. **Culprit finding for a red main, feeding the dormant auto-revert (card xmje9g6, with #3361).** Revert-first
   is Chromium and Google practice. Main was red for about six hours today. Find the culprit first, rule out a
   flake with one rerun, revert only through the drain.
3. **Test against the main you land on (card xi8vgqq, already filed; the decider's D3).** This is the
   not-rocket-science rule our own statute already states. At 26 merges an hour a PR's own green is about 6
   merges old. A risk-based re-check (only when a merge since the CI base touched the PR's files) keeps most PRs
   fast. If re-checks queue up, tripwire #2740 surfaces the batched queue, which is the bors/Zuul/Shopify answer.
4. **Wide mechanical changes as a barrier with codemod replay (card xxpai0d).** Rosie and Mergify barriers.
   Fixes "a bulk rename put open PRs into conflict" without a fix-agent round per PR.
5. **A per-test flake score with time-boxed quarantine (card xb7necp).** Meta, Google, Slack, Uber. Flakes shrink
   the best batch size and create fake culprits; the decider needs this signal for D3, D5 and D7.

Runners-up: the delivery-signals snapshot (card xv18rog, needed by the decider and useful alone); affected-test
selection for PR CI; conflict-minimizing dispatch order (Cassandra) on top of the existing overlap gate; delta
re-review beyond the existing anti-spiral clause; arming #3361 now that it hurts.

## 7. Cards filed

| Card | Kind | Title |
| --- | --- | --- |
| x1hhjnb | decision (prepared) | A delivery-strategy decider picks per decision point from live signals, and fixed settings always win |
| xbdefjb | story, size 2 | Main CI finishes every run it starts; main-CI coverage signal |
| xmje9g6 | story, size 5, blocked by xbdefjb | Culprit finding for a red main |
| xxpai0d | story, size 8 | Wide mechanical changes land as a barrier; open PRs replay the codemod |
| xb7necp | story, size 8 | Per-test flake score and a time-boxed quarantine |
| xv18rog | story, size 5 | Delivery signals snapshot |

All under epic #3383, filed with `--queue=false` so none dispatches before the operator looks.

## 8. Claims not verified

- Whether Mergify, Aviator, Graphite or Trunk work on a user-owned repo.
- Aviator's optimistic-validation depth cap of 3 (competitor page only).
- Chromium Quick Run figures (old doc revision; the live page returned 503).
- The Beheshtian et al. correlation figure (search snippet only); the 46–50% reductions were read in the thesis.
- Spotify quarantine figures (aggregator only); vendor outcome figures for Graphite and Mergify.
- Sapling land-time rebase and git-branchless details: names only.
- Re-running a codemod on open PRs instead of rebasing: no published source; card xxpai0d is our design built on
  Rosie's "regenerate on fresh trunk".
- Sources marked "Codex" were not re-fetched by the Opus survey.
- Whether today's red main came from stale-green integration or from a flaky soak shard.
- The thresholds in 5.4 are starting values, not measured optima.
