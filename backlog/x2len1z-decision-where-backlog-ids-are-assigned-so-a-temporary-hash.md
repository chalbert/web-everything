---
kind: decision
parent: "2288"
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/lane-drain.mjs", "we:scripts/backlog.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/pr-land.mjs"]
dateOpened: "2026-09-19"
tags: []
---

# Decision: where backlog ids are assigned so a temporary hash id is structurally unable to reach main

Operator requirement 2026-09-19: a backlog file with a temporary hash id must be STRUCTURALLY UNABLE to reach main — not caught after the fact, not repaired by a follow-up PR. Today's #2319 rule (we:scripts/check-standards-rules.mjs strandedHashesOnMain) is a post-land detector because numbering is deferred to land (#2288, we:scripts/merge-ai-prs.mjs numberPendingHashes tail); any land route or failed tail strands a hash and turns main red — twice on 2026-09-19 (xoywo06 via PR #2335, then 9 cards via PRs #2032/#2318/#2210/#2338, all merged by the drain). Decide where numbering belongs and what makes it unskippable.

## The requirement

**A BACKLOG FILE WITH A TEMPORARY HASH ID MUST BE STRUCTURALLY UNABLE TO REACH MAIN — not caught after the fact, not repaired by a follow-up PR.**

This decision is about **PREVENTION ONLY**. Repair already exists and is not a missing capability or a fork.
The #2319 error, “is on main with a NON-NUMERIC leading id”, describes an already-published failure.
`strandedHashesOnMain` in `we:scripts/check-standards-rules.mjs` inspects `origin/main`, with a 180-second
warning grace window. It cannot prevent a PR's new hash from landing: #2288 deliberately permits that hash
until the land-time numbering step. Even a successful trailing repair violates the acceptance property.
Here “reach main” includes commits made reachable through merge history, not merely the final tip's filenames.

## Evidence

**VERIFIED — measured live 2026-09-19 (`git log --diff-filter=A` on origin/main @ b4331d956 plus `gh pr view` merge-trace comments/labels for each PR).**
After the xoywo06 incident repaired through #2335, nine more cards stranded on main:

| Hash | Local repair NNN | PR | Merged (ET) | Route |
| --- | --- | --- | --- | --- |
| x93vxdr | #3708 | #2318 | 18:08 | Drain |
| x997mz7 | #3709 | #2318 | 18:08 | Drain |
| xb93l5b | #3710 | #2032 | 17:24 | Drain |
| xfxt77w | #3711 | #2032 | 17:24 | Drain |
| xhr0lj8 | #3712 | #2338 | 18:39 | Drain |
| xj9554r | #3713 | #2210 | 18:11 | Drain |
| xt20eug | #3714 | #2210 | 18:11 | Drain |
| xu0gnzj | #3715 | #2210 | 18:11 | Drain |
| xyp1wsl | #3716 | #2032 | 17:24 | Drain |

**Later update (2026-09-19, VERIFIED):** the same nine were subsequently numbered on main by a drain
commit (`11bc4e922`, "drain: JIT-number x93vxdr→#3708 … xyp1wsl→#3716 at land (#2288)") — to exactly the
numbers above — when PR #2058 landed. The hashes sat on main until an unrelated later land's tail happened to
sweep them: a late, accidental repair, which confirms the tail is not a guarantee.

All four PRs have “📌 Merge trace … merged by drain (session unknown)” and labels `ready-to-merge` +
`review:accepted`; none received a following `drain: JIT-number …` commit. The earlier UI/bare-merge
explanation is refuted. **UNVERIFIED:** the exact failing step; drain stderr was not recorded.

**VERIFIED — local source reads.** In `we:scripts/merge-ai-prs.mjs`, `mergePr` (~4540) publishes first;
`numberPendingHashes` (~4660–4675) is a best-effort tail after pull / `resyncDetachedCwdForLand`, gated by
`landedLocal`, with failures reported as warnings. The already-merged concurrent-lander branch skips owning
that tail; a later pass merging nothing does not re-enter it. `finalizeLand` in `we:scripts/lane-drain.mjs`
(~850–882) likewise numbers after the remote merge. **INFERRED:** these are sufficient failure windows to
explain how a drain merge can strand hashes; they do not identify which window caused these incidents.
`WE_SKIP_HAND_NUMBERED_GATE` in `we:scripts/pr-land.mjs` (~1211) exempts the collision-heal self-check from
#2548, not numbering; `--no-require-verified` bypasses only the lane-verified marker requirement.

**VERIFIED — filing and repair.** `we:scripts/operations/file-item.mjs` calls `planScaffold` from
`we:scripts/operations/scaffold.mjs`, whose default allocator is `nextHash` (~111). `--queue=false` only
suppresses conveyor queueing; it creates the same hash-born card as queued filing. The operator observed
xhr0lj8 filed this way and landed within the hour. This is not a separate numbering bypass: both filing
routes depend on land-time numbering, including cards carried incidentally by another PR.
`we:scripts/backlog.mjs number-stranded [--dry-run]` is the existing working repair (#2319/#2288): it
calls `numberPendingHashes` for every tracked hash card, rewrites references, and normally commits the result.
It refuses a lane locus; untracked scaffolds are excluded. Its use for these nine and xoywo06 is supplied
live evidence; this pass verified the implementation without executing the mutating command.

**VERIFIED — GitHub API measurements (`gh api repos/chalbert/web-everything`, `.../branches/main/protection`, `.../rulesets`, 2026-09-19).**
`chalbert/web-everything` is public, owner.type=User, organization=null; rulesets=[].
Main protection requires `test`, `smoke`; strict=false; required approvals=0; enforce_admins=false;
no push restrictions. Merge-commit, squash and rebase are
allowed; auto-merge is off. These settings do not establish a universal, non-bypassable admission boundary.
**VERIFIED — workflows.** `we:.github/workflows/ci.yml` runs on PRs and main pushes: `test` aggregates
Vitest coverage, runs `check:standards` and the integration suite; `smoke` builds docs and runs interactions.
PR checkout uses the PR merge ref: the proposed integrated tree, not a future main after numbering.
The #2319 rule separately reads `origin/main`, so a PR-time green does not prove its new hash is absent.
`we:.github/workflows/review-gate.yml` reads checker code from main and labels from the event; it checks
review holds, not filenames, and `review-gate` is not in the measured required-check list.

**VERIFIED — lineage and collision tools.** #2288 introduced hashes to remove parallel-lane NNN races;
#2319 added repair plus detection. `we:scripts/backlog.mjs yield <NNN-slug>` reallocates a local-only
collision and normally refuses tracked files, but the implementation has a `--force` escape. It is not
an atomic cross-lane reservation. `we:scripts/lib/nnn-collision-heal.mjs` already heals new-item collisions
before checks, preserving base-owned files/references; history includes `be71beb32` (#3075 → #2305) and
`7f6ba8ed4` (#2383 → #2306). #2548's notes in `we:scripts/check-standards-rules.mjs` recall #558:
hand-picked numbers collided and a heal blanked files. The gate now rejects an NNN absent from origin/main.
`withNumberingLock` in `we:scripts/readiness/drain-lock.mjs` shares a HOME-level mutex across local clones,
but numbering callers may proceed unlocked after contention. `numberPendingHashes` in
`we:scripts/lane-drain.mjs` supplies reference rewrites and durable `bornAs` provenance; these are reusable,
not a distributed reservation service. The repair wrapper itself does not acquire the mutex.

## Forks

Proposed defaults only; no ratification or full prepare pass is claimed. Option behavior below is
**INFERRED / PROPOSED**, not an implemented guarantee; source findings are marked VERIFIED.

### Fork 1 — Where numbering happens

- (a) At file time: reserve NNNs atomically in one server-side registry before writing; no temporary IDs, but gaps and an online filing dependency. Local max+1 is rejected.
- (b) At PR open and for later additions: centrally reserve and rewrite before checks; cheap hash drafts remain, but reservations need provenance and abandonment rules.
- **(c · DEFAULT) On an integration/staging branch, before promotion to main:** PRs target integration; one serialized writer runs `we:scripts/backlog.mjs number-stranded`, then `npm run check:standards` and the required full checks on the numbered merged result. Only a green, fully-numbered candidate can advance main.
- (d) At land without a persistent branch: build, number and check an isolated merged candidate before publishing; needs the same exclusive writer, candidate-bound checks and retry semantics. Native queue is compared in Fork 2.

The operator asks: “couldn't we have an intermediate branch where PRs are merged and ids resolved?”
Yes, subject to enforceable exclusive promotion and the history constraint below. Its three strengths:

1. The acceptance property becomes STRUCTURAL: main accepts only an already-numbered, green promotion.
2. Numbering is a SINGLE-WRITER operation on one branch. This dissolves the parallel-lane allocation race that #2288's hashes exist to avoid — its strongest argument; lanes never compete for NNNs.
3. The gate runs on the EXACT combined, numbered result, catching cross-PR interactions that independent PR checks against an earlier base cannot establish. Both supplied incidents were interaction-shaped: individually acceptable PRs, then red main; the precise failing drain step remains UNVERIFIED.

History constraint: a normal merge or fast-forward of raw integration after a rename commit would expose
its earlier hash-bearing commits. That satisfies a tip-only rule, NOT this card's stronger reachability
rule. Build a sanitized promotion commit/tree atop current main (squash the staged changes), check it, and
fast-forward main to that checked commit; alternatively rewrite and validate all newly reachable history
before merge/fast-forward. Compare-and-swap the expected main base and integration tip; any movement
invalidates approval. The raw staging history cannot be a parent of the promoted commit. Existing hashes
already in main's history cannot be undone by a repair PR; prevention applies to newly reachable history.

### Fork 2 — Which admission mechanism wins?

- **(a · DEFAULT) Bespoke integration branch + exclusive green promotion:** selects Fork 1(c), serializing merge → numbering → full checks → promotion. Require a hash-free candidate and enforce every main-write boundary, including admin/direct-push routes. Pays for a second landing stage to obtain mutation support and collision-free numbering.
- (b) GitHub native merge queue: prospective merged-state checks without a bespoke branch; preferred ONLY if available AND numbering is no longer a mutation. Neither condition holds on current evidence.
- (c) Cheaper shift-left REQUIRED PR check: reject any PR adding `we:backlog/<hash>-*.md`, or more strongly any candidate branch tree carrying a hash-id file. No new branch; blocks the same filename failure, provided numbering and collision safety are solved BEFORE merge.
- (d) Post-land repair — status quo, rejected as prevention: the repair works, but the forbidden file has already reached main.

**INFERRED from [GitHub's merge-queue documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue), read this pass; not tested by enabling it:** availability requires an organization-owned public repository, or an organization-owned private repository on Enterprise Cloud. This public USER-owned repo very likely needs an organization transfer first. A queue tests the latest base plus preceding entries on GitHub-owned temporary merge commits, then advances main on success. The docs support merge/rebase/squash methods, not an unconditional fast-forward promise. A `merge_group` workflow trigger is required. Checks have no documented supported way to mutate the queued commit with numbering and push that replacement back into the queue; numbering must precede enqueue or use a separate writer. Failed entries are removed and later candidates rebuilt. These availability and mutation gaps rule it out as today's default.

Shift-left forces numbering on each PR branch, reopening the parallel-lane collision #2288 solved.
It works only if Fork 3's earlier-numbering mechanism suffices: `yield` and the heal pre-check resolve
observed collisions but do not reserve numbers against concurrent stale lanes. A required uniqueness
check must validate the latest combined candidate with serialized admission, or allocation needs durable
atomic reservations. Independent green checks alone do not close the race. Added-path checking also
needs rename coverage and a clean-base assertion; candidate-tree checking is clearer. Both need Fork 1's
history policy and trusted, candidate-bound checks. Neither today's admin exemption nor an optional check
makes either approach structurally unskippable.

Recommendation after weighing all three: integration earns its extra machinery by allowing the necessary
mutation at a single writer and checking cross-PR interactions before main moves. Prefer shift-left if a
proven earlier allocator/serialized admission already closes collisions and its lower migration cost wins.
Prefer native queue if organization eligibility is established AND IDs become mutation-free at queue time.
If exclusive promotion, clean history or red-integration recovery cannot be enforced, integration is not
ready to ship; its name alone is no guarantee. Closing bypasses explicitly changes the convention-only
rung/human direct-write exemption in `we:docs/agent/platform-decisions.md#pr-flow-rollout-mechanism`;
ratify that change and verify available enforcement controls before claiming structural prevention.

Integration migration costs — **VERIFIED source reads**, with **INFERRED required adaptations**:

| Call site | Observed assumption and migration cost |
| --- | --- |
| `we:scripts/pr-land.mjs:132` | `--base` defaults to main. Retarget all ordinary PRs, including already-open ones, to integration. |
| `we:scripts/verify-lane.mjs:194`; `we:scripts/readiness/test-selection.mjs:253` | Default gate delegates to main-relative diff selection; change the comparison base. `we:scripts/verify-lane.mjs:207` also tests marker ancestry against origin/main. |
| `we:scripts/merge-ai-prs.mjs:3087`; `we:scripts/merge-ai-prs.mjs:3548` | Drain's `--label=ready-to-merge` listing defaults to ANY base, not main; explicitly scope integration. Rebuilds DO hard-code origin/main at `we:scripts/merge-ai-prs.mjs:3758`; retarget these and separate staging merges from promotion/tail work. |
| `we:scripts/operations/operator-queue.mjs:84`; `we:scripts/operations/operator-queue.mjs:123` | Reads mergeability against each PR's actual base; no hard-coded main filter, and no requested base field. Distinguish ready-for-integration from ready-for-main; a mergeable staging PR is not a promotable tip. |
| `we:scripts/gen-decision-docket.mjs:36`; `we:scripts/gen-decision-docket.mjs:84` | Documents `--ref=origin/main` as landed truth; ref is configurable, not a hard-coded default. Ranking separately assumes main freshness. Decide whether staged cards appear and align ranking with reads; retain main as the promoted view. |
| `we:backlog/3443-graduate-origin-lane-mechanical-dispatcher-to-main-in-small.md:29`; `we:backlog/3443-graduate-origin-lane-mechanical-dispatcher-to-main-in-small.md:31` | Graduation means small reviewed PR increments reaching main through the normal pipeline. Amend for PR-to-integration then promotion; staging alone must not count as graduation. |

Two-step latency is real: merged into integration is not visibly landed on main until numbering, full
validation and promotion complete. Main currently requires `test`,`smoke`; integration needs its own
protection/check policy, and main needs exclusive promotion enforcement. Update workflow branch triggers
as well as protections; staging must permit hash drafts while promotion rejects them. Checks must run
on the final numbered result, not merely the pre-numbering PR merge ref.

Red-integration recovery is part of option (a), not deferred housekeeping. WHO fixes it, and does the
owner REVERT the bad PR or RESET integration to main? Proposed ownership: the promotion operator freezes
intake/promotion and owns recovery; the offending PR author supplies the fix, with a named fallback when
absent. Ratification must choose the recovery policy. Revert preserves shared history but stacked PRs
lose a dependency: hold them, adapt/rebuild and recheck, or restore the dependency before admitting them.
Reset discards all unpromoted integration commits, including good work: record/replay survivors and
rebuild every affected in-flight stack onto the new base; invalidate old checks and ready labels.
Neither policy may silently reuse numbers already exposed on staging; retain allocation mappings across
retries/reverts/resets. Main stays at its last green promotion while recovery runs.

### Fork 3 — What prevents allocation collisions?

- **(a · DEFAULT) One serialized integration numbering authority:** all lanes retain hashes; only the staging writer allocates against the latest numbered state, with fail-closed exclusivity, durable mappings and retry/crash recovery. No competing pre-merge NNN claims.
- (b) If choosing earlier numbering: durable atomic reservations across every lane, bound to immutable item keys; retries reuse the binding and abandoned numbers stay reserved. CI validates provenance and uniqueness.
- (c) Disjoint lane ranges: still requires atomic durable range grants and ownership across lane reuse; burns numbers.
- (d) Yield/heal or a HOME-local lock alone: insufficient across independent writers; today's unlocked fallback is not exclusivity. May support shift-left only with latest-candidate uniqueness checks and serialized admission, not as an allocation guarantee itself.

Reuse `bornAs`, reference rewriting and pre-check healing for legacy collisions; provenance alone is not
trusted reservation proof. Replace #2548's “already on origin/main” rule with evidence appropriate to the
selected authority. Exercise simultaneous lanes, retries, crashes and stale candidates.

Repair-PR tension — the existing repair PR cannot pass today's origin/main-relative gates before landing:
#2319 sees the stranded originals; #2548 rejects its new NNNs. Every option needs a narrow bootstrap
transition validating the resulting candidate and exact hash→NNN mapping, never an unrelated-addition
exemption. Integration removes routine repair PRs: numbering happens on staging before promotion; legacy
repair can ride that validated promotion. Shift-left still needs a numbered repair PR plus that narrow
transition. Native queue neither numbers nor bypasses these rules: repair/number the PR before enqueue
and validate the same transition on the queue candidate. Already-published history is not repaired away.

### Fork 4 — Scope and prerequisite slice

- **(a · DEFAULT) Every hash-id backlog file, regardless of kind or carrier:** stories, decisions, epics; queued/unqueued filing; drain-created cards; incidental cards in unrelated PRs. One filename invariant.
- (b) Only selected routes/items — rejected: the nine-card incident demonstrates incidental cards escape route-specific coverage.

**VERIFIED:** `number-stranded` is a subcommand of `we:scripts/backlog.mjs`, not a declared operation in
`we:scripts/operations/run.mjs`. Repair already exists; do not file another repair-capability story.
**PREREQUISITE SLICE:** expose numbering as a small explicit declared operation callable by a transport,
with reads/write effects, allocation authority, idempotency, locus rules and refusal outcomes. The
integration option's serialized step needs this SAME prerequisite: the existing CLI refuses lane loci
and does not acquire the mutex, so merely invoking it is not a transport contract. Preserve the working
repair verb; adapt its reusable core for pre-publication use. An earlier-numbering choice wires the same
slice to PR-open/later additions, with reservations as needed. Required checks verify; they never mutate.

## Done when

1. **Executable** — ratification records selected forks in `we:docs/agent/platform-decisions.md`, links this card via `codifiedIn`, and files a blocked-then-unblocked build story. `npm run check:standards` validates those artifacts. Name a runnable regression: a fixture PR adding a hash cannot publish to main (red before implementation, green after), with main unchanged on refusal.
2. Cover every main-write route, merge method, late addition and hash-bearing ancestor; prove candidate-bound checks, serialized promotion and admin/direct-push enforcement against measured configuration. Include two individually green PRs whose combined result fails; main must remain green.
3. Specify allocation ownership, retry/crash behavior, reference preservation and the narrow legacy repair transition. Integration additionally names the recovery owner, revert/reset policy, stacked-PR handling and retained numbering mappings; executable collision, repair and recovery fixtures are required.
4. Reconcile #2288/#2319/#2548, #3443 and the writer-model statute; assign the declared-operation prerequisite and migration call sites. No post-land repair step may serve as prevention.
