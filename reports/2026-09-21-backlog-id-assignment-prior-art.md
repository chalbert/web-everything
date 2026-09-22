# Prior-art survey: where backlog ids are assigned so a temporary hash id cannot reach main

Decision item: `we:backlog/3732-decision-where-backlog-ids-are-assigned-so-a-temporary-hash.md`
Survey date: 2026-09-21 (America/New_York). Read-only pass; only this file was written.

Tags: **[V]** = read in a primary doc or source this pass (URL in Sources). **[I]** = inferred, or read only as a search-result summary or a third-party post. Nothing here was tested by enabling a setting on the real repo.

GitHub docs were read as raw markdown from the `github/docs` repository (the source of docs.github.com), including its shared "reusable" text blocks, so gating statements such as "which plans" are exact, not paraphrased.

## Summary

- **[V] Native merge queue is NOT available to this repo as it stands.** GitHub's own gating text: "available in any public repository owned by an organization, or in private repositories owned by organizations using GitHub Enterprise Cloud." A public user-owned repo does not qualify. A transfer to any (free) organization would make it eligible. So the queue is ruled out by ownership, not by design.
- **[V] A queue cannot number anything.** The queue builds a GitHub-owned temporary `gh-readonly-queue/*` branch and advances the base to it. A 2023 changelog says commits pushed to those branches "were ignored and not merged" (and the confusion was fixed). No documented hook lets a `merge_group` check rewrite the candidate. The item's claim holds. But this only rules the queue out if numbering stays a mutation at queue time (see Fork 2).
- **[V] Push rulesets ("Restrict file paths") do not exist for this repo, whoever owns it.** They are documented for "private or internal" repositories only. Branch/tag rulesets (restrict updates, required status checks, require PR, allowed merge methods) DO work on public Free repos. "Restrict who can push" (branch protection) is org-only. A hash-filename gate therefore has to be a required status check, not a platform path rule.
- **[V] Prior art splits into two camps, and neither is "number after merge".** Camp 1 allocates early from an atomic counter: Gerrit (a git ref under `refs/sequences/*` advanced by ordinary ref updates), Phabricator and GitHub numbers, Rust RFC (PR number, renamed once at PR open), KEP (issue number). Camp 2 never assigns sequence numbers: Changesets (random ids), Alembic (random hex), Rails (timestamps), log4brains (date + slug). PEP is the human-serialized variant. Nothing mature renumbers as a best-effort tail after merge.
- **[V] Every gating system surveyed (bors, homu, Zuul, Tide, Mergify, Chromium CV) uses an ephemeral candidate that is tested and then advanced or discarded.** None promotes main from a long-lived accumulating staging branch. The item's default (long-lived integration branch with revert-or-reset recovery) is a heavier shape than any of them. [I] Linux `linux-next` is the nearest long-lived integration tree, but per kernel docs it is an integration-testing preview that subsystem trees are pulled into; mainline is not promoted from it.
- **Key analytic finding: two invariants are hiding inside one card.** (A) "No hash-named file in the candidate tree" is per-PR and compositional (a clean main plus PRs that each add no hash file stays clean), so a required check on the candidate tree closes it with no serialization and no staging branch. (B) "NNNs are unique" is not compositional (two PRs can each pick 3900 and merge with no textual conflict), so it needs a serial allocator, an atomic counter, or serialized admission. The item's Forks 1 and 2 blur A and B.
- **[V] A ref-based compare-and-swap allocator is a proven design and is missing from the item's options.** Gerrit's `RepoSequence` keeps the counter as a blob under `refs/sequences/*`. The git push protocol carries `old-id` per ref update and the server rejects the update if the ref moved (a create uses a zero old-id, so it fails if the ref exists). It needs only the write access lanes already have.
- **[V] Ids-as-GitHub-numbers (Rust/KEP style) collides with this repo's history.** Measured today: the repo's GitHub number counter is at 2419, while the backlog already holds ids up to 3836. Numbers 1..2419 are already used as backlog ids. Adoption needs a prefix or a floor jump.
- **[V] The strict + squash-only + required-check + `enforce_admins` recipe works on a user-owned public repo with no staging branch.** Squash makes PR-branch history unreachable from main. `enforce_admins=true` ("Do not allow bypassing") applies the required checks to admins, including the `--fallback-git` route the repo's own `we:scripts/pr-land.mjs` uses (a `git merge --no-ff` then push to main). Costs: CI re-runs per merge (strict), and an owner who can still switch protection off in settings.
- **Net bearing on the item's default:** prior art supports the goals (serialize numbering, test the combined result). It does not support a long-lived bespoke integration branch as the way to get there, and it shows at least two cheaper structural routes. The strongest argument against the default: its enforcement burden (exclusive write to main) is identical to the alternatives', so the branch buys only allocation serialization, which a counter ref provides more cheaply.

## Family 1: merge / gating systems that test the combined result

| System | Mechanism | WHERE id/sequence is allocated | WHAT enforces it; bypassable? | Transferable here? |
|---|---|---|---|---|
| **bors-ng** [V README] | `r+` queues PRs. Bors builds a merge commit (base + batch) and pushes it to a `staging` branch. If CI passes, main is fast-forwarded to it "bit-for-bit". Failure bisects the batch. `try` uses a separate `trying` branch. Options include `use_squash_merge` and a templated `commit_title`. | None. It is a gate, not an allocator. | The bot is the only writer to main; the README does not detail branch protection [I]. Anyone with equal write access can still bypass. Docs say the public instance is being phased out in favour of GitHub's native queue. | **Shape yes, tool no.** The staging branch is per-batch and disposable. The idea (tested candidate = what main advances to) equals the item's "checked promotion", but it does not accumulate. |
| **homu** (Rust) [V README] | Comment-driven bot. Tests the PR "just before the merge" rather than only on receipt. Needs a collaborator account with write access. | None. | Repo write access for the bot [V]; the README does not say more. | Same lineage as bors. |
| **Zuul gate** [V docs, via fetch summary] | Dependent pipeline with speculative future state: change B is tested with A applied, C with A+B. Zuul itself performs the merge, not the review system. A failure removes the change and re-tests the rest on the new tip. | None. | Merge authority sits in Zuul, so untested code cannot reach mainline "regardless of review system permissions". The docs do not mention rewriting commits. Bypass = anyone with submit rights in the review system [I]. | Closest to the item's goal (ephemeral speculative refs, nothing to recover). Not runnable on GitHub without infrastructure. |
| **Chromium CQ / LUCI CV** [V docs via fetch] | Author sets CQ+2 (or "Submit to CQ" in Gerrit). CV runs tryjobs on the patched change and submits it. CQ+1 is a dry run. | Gerrit change numbers (Family 2). | CV does the submit ("a bot that commits Gerrit changes for you"). Docs do not say who else may submit; in practice Gerrit ACLs [I]. TBR can skip LGTM. | Confirms "single submitter + tested candidate". Needs Gerrit. |
| **Kubernetes Tide** [V docs] | Pools PRs by org/repo:branch, retests against the newest base, runs batch tests, merges via REST API (`merge`, `squash` or `rebase`). Successor to the mungegithub Submit Queue. | None. | Runs beside GitHub branch protection. Doc: "Ensure that merge requirements configured in GitHub match ... Tide, otherwise Tide may try to merge a PR that GitHub considers unmergeable." A gate added on top of platform enforcement, not a replacement. | Works with a user token, but is another service to run. No numbering. |
| **Mergify queue** [V search summaries; I details] | Pushes a temporary branch (default prefix `mergify/merge-queue/`) and opens a draft PR per speculative combination, so ordinary `pull_request` workflows fire. Supports batching. | None. | A GitHub App whose check you make required. Bypassable by anyone the platform lets merge. Personal-repo availability not established [I]. | A third-party route to "queue without org transfer" [I]. Vendor dependency; also cannot number (the app creates the branch, not your code). Unverified. |
| **Bulldozer** (Palantir) [V README] | Auto-merges PRs once checks and reviews pass; can keep branches updated; supports squash, merge, rebase, ff-only. | None. | "Enforces nothing independently": it respects branch protection, and you must enable protection or it merges everything. | Confirms the merge bot is not the boundary; platform settings are. |
| **GitHub merge queue** | See below. | None. | "Require merge queue" in protection or rulesets. Admins get "Merge without waiting for requirements (bypass branch protections) ... if allowed by branch protection settings" [V]. | Blocked by owner type. |

### GitHub merge queue: verified facts

| Question | Finding |
|---|---|
| Availability | **[V]** Gating reusable (fpt/ghec): "available in any public repository owned by an organization, or in private repositories owned by organizations using GitHub Enterprise Cloud." Community threads agree personal accounts are excluded [I: search summaries]. |
| Merge methods | **[V]** "merge, rebase, or squash", chosen in the queue settings. Whether the queue fast-forwards the base to the group commit is not stated [I: it advances the base to the tested group commit]. |
| Workflow trigger | **[V]** "You must use the `merge_group` event"; the only activity type is `checks_requested`; `GITHUB_SHA` is the merge group's SHA. Without the trigger "the merge will fail as the required status check will not be reported". |
| Can checks mutate the queued commit? | **[V, weak]** No documented way. The 2023-04-19 changelog fixed "commits could be pushed to queue-created prep branches (note: these commits were ignored and not merged)". **[I]** A required check can reject a candidate; it cannot number one. |
| Temporary branch shape | **[V]** `gh-readonly-queue/{base}/pr-N-sha`, "grouped ... with the latest version of the base_branch as well as changes from pull requests ahead of it". Failed entries are removed and later groups rebuilt on the base. |
| Security wrinkle | **[V, third party]** J. Cannon (2025-07): a writer can create branches named like queue branches; rulesets cannot lock them, and the queue app cannot be a bypass actor. Do not trust "it came from the queue"; make the check content-based. |
| `enforce_admins` interplay | **[V]** Admins get "Merge without waiting for requirements (bypass branch protections), if allowed by branch protection settings". **[I]** With "Do not allow bypassing" on, that option should not apply. Not tested. |
| Ruleset form | **[V]** A repository-level "Require merge queue" ruleset rule exists (not at org level), with build concurrency, group size and timeouts. |
| Same as strict? | **[V]** "The merge queue provides the same benefits as the Require branches to be up to date before merging branch protection, but does not require a pull request author to update their pull request branch." |

## Family 2: sequential ids for parallel authors

| System | Mechanism | WHERE allocated | WHAT enforces; bypassable? | Transferable? |
|---|---|---|---|---|
| **Rust RFCs** [V README] | Author copies the template to a `0000-` prefixed file ("Don't assign an RFC number yet; This is going to be the PR number"). After opening the PR, rename the prefix to the PR number. | GitHub's per-repo issue/PR counter, at PR open. | Convention plus reviewers; no gate found in the README [I]. A wrong number is a visible mistake, not a stranded temporary. | **Idea yes** (allocate once, early, from a counter you do not run). **Literally no** (counter overlap: 2419 vs 3836). |
| **Kubernetes KEPs** [V README] | "KEPs are now prefixed with their associated tracking issue number." The issue is filed first. | GitHub issue counter, at issue creation. | Process and reviewers [I]. | As RFCs. Adds an issue per card; on a public repo strangers also consume numbers (gaps). |
| **Python PEPs** [V PEP 1] | Author picks "the next available PEP number not used by a published or in-PR PEP"; editors "assign them a number if they have not"; developers with write access "may claim PEP numbers directly by creating and committing a new PEP". | Human editors, at draft/approval; self-pick with editor fix-up. | Editors are the single writer. Anyone with write access can claim a number (documented). | The "human single serializer" precedent. Bypassable; collisions fixed by hand. |
| **Swift Evolution** [V process/template] | Template has `SE-NNNN` and an `NNNN-` filename; the workgroup appoints a review manager. Who fills in the number and when is not stated in the files read [I: the manager/workgroup at review start]. | Central staff, at review. | Staff. | Same shape as PEP. Not independently informative. |
| **ADR tools** (adr-tools, log4brains) [V log4brains ADR; I threads] | adr-tools numbers by max+1 locally. Log4brains moved to `YYYYMMDD-slug` because sequential numbers "cause an issue during a git merge when two developers have created a new ADR on their respective branch"; the slug is the id. Several small repos (search results only) report silent duplicate numbers and adopt date names, a duplicate-number CI check, or merge-time renumbering. | max+1 locally (adr-tools); nowhere (log4brains). | Nothing for adr-tools; log4brains removes the race. | The closest analogue to this repo's original problem. The mainstream fix is "stop using a sequence" or "check duplicates in CI", not "renumber in a tail". |
| **Django + django-linear-migrations** [V README via fetch] | Local sequential names. The add-on writes each app's latest migration name into a tracked per-app file so two branches that both add a migration conflict in git. | Locally, at `makemigrations`. | The git merge conflict on one tracked file. Bypassed by resolving it wrongly. | **Trick transfers**: make the sequence head a tracked file so parallel allocations conflict textually. It serializes at merge, not at allocation, and needs strict (or a queue) to bite. |
| **Rails migrations** [V guide via fetch] | UTC timestamp prefix, prepended at generation. | Locally, no coordination. | None needed for uniqueness; ordering is by time. | Camp 2. No coordination; loses gapless, human-friendly numbers. |
| **Alembic** [V docs via fetch] | Random hex revision ids form a graph. Two heads are legal; `alembic merge` joins them. "There is no automatic prevention" at commit time; `upgrade head` errors at run time. | Nowhere (random). | A runtime error, not a commit gate. | Camp 2. Shows "detect multiple heads in CI" is the norm. |
| **Changesets** [V docs] | A `.changeset` directory of files named with a random unique id, consumed and deleted at release. Never renumbered. | Nowhere. | None. | Camp 2. Works because the id is never cited afterwards. Here ids are cited everywhere (`#3383`), so the id is a durable name. |
| **Gerrit** [V source, mailing list] | Change numbers come from `RepoSequence`: "The current sequence number is stored as UTF-8 text in a blob pointed to by a ref in the `refs/sequences/*` namespace. Multiple processes can share the same sequence by incrementing the counter using normal git ref updates." Servers reserve a batch (20), hand numbers out from memory, so concurrent processes are "somewhat non-monotonic" and restarts leave gaps. | A git ref, with a retrying compare-and-swap ref update. | Ref-update semantics (below). Only the server writes it. | **Yes as a mechanism**: a git ref is a proper atomic sequence store. Batching is optional; a single-step increment is enough for ~24 lanes. |
| **Phabricator** [I, not read] | Differential `D123` ids from a database auto-increment at creation. | Server DB at creation. | The DB. | Camp 1's standard answer. Not read this pass. |
| **GitHub issue/PR numbers** [V community discussion] | One shared counter per repo for issues, PRs and discussions. | GitHub, at creation. | GitHub. | Atomic and free, but see the overlap measurement above. Strangers also consume numbers. |
| **Git-ref CAS allocator (build your own)** [V git protocol] | Counter ref (one commit per allocation, or a blob). The wire command is `update = old-id SP new-id SP name`, and the server will "validate each reference that is being updated that it hasn't changed ... (the obj-id is still the same as the old-id)". A create uses a zero old-id, so it fails if the ref exists. GitHub REST update-ref returns 409 for a non-fast-forward when `force=false`; create on an existing ref returns 422 [V]. | A ref in the same remote. | Anyone with write access can move it: a coordination tool, not access control. Custom refs sit outside branch/tag rulesets [I]. | **Yes.** See Fork 3. |

Two side notes. `git push --atomic` is transactional across refs on one remote, and `--force-with-lease=<ref>:<expect>` is an explicit compare-and-swap [V]. A chain of commits (each allocation a child of the last) needs no force at all [I]. GitHub honouring `old-id` on custom refs was not tested [I].

## Family 3: GitHub enforcement primitives on a user-owned public repo

Measured today with read-only `gh api` on `chalbert/web-everything`: `owner.type=User`, `private=false`. Main protection: required checks `test` and `smoke`, both **pinned to app id 15368 (GitHub Actions)**; `strict=false`; `enforce_admins=false`; pull request required; linear history off; no push restrictions. Squash, merge and rebase all allowed; `rulesets=[]`. The pinning is new information versus the item: a write-access user cannot satisfy `test`/`smoke` with a plain commit status.

| Primitive | Verdict for this repo | Evidence |
|---|---|---|
| (a) Push rulesets: restrict file paths / path length / extensions / size | **Not available.** Push rulesets are documented "to block pushes to a private or internal repository"; the gating text lists the Team plan for private/internal repos. Public repos are out for every owner type. They also apply to all pushes on all branches, so they could not stop only main anyway. | [V] About rulesets; push rulesets overview; repo-rules gating text |
| (a') Branch/tag rulesets in general | **Available.** "Rulesets are available in public repositories with GitHub Free". They aggregate with branch protection (most restrictive wins). Relevant rules: restrict updates, require PR (with an allowed merge type), required status checks (source app pinnable), linear history, and a repo-level merge-queue rule (the queue itself is org-only). | [V] repo-rules gating text; available rules |
| (b) Branch protection "Restrict who can push" | **Not available**: "in public repositories owned by a GitHub Free organization and in all repositories owned by an organization using Team or Enterprise Cloud." The docs add: "People and apps with admin permissions ... are always able to push to a protected branch." **[I]** That sentence is about the restriction list, not `enforce_admins`; untested. Also: "Actors may only be added to bypass lists when the repository belongs to an organization" (branch-protection bypass lists). | [V] About protected branches; managing a protection rule |
| (c) `enforce_admins` / "Do not allow bypassing the above settings" | Available to personal repos. Default: restrictions "do not apply to people with admin permissions"; the option applies them to admins. For rulesets, "restrict updates: only users with bypass permissions can push". Eligible ruleset bypass actors: admins, maintain/write roles, teams, GitHub Apps, Dependabot, and (since 2026-05-07) individual users. **[I]** Ruleset bypass on a personal repo includes the admin role and Apps, not confirmed for personal repos: **test in a scratch personal repo before relying on a bypass-app promoter.** A repo admin can always edit the protection itself, so "structurally unable" is bounded by "unless the owner changes settings". | [V] docs above; changelog 2026-05-07 (owner types not stated) |
| (d) "Require branches up to date" (strict) as serialization | Available. Documented cost: "More builds may be required, as you'll need to bring the head branch up to date after other collaborators update the target branch." Loose mode: "Status checks may fail after you merge your branch if there are incompatible changes with the base branch." **[I]** With N open PRs each merge stales the rest, so worst-case re-runs grow with N. The drain, already a serialized lander, could absorb an update-branch, wait, merge loop but pays full CI wall time per PR. Benefit: the tested merge ref equals what main becomes, so a candidate-tree check is valid without a queue. | [V] About protected branches; merge-queue overview |
| (e) Squash-only | Repo toggles (`allow_merge_commit=false`, `allow_rebase_merge=false`) or a ruleset "require a merge type". Squash "combines all commits in the pull request into a single commit on the base branch" [V], so the PR branch's earlier commits (with the hash file) are not ancestors of main. **Caveats:** (1) the drain calls `mergePr({ method: 'merge' })` today (`we:scripts/merge-ai-prs.mjs:4569`) and `pr-land --fallback-git` runs `git merge --no-ff` then pushes main (`we:scripts/pr-land.mjs:1136`, break-glass gated); both must change, and the second is a direct-push route that only `enforce_admins` (or an empty-bypass ruleset) actually closes. (2) GitHub "indirect merges": a PR counts as merged if its commits become reachable through a direct push [V]. (3) The hash file names stay in objects reachable from the PR head ref, not from main. | [V] pull request merges; repo read |
| (f) Non-skippable required check | A workflow skipped by path/branch filters leaves the check "Pending" and blocks merge (safe direction) [V]. A job skipped by an `if` "reports Success" (unsafe direction) [V]. A dependent of a failed job can be skipped and "may not block merging"; use `always()` [V]. So: one unconditional aggregator job on `pull_request` (and `merge_group` if a queue ever arrives), pinned to app 15368 (already the case). **Self-edit caveat [I]:** a `pull_request` run uses the merge commit's code (`GITHUB_SHA` = last merge commit), so a PR that edits the CI workflow or the standards checker can weaken the check that judges it. `pull_request_target` runs from the base commit, so a checker that reads a trusted copy (as `we:.github/workflows/review-gate.yml` already does) is stronger. Org-level "Require workflows" rules are org-only [I]. | [V] troubleshooting required checks; events doc |

Consequence: hash-free is a file-level property, so a required check "candidate tree contains no hash-named backlog file" is sound with or without strict as long as main is clean beforehand, and squash-only makes commit reachability equal tree reachability. Uniqueness of NNNs is the part that does need serialization (Families 2 and 4).

## Family 4: Actions-based single-writer allocation

Pattern: a workflow on `pull_request` runs a numbering bot in a `concurrency:` group and pushes a rename commit to the PR branch; a required check refuses any PR with hash files.

| Facet | Finding |
|---|---|
| Serialization primitive | **[V]** "at most one running job or workflow in a concurrency group"; by default a newer `pending` run **cancels** the older pending one, so a burst of PRs silently drops bot runs. Newer docs add `queue: max` (up to 100 pending) but the text is gated in the docs source (`actions-nga`), so **[I]** confirm it is live on github.com. `queue: max` cannot be combined with `cancel-in-progress: true`. FIFO ordering is by waiting time and "ordering is not guaranteed". |
| Design consequence | The bot must be an idempotent sweep ("number every hash card on this branch against the current ledger"), not "handle event N", because runs can be dropped or reordered. It is only unique if the allocator also sees numbers given to other open branches, so it needs a shared counter (main's max is not enough): the ref-CAS counter again. |
| Push and re-trigger | **[V]** Pushes made with `GITHUB_TOKEN` "will not create a new workflow run", except `workflow_dispatch`/`repository_dispatch`. Newer docs say a PR created or updated by `GITHUB_TOKEN` gets `pull_request` runs in an **approval-required** state, and advise a GitHub App token or PAT to avoid manual approval. So the rename commit's `test`/`smoke` will not go green unaided without an App or PAT. An App can be owned by a personal account [I]. The owner's own PAT is admin-strength (avoid). |
| Head SHA changes | **[V]** Required checks "must pass on the latest commit SHA". The bot's push restarts CI and invalidates the `ready-to-merge` state. **[I]** It also leaves each lane's local branch behind its own remote (the agent's next push is non-fast-forward). |
| Fork PRs | **[I]** Same-repo lane branches are pushable by a workflow with a write token; fork PRs (this repo is public) run with a read-only token and cannot be pushed to by `GITHUB_TOKEN`. Irrelevant for lane branches, a real gap for outside contributors. |
| Enforcement | Only the required check enforces; the bot only produces the conforming state. A human merging a PR that still has hash files is stopped by the check alone, so the check is the boundary. |

This is the item's Fork 2(c) plus Fork 1(b). It needs no staging branch, but it needs the allocator and an App token; it is cheaper than the staging branch only if the allocator is atomic.

## Fork-by-fork bearing

### Fork 1: where numbering happens

- **(a) file time, atomic reservation:** supported by the strongest prior art (Gerrit, Phabricator, GitHub, RFC and KEP all allocate early from an atomic counter). The item rejects it partly for "gaps and an online filing dependency". Gaps are normal (Gerrit documents them). An offline lane could still file with a hash and reserve at first push [I]. **Missing concrete form:** a git-ref compare-and-swap counter. It removes the "registry server" objection because the git remote is the registry.
- **(b) PR open:** the Rust RFC process is the pure precedent (rename once, right after the PR exists). The provenance/abandonment concern is real but modest: that process simply leaves gaps.
- **(c) integration branch (default):** not supported as a shape. No surveyed system promotes main from a long-lived accumulating branch; they use ephemeral candidates (bors `staging`, Zuul speculative refs, queue temporary branches, Mergify drafts). A long-lived staging branch carries the red-integration recovery problem the item lists (revert vs reset, stacked PRs, retained mappings); ephemeral candidates avoid it by construction (a failed candidate is dropped and rebuilt).
- **(d) candidate at land, no persistent branch:** the best match to prior art (bors, Zuul, Tide). The item says it "needs the same exclusive writer, candidate-bound checks and retry semantics", which is what those systems implement.

### Fork 2: which admission mechanism

- **Native queue: prior art does not rule it out; ownership does.** Facts: it needs an org (a free one suffices for a public repo) [V]; it cannot number [V, weak]. The item's second condition ("numbering is no longer a mutation") is satisfiable by design: with an early allocator (Fork 1a/b) numbering happens before enqueue, and a `merge_group` check verifies "no hash file, NNN unique" on the exact queue commit. What remains is a non-design cost: transferring the repo to an organization (remote URLs, redirects, anything tied to the user namespace [I]). That is an operator trade, not a design fork, and deserves recording as an explicit option ("transfer + queue + early allocation") rather than "rejected". The queue's temporary branches cannot be locked down, so the required check must be content-based.
- **Bespoke integration branch (default):** the same kind of mechanism as the queue, built by hand. It satisfies the requirement only if exclusive promotion is enforceable. On this repo that means `enforce_admins=true` plus a promotion path that goes through normal PR rules (for example a promotion PR squash-merged), or a ruleset with an App in the bypass list [I: confirm on a personal repo]. Those same controls make the non-branch alternatives structural too. So the branch adds no admission guarantee over them; it adds allocation serialization and cross-PR testing, at the price of retargeting all PRs and six call sites, two-step latency and a recovery policy.
- **Shift-left required check (c):** the strongest realistic competitor, because hash-freedom is compositional and the check runs on the candidate tree. Its real weakness is uniqueness (the item is right), which an atomic allocator (Fork 3b) fixes.
- **Strict + squash-only + required check + `enforce_admins=true`, no staging branch:** not in the item's list, and the minimal structural recipe. It closes hash-file-on-main (tree check), reachability (squash-only; the `--no-ff` fallback dies once `enforce_admins` blocks the direct push), admin/direct push (`enforce_admins`), and cross-PR interaction (strict). Cost: `test`/`smoke` re-run after every other merge. Because the drain is already a single serialized lander, "update branch, wait for green, merge, next" is a small change, and a queue would remove it entirely.

**Is Fork 1 vs Fork 2 really two forks?** Mostly one in costume. Fork 1(c) is Fork 2(a) under two names, and Fork 1(d) is Fork 2(b/c) in essence. The real independent axes are:
1. **Allocation authority (uniqueness):** file-time atomic counter, PR-open number, serial writer at land, or none (hash ids kept).
2. **Admission boundary (hash-free and reachable):** required tree check, squash-only, admin enforcement, and optionally a staging branch or queue (only if the combined result must be tested before main moves).

The item's default picks a point on axis 1 (serial writer) and bundles axis 2's most expensive answer. Splitting them lets the operator take a cheap axis-2 answer now and choose axis 1 on merit.

### Fork 3: what prevents collisions

- Prior art favours **(b) durable atomic reservations**, with Gerrit's ref sequence as the working example. The item's (a), one serialized integration numbering authority, is also legitimate (PEP editors are a human version) but stands or falls with whichever single writer exists. Repo evidence: the drain's numbering mutex is HOME-level and callers "may proceed unlocked after contention" (item), and the `pr-land` comment concedes "the post-land heal is the collision backstop". A ref-CAS counter is a shared-remote lock, which a HOME-level mutex is not.
- If (b) is chosen: create the counter ref once (a zero-id create fails if it exists); each allocation is a push that must fast-forward from the observed tip; retry on rejection; do not batch unless offline filing needs it; abandoned numbers stay burned.
- The repair-PR tension (#2319 vs #2548) disappears if numbers are never renumbered after allocation.

### Fork 4: scope

Prior art agrees with (a), "every hash file, every carrier": the check is a tree property and cannot depend on the route. Nothing surveyed contradicts it. The same logic raises whether hash ids should exist on main at all (missing option 3).

### Options missing from the item

1. **Git-ref CAS counter for file-time reservation** (Gerrit `RepoSequence` pattern). Concrete form of Fork 1(a) / 3(b).
2. **Strict + squash-only + required content check + `enforce_admins=true`, no staging branch.**
3. **Never renumber: permanent non-sequential ids** (Changesets, Alembic, log4brains slug-as-id). Cost: existing citations use NNNs and about 3800 files; a generated display index could keep short numbers. The only option that makes Fork 1 disappear rather than move it.
4. **Native queue with an early allocator, after an organization transfer**, recorded with its true cost (the transfer) instead of a rejection.
5. **GitHub-number ids with a namespace prefix** (RFC/KEP style). Only viable with a prefix, because of the 1..2419 overlap.
6. **Pre-merge numbering inside the existing drain critical section.** The drain already holds a land-write mutex around `gh pr merge` (`we:scripts/merge-ai-prs.mjs:4563-4570`) and a numbering mutex. Number the PR branch before merging (App/PAT push so CI re-runs), then merge. This is Fork 1(d) built inside code that exists; it still needs the required check as backstop.
7. **Django-style tracked head file** (a `max_backlog_id`-type file): makes two parallel allocations a textual conflict; needs strict or a queue to bite. Low value alone; a cheap detector.

### Strongest arguments against the integration-branch default

1. **It does not create the boundary by itself.** The item admits that if exclusive promotion cannot be enforced "integration is not ready to ship". On this repo (no "restrict who can push", no org, `enforce_admins=false`, a `--fallback-git` route that writes main directly) the enforcement you would add is the same enforcement that makes a plain required check structural.
2. **Prior art argues for ephemeral candidates.** The failure mode the item spends about 15 lines on (red integration, revert vs reset, stacked-PR replay, retained numbering mappings) comes from keeping the candidate. bors, Zuul, the queue and Tide discard a bad candidate instead of repairing a shared branch.
3. **Cost surface.** Six call sites (`we:scripts/pr-land.mjs:132`, `we:scripts/verify-lane.mjs:194`, `we:scripts/merge-ai-prs.mjs:3087`, `we:scripts/operations/operator-queue.mjs:84`, the decision docket, #3443 wording), two-step latency, protection on a second branch, versus one required check and three repo settings for the same admission guarantee.
4. **Staging still holds hash-bearing commits and needs the sanitized squash promotion.** Squash is exactly what a squash-only main policy already does for ordinary PRs, so the promotion step re-implements a platform feature.
5. **The serial writer keeps the incident's failure windows.** A writer that renames after merge into staging still has crash and retry windows (the item's own "retry/crash recovery" requirement); a counter ref moves atomicity into git itself.

### Strongest argument for keeping the integration idea

Only an integration branch or a queue tests the numbered result before main moves, including cross-PR interaction; and a single writer avoids needing every lane to make network-atomic reservations. If lanes are often offline, or the operator wants gapless numbers, a serial writer is simpler than a distributed counter. That case is real, but Fork 1(d) (an ephemeral candidate inside the drain) serves it without a persistent branch.

### To verify before ratifying (not done here)

- On a scratch personal repo: can a GitHub App or the admin role be a bypass actor in a ruleset on a personal repo? Does a ruleset with an empty bypass list stop the owner's push and `gh pr merge --admin`? Does `enforce_admins=true` stop the owner's direct push and the "Merge without waiting" option?
- Whether `concurrency.queue: max` is live on github.com.
- Whether GitHub accepts pushes to a custom ref namespace with `old-id` compare-and-swap, and how it behaves under 24 concurrent lanes.
- Actual `test` + `smoke` wall time (drives the strict-cost estimate).

## Sources

GitHub docs (read as raw source in the `github/docs` repository; page URL shown, shared text blocks linked separately):
- Managing a merge queue: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
- Merging a pull request with a merge queue: https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-a-pull-request-with-a-merge-queue
- Gating text, merge queue: https://github.com/github/docs/blob/main/data/reusables/gated-features/merge-queue.md
- Gating text, rulesets and push rulesets: https://github.com/github/docs/blob/main/data/reusables/gated-features/repo-rules.md
- Push rulesets overview: https://github.com/github/docs/blob/main/data/reusables/repositories/push-rulesets-overview.md
- Ruleset bypass eligibility: https://github.com/github/docs/blob/main/data/reusables/repositories/rulesets-bypass-step.md
- About rulesets: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets
- Available rules for rulesets: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets
- Creating rulesets for a repository: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository
- About protected branches: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- Managing a branch protection rule: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule
- Pull request merges: https://docs.github.com/en/pull-requests/reference/pull-request-merges
- Troubleshooting required status checks: https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks
- Events that trigger workflows: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- Why `GITHUB_TOKEN` events do not trigger runs: https://github.com/github/docs/blob/main/data/reusables/actions/actions-do-not-trigger-workflows.md
- Concurrency semantics: https://github.com/github/docs/blob/main/data/reusables/actions/actions-group-concurrency.md
- Changelog, merge queue prep-branch fix (2023-04-19): https://github.blog/changelog/2023-04-19-pull-request-merge-queue-public-beta-api-support-and-recent-fixes/
- Changelog, user bypass on repository rulesets (2026-05-07): https://github.blog/changelog/2026-05-07-repository-rulesets-user-bypass-and-branch-renaming/
- REST git refs: https://docs.github.com/en/rest/git/refs
- GitHub shared issue/PR/discussion counter: https://github.com/orgs/community/discussions/69759
- Merge queue branches cannot be secured (third party): https://joshcannon.me/2025/07/03/gh-mq-branches-unprotectable.html
- Merge queue availability threads (search results only): https://github.com/orgs/community/discussions/51483 and https://github.com/orgs/community/discussions/56838

Gating systems:
- bors-ng: https://github.com/bors-ng/bors-ng and https://bors.tech/documentation/
- homu: https://github.com/rust-lang/homu
- Zuul gating: https://zuul-ci.org/docs/zuul/latest/gating.html
- Kubernetes Tide: https://github.com/kubernetes-sigs/prow/tree/main/site/content/en/docs/components/core/tide
- Chromium commit queue: https://chromium.googlesource.com/infra/infra/+/refs/heads/main/doc/users/services/commit_queue/ and LUCI CV: https://chromium.googlesource.com/infra/luci/luci-go/+/refs/heads/main/cv/
- Mergify (search summaries only): https://docs.mergify.com/merge-queue/speculative-checks/ and https://docs.mergify.com/merge-queue/rules/
- Bulldozer: https://github.com/palantir/bulldozer
- Linux `linux-next`: https://www.kernel.org/doc/html/latest/process/howto.html

Sequential-id prior art:
- Rust RFCs: https://github.com/rust-lang/rfcs
- Kubernetes KEPs: https://github.com/kubernetes/enhancements/tree/master/keps
- PEP 1: https://peps.python.org/pep-0001/
- Swift Evolution: https://github.com/swiftlang/swift-evolution/blob/main/process.md
- Log4brains ADR, "Use the ADR slug as its unique ID": https://thomvaill.github.io/log4brains/adr/adr/20201016-use-the-adr-slug-as-its-unique-id/
- ADR collision reports (search results only, anecdotal): https://github.com/hyperscaleav/omniglass/issues/848 , https://github.com/superhuit-agency/nextjs-revalidate/issues/109 , https://github.com/takecchi/mnemora/pull/365
- django-linear-migrations: https://github.com/adamchainz/django-linear-migrations
- Rails migrations guide: https://guides.rubyonrails.org/active_record_migrations.html
- Alembic branches: https://alembic.sqlalchemy.org/en/latest/branches.html
- Changesets: https://github.com/changesets/changesets
- Gerrit `RepoSequence` source: https://gerrit.googlesource.com/gerrit/+/refs/heads/master/java/com/google/gerrit/server/notedb/RepoSequence.java and batch/gap explanation: https://groups.google.com/g/repo-discuss/c/87I7LufhiFA
- Git pack protocol (`old-id`; create/update/delete commands): https://github.com/git/git/blob/master/Documentation/gitprotocol-pack.adoc and `git push`: https://git-scm.com/docs/git-push

Repo evidence read this pass (lane clone): `we:backlog/3732-decision-where-backlog-ids-are-assigned-so-a-temporary-hash.md`; `we:scripts/merge-ai-prs.mjs` (around lines 10-24 and 4563-4570); `we:scripts/pr-land.mjs` (around lines 1123-1150); read-only `gh api` on `repos/chalbert/web-everything` (branch protection, merge settings, rulesets, newest issue/PR number 2419); directory listing of `we:backlog` (highest id 3836).
