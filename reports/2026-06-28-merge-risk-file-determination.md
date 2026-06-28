# Merge-risk file determination — prior-art survey for #1935

**Date:** 2026-06-28
**Backlog:** [#1935](../backlog/1935-how-to-determine-merge-risk-files-that-must-be-reserved-befo.md) (decision, child of the multi-clone central-push epic [#1933](../backlog/1933-multi-clone-central-push-retry-parallel-batching-replace-gua.md))
**Research topic:** `/research/merge-risk-file-determination/`
**Status:** prior-art survey supporting a near-ratification decision pass. No reservation/lock mechanism exists in the tree yet — the current parallel orchestrator (`we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js`) uses *git-as-the-conflict-detector* (merge one-at-a-time, replay on conflict) with NO pre-lock, plus a hand-maintained monolith list in its effects-manifest header.

The decision (#1935) decides HOW the central broker judges a file "merge-risk" — i.e. which files a lane must RESERVE before editing so two lanes never collide on them, while everything else relies on plain git merge. This survey grounds the four candidate forks against established concurrency-control and merge-queue practice, so WE reuses proven vocabulary (optimistic vs pessimistic control, speculative merge queues, advisory file locks) rather than re-deriving it.

## The two governing axes

Two orthogonal questions sit under "how do we decide what to lock":

1. **Optimism axis** — do we PREVENT collisions with a lock taken before the edit (pessimistic), or DETECT them at merge and redo the work (optimistic)? This is Fork D vs everything else.
2. **Lock-set derivation axis** — *given* that we lock something, how is the lock set chosen: a fixed/static list, a dynamically-computed overlap, or both? This is Fork A vs B vs C.

## Axis 1 — Optimistic vs pessimistic concurrency control

The classic database split is the right lens. **Pessimistic** control assumes conflict is likely and takes locks up front so conflicting work can never start concurrently; **optimistic** control assumes conflict is rare, lets work proceed unlocked, and validates at commit — paying for a conflict with thrown-away work and a retry.

- The tradeoff is traffic-shaped: optimistic wins when real contention is rare (low retry cost amortized over many lock-free runs); pessimistic wins when contention is common or the wasted work is expensive, at the cost of blocking and lock-management overhead. Mature systems frequently **combine both**, applying each where it fits the entity type. ([binaryigor — optimistic vs pessimistic locking](https://binaryigor.com/optimistic-vs-pessimistic-locking.html), [Modern Treasury](https://www.moderntreasury.com/learn/pessimistic-locking-vs-optimistic-locking), [freeCodeCamp — DB isolation](https://www.freecodecamp.org/news/how-databases-guarantee-isolation/))
- Marc Brooker frames the choice as fundamentally about the *cost of a wrong guess*: optimism is cheap when work is cheap to discard and conflicts are rare; it degrades badly under high contention because wasted work compounds. ([Marc Brooker — Optimism vs Pessimism](https://brooker.co.za/blog/2023/10/18/optimism.html))

**Relevance to #1935.** Fork D (no pre-lock, git-conflict-as-signal + replay) is textbook optimistic control — and it is *exactly* what the existing worktree orchestrator already does (merge one-at-a-time; a conflict means the partition was wrong; abort and replay serially; never force). Forks A/B/C add a pessimistic layer on top, locking the small set of files where a wrong guess is expensive. The DB literature's "combine both" conclusion maps directly onto Fork C (hybrid): be optimistic by default, pessimistic on the few structurally-collision-prone files.

## Axis 2 — How merge queues choose what to serialize

Merge queues are the closest real-world analog to the #1933 central broker (one integration authority, lanes converge through it).

- **Bors / bors-ng** pioneered the "keep main always-green" merge queue: enqueue PRs, build them together on a temp branch, and on failure **bisect** the batch to find which change broke it. It treats *every* PR as potentially conflicting — coarse but simple. ([Aviator — What's a bors](https://www.aviator.co/blog/what-is-bors/), [HN — Keeping master green at scale](https://news.ycombinator.com/item?id=19692820))
- **GitHub merge queue** sequences PRs and tests each against the prospective merged state; it can speculate the *success* path of the queue, but lacks dependency-graph-aware conflict detection, so an early failure forces retesting the changes behind it. ([Graphite — GitHub merge queue](https://graphite.com/guides/github-merge-queue), [arXiv 2508.08342 — merge pipeline throughput](https://arxiv.org/html/2508.08342v1))
- **Zuul** (OpenStack) serializes only changes with **declared cross-project dependencies** into a pipeline; independent changes run in parallel pipelines. Dependency is *declared*, not inferred. ([Zuul — Project Gating](https://zuul-ci.org/docs/zuul/latest/gating.html))
- **The monorepo critique** is the key signal for #1935: the traditional queue assumes every PR can conflict with every other PR — *reasonable in a single-project repo but wasteful in a monorepo* where `apps/dashboard/` and `services/api/` are independent. Scoped/parallel queues only serialize within a dependency scope, so a failure cascades only through that scope. ([Mergify — monorepo merge-queue concurrency problem](https://mergify.com/blog/monorepo-merge-queue-concurrency-problem), [Mergify — origin of merge queues](https://mergify.com/blog/the-origin-story-of-merge-queues))

**Relevance to #1935.** WE is structurally a monorepo whose collection registries are already **per-entry files** (`we:src/_data/<registry>/<id>.json` since #1145/#1146/#1157) — i.e. naturally-disjoint, like `dashboard/` vs `api/`. The monorepo critique says: do NOT treat every file as collision-prone; serialize only the genuinely-shared scope. The handful of NON-collection monoliths (the static denylist of Fork A) IS that shared scope. Zuul's "serialize only *declared* dependencies" is the precedent for Fork B's double-declaration: a file is contended only when ≥2 lanes' declared touch-sets name it.

## Axis 3 — File-level locking (the pessimistic mechanism)

If we lock, the mechanism is a reserved/exclusive checkout — well-trodden for unmergeable files.

- **Perforce exclusive checkout** and **Git LFS file locking** both exist for the same reason: some files **cannot be auto-merged** (binaries, and by extension any structured file where a textual 3-way merge produces a clean-but-wrong result). The workflow is: mark patterns *lockable*, lock before editing, single-writer while held. Git LFS makes lockable files read-only on disk until locked, as a forcing function. ([Git LFS — File Locking wiki](https://github.com/git-lfs/git-lfs/wiki/File-Locking), [Anchorpoint — file locking in Git](https://www.anchorpoint.app/blog/using-file-locking-in-git), [Atlassian — Git LFS](https://www.atlassian.com/git/tutorials/git-lfs))
- A consistent caveat: LFS locking is **advisory unless enforced** — an artist must actively lock; only Perforce enforces it the way a hard gate would. The lesson for WE: a reservation is only a real lock if a write-time mechanism enforces it (the #1933 broker, or a PreToolUse-style hook — cf. the existing `/research/agent-file-lock-coordination/` finding that "only a PreToolUse hook is a real lock, not a convention").

**Relevance to #1935.** This confirms the *category* of file the static denylist should contain: files where a 3-way merge is unsafe in principle — single structured config docs and array-of-objects registries, not per-entry collections. It does not by itself pick A/B/C/D; it tells us the locked set must be the "unmergeable-in-practice" set.

## Net effect on the decision — what the survey changes

| | candidate (item) | after survey |
|---|---|---|
| Fork A static denylist | fixed list of shared/structured files | **grounded** as the merge-queue "shared scope" + the LFS/Perforce "unmergeable files" set; right *content*, but a denylist alone misses novel collisions on ordinary files (the queue's blind spot) |
| Fork B double-declaration | lock files ≥2 lanes' touch-sets name | **grounded** in Zuul's declare-dependencies model; precision bounded by touch-set probe accuracy (the #1933/#1147 probe is a documented *lower bound*) |
| Fork C hybrid | static ∪ dynamic | **strengthened** — the DB literature's "combine both" + the monorepo "serialize only the shared scope" both land here; optimistic-by-default, pessimistic on the structural set, dynamic for the residual |
| Fork D no-pre-lock + replay | git is the detector | **recognized as the status-quo** optimistic baseline already shipped in the orchestrator; correct when contention is rare and work is cheap to redo, but the broker's gate-per-merge makes a wasted lane expensive — the case *against* pure optimism at this point |

**Headline:** prior art converges on Fork C's shape — be optimistic by default (Fork D is the floor everything builds on, never removed) and add a *pessimistic* lock only over (i) a small static denylist of structurally-unmergeable files, **unioned with** (ii) the dynamic set of files ≥2 live lanes both declare. The open low-confidence residue is not *which* fork but B's **probe-accuracy dependency** — a missed touch-set silently degrades B back to D for that file, which is why the static floor (A) must remain even inside the hybrid.
