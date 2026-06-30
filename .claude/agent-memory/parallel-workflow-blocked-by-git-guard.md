---
name: parallel-workflow-blocked-by-git-guard
description: "Parallel /workflow now WORKS for WE-only disjoint batches (clone model + lane/* push carve-out, proven 2026-06-29b 5/6); cross-repo lanes still unreliable — keep those serial"
metadata: 
  node_type: memory
  type: project
  originSessionId: 72cb88ef-ef64-4b5c-b92e-0b70d223c9ef
---

The parallel `/workflow` batch orchestrator (`parallel-execute.workflow.js`) is **structurally incompatible**
with this repo's `~/.claude/hooks/guard-git-branch.mjs`, which unconditionally denies `git worktree add` and
branch creation in the shared checkout. First real run (batch-parallel-2026-06-28, #1153 validation,
run wf_6764346c-18c, ~78 min, 28 agents):

- The Workflow tool's `isolation:'worktree'` framework worktrees DID get created (2 concurrent items), but the
  agents' own `git worktree add` for the **integration worktree** + `batch-parallel/*` branch were DENIED by the
  hook, so integration/merge/reconcile all failed and `branchOk=false` ("do NOT land").
- Serial-lane agents fell back to committing **directly on main** (which is actually correct per
  [[commit-on-current-branch]] #104), landing 6 items clean & gate-green. But 3 items (#1904/#1912/#1914) got
  stranded as orphan-worktree commits, and 1 (#1926) was "carried" though its impl was committed in frontierui.
- Manual salvage: cherry-pick the 3 stranded commits onto main (one surface.json conflict), flip #1926's md,
  regen derived (already current), remove orphan worktrees. All recovered; #1608 was a false "blocked-in-fact"
  (env failure, not a real blocker — still workable).

**Standing decision (not just "blocked"): the parallel orchestrator isn't worth it for a solo dev — don't
pursue it.** The user's chosen model is **two separate sessions each running serial `/batch`** on the shared
checkout, working **disjoint item sets**. The guard hook makes that safe-enough by design: explicit-path
staging (no `-A`) keeps sessions from sweeping up each other's files, reservations deprioritize each other's
items, `--scope` demotes the other session's gate findings. Occasional imperfect/interleaved commits are an
accepted cost. The only real hazard is two sessions editing the **same file** at once (last-write-wins, silent
loss) — avoided by keeping the two batches on different items/subsystems.

**How to apply:** Use serial `/batch` here, NOT `/workflow` / `--parallel`. The worktree-isolation machinery
guards against multi-actor contention that barely exists for a solo dev, so the branch+worktree complexity
(which the guard hook blocks anyway) buys almost nothing. This run is the #1153 evidence — surface it there
rather than re-running parallel to "confirm." See [[commit-on-current-branch]].

**The only architecture that gives true parallelism here:** N independent **clones** (one per lane, each its
own HEAD so the shared-HEAD guard is moot) → commit locally → **push to a central repo** → rebase-and-retry on
push-conflict. That's the standard forge/CI model.

## UPDATE 2026-06-29 — that clone model now EXISTS and WORKS (the above is superseded for WE-only)

The #1933 clone model was built (`parallel-execute.workflow.js`), and `~/.claude/hooks/guard-git-branch.mjs`
now has a deliberate `lane/*` + `batch-parallel/*` **push carve-out** (so push is no longer blanket-blocked).
Three runs on 2026-06-29 to get it green, each exposing one real defect:

1. `process.cwd()` in the workflow script → undefined in the Workflow sandbox (instant crash). Fixed →
   `args.primaryRoot`. **So any `/workflow` invocation must pass `primaryRoot` in the Workflow args.**
2. The push carve-out (`pushTargetsOnlyTempRefs`) treated a trailing `2>&1` as a refspec and denied the
   `lane/_base` push (agents always append redirections) → setup-failed abort. Fixed → the carve-out now
   `break`s at the first redirection token (`/[<>]/`). Clean `lane/*` push verified; `main` push still denied.
3. **First green end-to-end run** (batch-2026-06-29b, wf_7f644063-561, ~28 min, 20 agents): **5/6 resolved**
   on main, gate green (0 errors), **0 stranded / 0 multiLaneFiles / 0 partialCrossRepo**. 4 concurrent + 2
   serial; 2 concurrent lanes (#1611/#1613) passed gate but **failed to push their lane ref** → the integrator
   **serial-replayed** them and they resolved (the optimistic floor works — but "concurrent" was lost for those
   two; residual push-reliability bug worth chasing). **FIXED 2026-06-30 (#1995):** distinct lane refs never
   collide, but concurrent pushes into the ONE shared origin contend on git's ref-transaction lock
   (`packed-refs.lock` / per-ref `.lock`) → transient "cannot lock ref" rejects. Step-4 push now wraps a bounded
   retry (≤5 attempts, 0.3–0.8s jittered backoff) in `parallel-execute.workflow.js`; force-push to a lane-owned
   ref is idempotent so retry is correctness-safe → the lane stays concurrent instead of dropping to replay.

**Lane agents over-drop, recurringly.** Every carry across these runs was a **false-drop on a misjudged
premise**, not a real blocker: cross-repo lanes (#1947/#1909) reported plateau-app code "absent" (the clone
lacked the tree — see [[workflow-crossrepo-lanes-falsedrop]]); the #1609 serial lane evaluated the wrong
migration mechanism (build-splice scalar-JSON instead of the #1621/#1787 wrap its 4 siblings used). **Always
re-verify a lane "blocked-in-fact"/"outgrew" against the real tree before accepting it** — they skew cautious.

**How to apply now:** `/workflow` is viable for **WE-only, file-disjoint** batches (the migrate-table family
is the proof). Keep **cross-repo (constellation #96) items on serial `/batch`** until the cross-repo lane
clone provisioning is proven. Pass `primaryRoot`. The earlier "don't pursue parallel" stance was correct for
the pre-clone era; revisit it with the user given the working run.
