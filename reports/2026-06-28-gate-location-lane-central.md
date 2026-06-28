# Where the quality gate runs in the lane-to-central pipeline — prior-art survey (decision #1937)

**Date:** 2026-06-28
**Point:** In #1933's lane-to-central batching model, the quality gate (`check:standards` + tests) should run in BOTH places — a *scoped, file-local* fast-fail gate in the lane (per the #1159 `--local --files` mode) AND the *full, authoritative* gate centrally after merge — because that is exactly how every mature merge-queue settles the merge-skew/false-red tradeoff this repo already hit live.
**Decision:** [#1937](../backlog/1937-where-the-quality-gate-runs-in-the-lane-to-central-pipeline.md) — parent [#1933](../backlog/1933-multi-clone-central-push-retry-parallel-batching-replace-gua.md) (multi-clone central push/retry batching).
**Relates:** [#1159](../backlog/1159-scope-check-standards-local-files-to-skip-global-consistency.md) (the `--local --files` scoping that makes a lane gate non-false-reddable), [#1153](../backlog/1153-live-validate-batch-parallel-on-a-real-multi-lane-batch.md) (the live in-worktree false-red finding).

---

## The question

#1933 makes a central broker (this checkout) the sole integration + lock authority and the only tree the
human watches. Agents work in lane clones, refresh from `origin/main`, edit, commit, push a temp `lane/*`
branch, and the broker merges + gates + pushes `main`. #1937 decides **where the gate runs** in that flow:
lane-local only, central only, or both. The axis is latency-of-feedback vs authority-of-verdict, complicated
by a repo fact already proven live: an isolated lane tree **false-reds** on whole-repo consistency rules that
cannot pass without the other lanes' changes present.

## The repo fact that grounds this — merge skew is already measured here

This is not a hypothetical. The #1153 watch over the first real multi-lane runs caught it directly:

- **First real run (2026-06-19):** of 7 concurrent lanes, **4 false-red'd in their own worktree** (#1071,
  #1139, #1058, #1137), then gated **green** on serial replay against the integrated tree. The false-reds
  ate the parallel speed-win.
- **Diagnosed cause (#1159):** the `--local` mode still ran whole-repo **global-consistency** rules a lane
  branched from base cannot satisfy — chiefly (1) cross-registry `unresolved-ref` joins (a lane references
  an entity a *sibling* lane added) and (2) the `we:AGENTS.md` `inventory` derived-artifact coherence (the
  integrator regenerates it once after merge, so an isolated lane reds stale).
- **The fix that already shipped (#1159, resolved):** a declarative `global: true` marker on the two
  global-consistency descriptor classes, and `partitionLocal` demotes any `descriptor.global` finding under
  `--local` regardless of file membership — while default (no `--local`) keeps globals fail-safe blocking.
  The lane-side scoping mechanism Fork C needs **exists today**:
  `we:scripts/check-standards.mjs:1385-1410` (the `--local`/`--files` partition),
  `we:scripts/readiness/claimScope.mjs:213` (`partitionLocal`),
  `we:scripts/check-standards-rules.mjs:58-61` (`dUnresolvedRef.global`).

This is the canonical **merge-skew** problem under its real name (below), and the repo already built the
half of the answer that makes a lane gate trustworthy: scope it so it only blocks on file-local truth.

## Prior art — every mature merge queue gates in BOTH places

The survey is decisive and one-directional: the "test it first, then promote it" world long ago settled that
the authoritative gate runs on the **post-merge consistent tree**, and the fast-feedback gate runs
**pre-merge/in-lane but SCOPED** — never one without the other.

### 1. The Not Rocket Science Rule — authority lives on the merged tree

The "Not Rocket Science Rule of Software Engineering" (coined by Graydon Hoare / Ben Elliston, early 2000s):
*automatically maintain a repository that never fails its tests* by **testing the merge result first, then
promoting it** — never promoting then testing. Bors (Rust's bot) tests the *merged* commit and only
fast-forwards `main` if it passes; otherwise `main` is left untouched. The explicit motivation is to avoid
**merge skew** — "changes appear compatible when reviewed in isolation but break once merged into an updated
main." That is *exactly* #1153's inverse-and-converse: a lane can also false-RED in isolation. The principle
fixes the **authoritative** verdict to the merged tree — i.e. central, after merge. ([Mergify — origin story
of merge queues](https://mergify.com/blog/the-origin-story-of-merge-queues),
[Aviator — what is bors](https://www.aviator.co/blog/what-is-bors/),
[Jane Street — making "never break the build" scale](https://blog.janestreet.com/making-never-break-the-build-scale/))

### 2. GitHub merge queue — speculative merge commit, gate after combining

GitHub's merge queue builds a **speculative merge commit** that combines `main` + all PRs ahead in the queue
+ the new PR, and the required checks run **against that combined tree**, not against the PR in isolation. A
PR is validated against "the state the branch will actually be in when it lands." When a check fails, the PR
is dropped and everything behind it re-runs on a new speculative commit. Batching (group size N) lands a
whole green batch at once and **bisects** on failure to find the culprit. The merge-skew lesson again: the
*binding* gate is on the assembled tree. ([GitHub Docs — managing a merge
queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue),
[Tenki — GitHub merge queue in 2026](https://tenki.cloud/blog/github-merge-queue-setup))

### 3. Zuul (OpenStack) — speculative gating + cross-project dependency graph

Zuul's *dependent pipeline* tests changes **as if applied one at a time in order**: it speculatively assumes
each change ahead will pass and tests change N against `main + 1..N-1` in parallel. If one fails, the changes
that assumed it re-test without it (best case: all merge at once; worst case: serialized). Crucially Zuul
models **cross-project dependencies as a DAG** — a change in repo A can declare it depends on a change in
repo B, and the gate assembles both. This is the direct analogue of #1933's **cross-repo lanes** carry (WE →
frontierui → plateau-app): the authoritative gate must run on an *assembled* multi-repo tree, which only the
central integrator can build. ([Zuul — project gating](https://zuul-ci.org/docs/zuul/latest/gating.html),
[OpenStack — how Zuul improves code quality](https://docs.openstack.org/infra/publications/zuul/))

### 4. Pre-merge AND post-merge is the named, recommended pattern

The explicit "do both" pattern is documented practice, not invention: pre-merge tests "catch most issues …
and provide fast feedback to the developer," while the merge-queue gate is the **gatekeeper** that validates
the combined tree before forwarding the mainline — and because it validates pre-promotion, "rollbacks can be
automated … any failure gets force-pushed out." Splitting a fast **pre-merge** suite from an authoritative
**merge-queue (post-combine)** suite is offered as the canonical division of labour. Mergify's *speculative
checks* / *parallel checks* are the same idea (run the expensive authoritative checks speculatively on the
combined state, keep a cheap fast-fail close to the author). ([Aviator — pre and post-merge tests using a
merge queue](https://www.aviator.co/blog/pre-and-post-merge-tests-using-a-merge-queue/),
[Mergify — speculative checks](https://docs.mergify.com/merge-queue/speculative-checks/))

## What the survey settles for #1937

| Concern | What prior art says | Maps to |
| --- | --- | --- |
| Where the **authoritative** verdict lives | On the *merged/combined* tree, never the isolated change (Not-Rocket-Science, GitHub speculative commit, Zuul) | Central, after merge → **Fork B is mandatory as the authority** |
| Whether to *also* gate in the lane | Yes — fast pre-merge feedback is standard, but it must be **scoped** so isolation doesn't false-red | Lane, scoped via #1159 `--local --files` → **Fork A is valuable only when scoped** |
| One place only? | No mature queue does lane-only or central-only; **both** is the settled shape | → **Fork C** |
| Cross-repo gate | Must assemble the dependency DAG (Zuul) — only the integrator can | Reinforces central authority for #1933's slice-4 cross-repo lanes |

The repo-specific twist that makes "both" *more* obviously correct here than in a generic CI: the lane gate
is **already de-false-redded** by #1159 (the `descriptor.global` demotion under `--local`), so the lane can
run a fast file-local gate that is trustworthy-as-far-as-it-goes, while the genuinely-global invariants are
*deliberately deferred* to the central full gate — the two halves are non-overlapping by construction, not
redundant.

## Recommended defaults (full reasoning in the card's Forks section)

- **Fork A (lane-local):** keep it, but ONLY as a SCOPED `--local --files=<lane files>` fast-fail — never the
  authority. *Confidence: high.*
- **Fork B (central):** the FULL no-flag gate after merge IS the authority and is non-negotiable. *Confidence: high.*
- **Fork C (both):** **recommended overall shape** — scoped lane fast-fail + full central authority, mirroring
  every mature merge queue. *Confidence: high.*

## References

- [Mergify — The Origin Story of Merge Queues](https://mergify.com/blog/the-origin-story-of-merge-queues) ·
  [Aviator — What's a bors](https://www.aviator.co/blog/what-is-bors/) ·
  [Jane Street — Making "never break the build" scale](https://blog.janestreet.com/making-never-break-the-build-scale/)
- [GitHub Docs — Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue) ·
  [Tenki — GitHub Merge Queue in 2026](https://tenki.cloud/blog/github-merge-queue-setup)
- [Zuul — Project Gating](https://zuul-ci.org/docs/zuul/latest/gating.html) ·
  [OpenStack — How OpenStack improves code quality with project gating and Zuul](https://docs.openstack.org/infra/publications/zuul/)
- [Aviator — Pre and post-merge tests using a merge queue](https://www.aviator.co/blog/pre-and-post-merge-tests-using-a-merge-queue/) ·
  [Mergify — Speculative checks](https://docs.mergify.com/merge-queue/speculative-checks/)
- Internal: [#1937](../backlog/1937-where-the-quality-gate-runs-in-the-lane-to-central-pipeline.md),
  [#1933](../backlog/1933-multi-clone-central-push-retry-parallel-batching-replace-gua.md),
  [#1159](../backlog/1159-scope-check-standards-local-files-to-skip-global-consistency.md),
  [#1153](../backlog/1153-live-validate-batch-parallel-on-a-real-multi-lane-batch.md);
  `we:scripts/check-standards.mjs:1385-1410`, `we:scripts/readiness/claimScope.mjs:213`,
  `we:scripts/check-standards-rules.mjs:58-61`.
